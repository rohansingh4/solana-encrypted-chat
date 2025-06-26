#!/usr/bin/env node

const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const forge = require('node-forge');
const fs = require('fs');

async function workingTest() {
    console.log('🚀 Working Solana Encrypted Chat Test\n');

    // Setup connection and provider
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load Alice and Bob keypairs
    const aliceKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('./alice.json'))));
    const bobKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('./bob.json'))));

    console.log('👥 Users:');
    console.log('Alice:', aliceKeypair.publicKey.toString());
    console.log('Bob:', bobKeypair.publicKey.toString());

    // Check Alice's balance
    const balance = await connection.getBalance(aliceKeypair.publicKey);
    console.log(`💰 Alice balance: ${balance / 1e9} SOL\n`);

    // Setup Anchor
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(aliceKeypair), {});
    anchor.setProvider(provider);

    // Load the program
    const idl = JSON.parse(fs.readFileSync('./target/idl/solana_encrypted_chat.json', 'utf8'));
    const programId = new PublicKey(idl.address);
    const program = new anchor.Program(idl, programId, provider);

    console.log('📋 Program ID:', programId.toString());

    // Calculate chat room PDA
    const [chatRoomPda] = await PublicKey.findProgramAddress(
        [Buffer.from('chat_room')],
        programId
    );
    console.log('📧 Chat Room PDA:', chatRoomPda.toString());

    // Step 1: Initialize chat room
    console.log('\n🏠 Initializing chat room...');
    try {
        const initTx = await program.methods
            .initialize()
            .accounts({
                chatRoom: chatRoomPda,
                user: aliceKeypair.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();
        
        console.log('✅ Chat room initialized! Transaction:', initTx);
    } catch (error) {
        if (error.message.includes('already in use')) {
            console.log('ℹ️  Chat room already exists');
        } else {
            console.log('❌ Error initializing chat room:', error.message);
            return;
        }
    }

    // Get current message count
    const chatRoomAccount = await program.account.chatRoom.fetch(chatRoomPda);
    console.log(`📊 Current message count: ${chatRoomAccount.messageCount}\n`);

    // Step 2: Generate encryption keys and send message
    console.log('🔐 Generating Bob\'s RSA keys...');
    const bobRSAKeys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    const bobPublicKeyPem = forge.pki.publicKeyToPem(bobRSAKeys.publicKey);
    const bobPrivateKeyPem = forge.pki.privateKeyToPem(bobRSAKeys.privateKey);

    // Encrypt a message for Bob
    const originalMessage = "Hello Bob! This is Alice sending you a secret message on Solana! 🔒✨";
    console.log('📝 Original message:', originalMessage);

    const encrypted = bobRSAKeys.publicKey.encrypt(originalMessage, 'RSA-OAEP');
    const encryptedBase64 = forge.util.encode64(encrypted);
    console.log('🔒 Message encrypted!\n');

    // Calculate message PDA
    const messageCount = chatRoomAccount.messageCount;
    const [messagePda] = await PublicKey.findProgramAddress(
        [
            Buffer.from('message'),
            messageCount.toArrayLike(Buffer, 'le', 8)
        ],
        programId
    );

    console.log('📤 Sending encrypted message to blockchain...');
    const messageBytes = Buffer.from(encryptedBase64, 'base64');
    
    try {
        const sendTx = await program.methods
            .sendMessage(
                Array.from(messageBytes),
                bobKeypair.publicKey
            )
            .accounts({
                message: messagePda,
                chatRoom: chatRoomPda,
                sender: aliceKeypair.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log('✅ Message sent! Transaction:', sendTx);
        console.log('📧 Message PDA:', messagePda.toString());

        // Step 3: Read and decrypt the message
        console.log('\n📨 Bob reading messages...');
        const allMessages = await program.account.message.all();
        
        const bobMessages = allMessages.filter(msg => 
            msg.account.recipient.toString() === bobKeypair.publicKey.toString()
        );

        console.log(`📬 Found ${bobMessages.length} message(s) for Bob`);

        if (bobMessages.length > 0) {
            const latestMessage = bobMessages[bobMessages.length - 1];
            console.log('\n📩 Latest message details:');
            console.log('From:', latestMessage.account.sender.toString());
            console.log('To:', latestMessage.account.recipient.toString());
            console.log('Time:', new Date(latestMessage.account.timestamp.toNumber() * 1000));
            console.log('Message ID:', latestMessage.account.messageId.toString());

            // Decrypt the message
            const encryptedContent = Buffer.from(latestMessage.account.encryptedContent).toString('base64');
            const decryptedMessage = bobRSAKeys.privateKey.decrypt(forge.util.decode64(encryptedContent), 'RSA-OAEP');
            
            console.log('\n🔓 Decrypted message:', decryptedMessage);
            console.log('\n🎉 SUCCESS! Alice successfully sent an encrypted message to Bob on Solana devnet!');
            
            console.log('\n✅ Complete Test Summary:');
            console.log('✓ Chat room initialized on devnet');
            console.log('✓ Alice sent encrypted message');
            console.log('✓ Message stored on blockchain');
            console.log('✓ Bob can read and decrypt the message');
            console.log('✓ End-to-end encryption working!');
        } else {
            console.log('❌ No messages found for Bob');
        }

    } catch (error) {
        console.error('❌ Error sending message:', error.message);
    }
}

workingTest().catch(console.error); 