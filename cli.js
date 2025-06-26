#!/usr/bin/env node

const { EncryptedChat } = require('./app/index.js');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { Wallet } = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Helper function to load or create keypair
function loadOrCreateKeypair(filename) {
    const keypairPath = path.join(__dirname, 'keys', filename);
    
    if (fs.existsSync(keypairPath)) {
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        return Keypair.fromSecretKey(new Uint8Array(keypairData));
    } else {
        // Create keys directory if it doesn't exist
        const keysDir = path.dirname(keypairPath);
        if (!fs.existsSync(keysDir)) {
            fs.mkdirSync(keysDir, { recursive: true });
        }
        
        const keypair = Keypair.generate();
        fs.writeFileSync(keypairPath, JSON.stringify(Array.from(keypair.secretKey)));
        console.log(`Generated new keypair: ${filename}`);
        console.log(`Public Key: ${keypair.publicKey.toString()}`);
        return keypair;
    }
}

// Helper function to load or create encryption keys
function loadOrCreateEncryptionKeys(filename) {
    const keysPath = path.join(__dirname, 'keys', filename);
    
    if (fs.existsSync(keysPath)) {
        return JSON.parse(fs.readFileSync(keysPath, 'utf8'));
    } else {
        const chat = new EncryptedChat();
        const keys = chat.generateKeyPair();
        fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2));
        console.log(`Generated new encryption keys: ${filename}`);
        return keys;
    }
}

async function main() {
    const command = process.argv[2];
    
    if (!command) {
        console.log(`
🔐 Solana Encrypted Chat CLI

Usage:
  node cli.js setup                           - Setup user accounts and keys
  node cli.js init [user]                     - Initialize chat room (user: alice or bob)
  node cli.js send [from] [to] [message]     - Send encrypted message
  node cli.js read [user]                     - Read messages for user
  node cli.js demo                           - Run full demo
  node cli.js balance [user]                 - Check user balance
  node cli.js airdrop [user]                 - Request airdrop for user

Examples:
  node cli.js setup
  node cli.js init alice
  node cli.js send alice bob "Hello from Alice!"
  node cli.js read bob
        `);
        return;
    }

    try {
        const chat = new EncryptedChat();

        switch (command) {
            case 'setup':
                console.log('🚀 Setting up users and encryption keys...\n');
                
                const aliceKeypair = loadOrCreateKeypair('alice.json');
                const bobKeypair = loadOrCreateKeypair('bob.json');
                
                const aliceEncryption = loadOrCreateEncryptionKeys('alice_encryption.json');
                const bobEncryption = loadOrCreateEncryptionKeys('bob_encryption.json');
                
                console.log('\n✅ Setup complete!');
                console.log('\nUsers created:');
                console.log(`Alice: ${aliceKeypair.publicKey.toString()}`);
                console.log(`Bob: ${bobKeypair.publicKey.toString()}`);
                break;

            case 'balance':
                const balanceUser = process.argv[3] || 'alice';
                const balanceKeypair = loadOrCreateKeypair(`${balanceUser}.json`);
                const balance = await chat.connection.getBalance(balanceKeypair.publicKey);
                console.log(`${balanceUser.charAt(0).toUpperCase() + balanceUser.slice(1)} balance: ${balance / 1e9} SOL`);
                break;

            case 'airdrop':
                const airdropUser = process.argv[3] || 'alice';
                const airdropKeypair = loadOrCreateKeypair(`${airdropUser}.json`);
                console.log(`Requesting airdrop for ${airdropUser}...`);
                const signature = await chat.connection.requestAirdrop(airdropKeypair.publicKey, 2e9);
                await chat.connection.confirmTransaction(signature);
                console.log('Airdrop completed!');
                break;

            case 'init':
                const initUser = process.argv[3] || 'alice';
                const initKeypair = loadOrCreateKeypair(`${initUser}.json`);
                
                await chat.initialize(new Wallet(initKeypair));
                console.log('Initializing chat room...');
                await chat.initializeChatRoom();
                console.log('✅ Chat room initialized!');
                break;

            case 'send':
                const fromUser = process.argv[3];
                const toUser = process.argv[4];
                const message = process.argv.slice(5).join(' ');
                
                if (!fromUser || !toUser || !message) {
                    console.log('Usage: node cli.js send [from] [to] [message]');
                    return;
                }
                
                const senderKeypair = loadOrCreateKeypair(`${fromUser}.json`);
                const recipientKeypair = loadOrCreateKeypair(`${toUser}.json`);
                const recipientEncryption = loadOrCreateEncryptionKeys(`${toUser}_encryption.json`);
                
                await chat.initialize(new Wallet(senderKeypair));
                
                console.log(`📝 ${fromUser} sending message to ${toUser}: "${message}"`);
                const encryptedMessage = chat.encryptMessage(message, recipientEncryption.publicKey);
                
                const result = await chat.sendMessage(encryptedMessage, recipientKeypair.publicKey.toString());
                console.log('✅ Message sent!');
                console.log('Transaction:', result.tx);
                break;

            case 'read':
                const readUser = process.argv[3];
                
                if (!readUser) {
                    console.log('Usage: node cli.js read [user]');
                    return;
                }
                
                const readerKeypair = loadOrCreateKeypair(`${readUser}.json`);
                const readerEncryption = loadOrCreateEncryptionKeys(`${readUser}_encryption.json`);
                
                // Use any wallet for reading (we don't need to sign transactions)
                const dummyWallet = new Wallet(readerKeypair);
                await chat.initialize(dummyWallet);
                
                console.log(`📨 Reading messages for ${readUser}...`);
                const messages = await chat.getMessagesForUser(readerKeypair.publicKey);
                
                if (messages.length === 0) {
                    console.log('No messages found.');
                } else {
                    console.log(`Found ${messages.length} message(s):\n`);
                    
                    messages.forEach((msg, index) => {
                        console.log(`Message ${index + 1}:`);
                        console.log(`From: ${msg.sender}`);
                        console.log(`Time: ${msg.timestamp}`);
                        
                        try {
                            const decrypted = chat.decryptMessage(msg.encryptedContent, readerEncryption.privateKey);
                            console.log(`🔓 Message: "${decrypted}"`);
                        } catch (error) {
                            console.log('❌ Could not decrypt message');
                        }
                        console.log('---');
                    });
                }
                break;

            case 'demo':
                console.log('🚀 Running full demo...\n');
                // Import and run the demo from index.js
                const { demo } = require('./app/index.js');
                // We need to export demo from index.js for this to work
                console.log('Please run: node app/index.js');
                break;

            default:
                console.log('Unknown command. Use "node cli.js" for help.');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('airdrop')) {
            console.log('💡 Try running: node cli.js airdrop [user]');
        }
    }
}

main().catch(console.error); 