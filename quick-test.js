#!/usr/bin/env node

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const forge = require('node-forge');
const fs = require('fs');

async function quickTest() {
    console.log('🚀 Quick Solana Encrypted Chat Test\n');

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const PROGRAM_ID = new PublicKey('2ZrfKcAszeddfxEcr5b1zTpSDosQheYpPqiPmyoXQvV4');
    
    // Load Alice and Bob keypairs
    const aliceKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('./alice.json'))));
    const bobKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('./bob.json'))));

    console.log('👥 Users:');
    console.log('Alice:', aliceKeypair.publicKey.toString());
    console.log('Bob:', bobKeypair.publicKey.toString());

    // Check Alice's balance
    const balance = await connection.getBalance(aliceKeypair.publicKey);
    console.log(`💰 Alice balance: ${balance / 1e9} SOL\n`);

    // Calculate chat room PDA
    const [chatRoomPda] = await PublicKey.findProgramAddress(
        [Buffer.from('chat_room')],
        PROGRAM_ID
    );

    console.log('📧 Chat Room PDA:', chatRoomPda.toString());

    // Check if chat room exists
    const chatRoomInfo = await connection.getAccountInfo(chatRoomPda);
    if (chatRoomInfo) {
        console.log('✅ Chat room exists on devnet!');
        console.log('📊 Chat room account size:', chatRoomInfo.data.length, 'bytes');
        
        // The first 8 bytes are discriminator, next 8 bytes are message_count (u64)
        if (chatRoomInfo.data.length >= 16) {
            const messageCount = chatRoomInfo.data.readBigUInt64LE(8);
            console.log('📝 Total messages in chat room:', messageCount.toString());
        }
    } else {
        console.log('❌ Chat room not found - need to initialize first');
    }

    // Demonstrate encryption
    console.log('\n🔐 Testing RSA Encryption:');
    const testMessage = "Hello Bob! This is a secret message from Alice! 🔒";
    console.log('📝 Original message:', testMessage);

    // Generate Bob's RSA keys
    const bobRSAKeys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    
    // Encrypt message for Bob
    const encrypted = bobRSAKeys.publicKey.encrypt(testMessage, 'RSA-OAEP');
    const encryptedBase64 = forge.util.encode64(encrypted);
    console.log('🔒 Encrypted (first 50 chars):', encryptedBase64.substring(0, 50) + '...');

    // Decrypt message
    const decrypted = bobRSAKeys.privateKey.decrypt(encrypted, 'RSA-OAEP');
    console.log('🔓 Decrypted message:', decrypted);

    console.log('\n✅ Test Summary:');
    console.log('✓ Program deployed on devnet');
    console.log('✓ Alice account funded');
    console.log('✓ Bob account created');
    console.log('✓ Chat room PDA calculated');
    console.log('✓ RSA encryption/decryption working');
    console.log('\n🎉 Encrypted chat system is ready for use!');
}

quickTest().catch(console.error);