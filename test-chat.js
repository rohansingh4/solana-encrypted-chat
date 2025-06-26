#!/usr/bin/env node

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { AnchorProvider, Wallet, Program } = require('@coral-xyz/anchor');
const forge = require('node-forge');
const fs = require('fs');

// Load IDL
const idl = require('./target/idl/solana_encrypted_chat.json');

class SimpleChat {
    constructor() {
        this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        this.programId = new PublicKey(idl.address);
    }

    // Generate RSA key pair for encryption
    generateKeyPair() {
        const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
        return {
            publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
            privateKey: forge.pki.privateKeyToPem(keypair.privateKey)
        };
    }

    // Encrypt message
    encryptMessage(message, recipientPublicKeyPem) {
        const publicKey = forge.pki.publicKeyFromPem(recipientPublicKeyPem);
        const encrypted = publicKey.encrypt(message, 'RSA-OAEP');
        return forge.util.encode64(encrypted);
    }

    // Decrypt message
    decryptMessage(encryptedMessage, privateKeyPem) {
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
        const encrypted = forge.util.decode64(encryptedMessage);
        const decrypted = privateKey.decrypt(encrypted, 'RSA-OAEP');
        return decrypted;
    }

    async runTest() {
        console.log('🚀 Testing Solana Encrypted Chat\n');

        // Load Alice and Bob keypairs
        const aliceKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('./alice.json'))));
        const bobKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('./bob.json'))));

        console.log('👥 Users:');
        console.log('Alice:', aliceKeypair.publicKey.toString());
        console.log('Bob:', bobKeypair.publicKey.toString());

        // Check Alice's balance
        const balance = await this.connection.getBalance(aliceKeypair.publicKey);
        console.log(`💰 Alice balance: ${balance / 1e9} SOL\n`);

        // Generate encryption keys for both users
        console.log('🔐 Generating RSA encryption keys...');
        const aliceEncryption = this.generateKeyPair();
        const bobEncryption = this.generateKeyPair();
        console.log('✅ Encryption keys generated\n');

        // Setup Anchor program
        const provider = new AnchorProvider(this.connection, new Wallet(aliceKeypair), {});
        const program = new Program(idl, this.programId, provider);

        // Calculate chat room PDA
        const [chatRoomPda] = await PublicKey.findProgramAddress(
            [Buffer.from('chat_room')],
            this.programId
        );

        // Step 1: Initialize chat room (if not already done)
        console.log('🏠 Initializing chat room...');
        try {
            const tx1 = await program.methods
                .initialize()
                .accounts({
                    chatRoom: chatRoomPda,
                    user: aliceKeypair.publicKey,
                    systemProgram: PublicKey.default,
                })
                .rpc();
            console.log('✅ Chat room initialized:', tx1);
        } catch (error) {
            console.log('ℹ️  Chat room already exists or error:', error.message);
        }

        // Get current message count
        const chatRoomAccount = await program.account.chatRoom.fetch(chatRoomPda);
        console.log(`📊 Current message count: ${chatRoomAccount.messageCount}\n`);

        // Step 2: Alice sends encrypted message to Bob
        const originalMessage = "Hello Bob! This is a secret message from Alice! 🔒";
        console.log('📝 Original message:', originalMessage);

        const encryptedMessage = this.encryptMessage(originalMessage, bobEncryption.publicKey);
        console.log('🔐 Message encrypted\n');

        // Calculate message PDA
        const messageCount = chatRoomAccount.messageCount;
        const [messagePda] = await PublicKey.findProgramAddress(
            [
                Buffer.from('message'),
                messageCount.toArrayLike(Buffer, 'le', 8)
            ],
            this.programId
        );

        console.log('📤 Sending message to blockchain...');
        const messageBytes = Buffer.from(encryptedMessage, 'base64');
        
        const tx2 = await program.methods
            .sendMessage(
                Array.from(messageBytes),
                bobKeypair.publicKey
            )
            .accounts({
                message: messagePda,
                chatRoom: chatRoomPda,
                sender: aliceKeypair.publicKey,
                systemProgram: PublicKey.default,
            })
            .rpc();

        console.log('✅ Message sent! Transaction:', tx2);
        console.log('📧 Message PDA:', messagePda.toString());

        // Step 3: Bob reads the message
        console.log('\n📨 Bob checking for messages...');
        const allMessages = await program.account.message.all();
        
        const bobMessages = allMessages.filter(msg => 
            msg.account.recipient.toString() === bobKeypair.publicKey.toString()
        );

        console.log(`📬 Found ${bobMessages.length} message(s) for Bob\n`);

        if (bobMessages.length > 0) {
            const latestMessage = bobMessages[bobMessages.length - 1];
            console.log('📩 Latest message details:');
            console.log('From:', latestMessage.account.sender.toString());
            console.log('To:', latestMessage.account.recipient.toString());
            console.log('Time:', new Date(latestMessage.account.timestamp.toNumber() * 1000));
            console.log('Message ID:', latestMessage.account.messageId.toString());

            // Decrypt the message
            const encryptedContent = Buffer.from(latestMessage.account.encryptedContent).toString('base64');
            const decryptedMessage = this.decryptMessage(encryptedContent, bobEncryption.privateKey);
            
            console.log('\n🔓 Decrypted message:', decryptedMessage);
            console.log('\n✅ Test completed successfully! Alice sent an encrypted message to Bob on Solana devnet!');
        } else {
            console.log('❌ No messages found for Bob');
        }
    }
}

// Run the test
const chat = new SimpleChat();
chat.runTest().catch(console.error); 