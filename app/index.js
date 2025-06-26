const { Connection, PublicKey, Keypair, clusterApiUrl } = require('@solana/web3.js');
const { AnchorProvider, Wallet, Program } = require('@coral-xyz/anchor');
const nacl = require('tweetnacl');
const forge = require('node-forge');
const bs58 = require('bs58');
const fs = require('fs');

// Import the IDL (Interface Definition Language) for our program
const idl = require('../target/idl/solana_encrypted_chat.json');

class EncryptedChat {
    constructor() {
        this.connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        this.programId = new PublicKey(idl.metadata.address);
        this.provider = null;
        this.program = null;
        this.chatRoomPda = null;
    }

    async initialize(wallet) {
        this.provider = new AnchorProvider(this.connection, wallet, {});
        this.program = new Program(idl, this.programId, this.provider);
        
        // Calculate chat room PDA
        const [chatRoomPda] = await PublicKey.findProgramAddress(
            [Buffer.from('chat_room')],
            this.programId
        );
        this.chatRoomPda = chatRoomPda;
    }

    // Generate RSA key pair for encryption
    generateKeyPair() {
        const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
        return {
            publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
            privateKey: forge.pki.privateKeyToPem(keypair.privateKey)
        };
    }

    // Encrypt message using recipient's public key
    encryptMessage(message, recipientPublicKeyPem) {
        try {
            const publicKey = forge.pki.publicKeyFromPem(recipientPublicKeyPem);
            const encrypted = publicKey.encrypt(message, 'RSA-OAEP');
            return forge.util.encode64(encrypted);
        } catch (error) {
            console.error('Encryption error:', error);
            throw error;
        }
    }

    // Decrypt message using private key
    decryptMessage(encryptedMessage, privateKeyPem) {
        try {
            const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
            const encrypted = forge.util.decode64(encryptedMessage);
            const decrypted = privateKey.decrypt(encrypted, 'RSA-OAEP');
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            throw error;
        }
    }

    // Initialize the chat room on Solana
    async initializeChatRoom() {
        try {
            console.log('Initializing chat room...');
            
            const tx = await this.program.methods
                .initialize()
                .accounts({
                    chatRoom: this.chatRoomPda,
                    user: this.provider.wallet.publicKey,
                    systemProgram: PublicKey.default,
                })
                .rpc();
            
            console.log('Chat room initialized with transaction:', tx);
            return tx;
        } catch (error) {
            console.log('Chat room might already exist or error occurred:', error.message);
        }
    }

    // Send encrypted message to Solana
    async sendMessage(encryptedMessage, recipientPublicKey) {
        try {
            console.log('Sending encrypted message...');
            
            // Get current message count to generate message PDA
            const chatRoomAccount = await this.program.account.chatRoom.fetch(this.chatRoomPda);
            const messageCount = chatRoomAccount.messageCount;
            
            const [messagePda] = await PublicKey.findProgramAddress(
                [
                    Buffer.from('message'),
                    messageCount.toArrayLike(Buffer, 'le', 8)
                ],
                this.programId
            );

            // Convert encrypted message to bytes
            const messageBytes = Buffer.from(encryptedMessage, 'base64');
            
            const tx = await this.program.methods
                .sendMessage(
                    Array.from(messageBytes),
                    new PublicKey(recipientPublicKey)
                )
                .accounts({
                    message: messagePda,
                    chatRoom: this.chatRoomPda,
                    sender: this.provider.wallet.publicKey,
                    systemProgram: PublicKey.default,
                })
                .rpc();
            
            console.log('Message sent with transaction:', tx);
            return { tx, messagePda };
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    // Get messages for a user
    async getMessagesForUser(userPublicKey) {
        try {
            console.log('Fetching messages for user:', userPublicKey.toString());
            
            // Get all message accounts
            const messages = await this.program.account.message.all();
            
            // Filter messages for the user (received messages)
            const userMessages = messages.filter(msg => 
                msg.account.recipient.toString() === userPublicKey.toString()
            );
            
            return userMessages.map(msg => ({
                sender: msg.account.sender.toString(),
                recipient: msg.account.recipient.toString(),
                encryptedContent: Buffer.from(msg.account.encryptedContent).toString('base64'),
                timestamp: new Date(msg.account.timestamp.toNumber() * 1000),
                messageId: msg.account.messageId.toString(),
                publicKey: msg.publicKey.toString()
            }));
        } catch (error) {
            console.error('Error fetching messages:', error);
            throw error;
        }
    }
}

// Demo function
async function demo() {
    console.log('🚀 Starting Solana Encrypted Chat Demo\n');

    try {
        // Create two users (Alice and Bob)
        const alice = Keypair.generate();
        const bob = Keypair.generate();
        
        console.log('👥 Generated users:');
        console.log('Alice PublicKey:', alice.publicKey.toString());
        console.log('Bob PublicKey:', bob.publicKey.toString());
        console.log();

        // Generate encryption key pairs for both users
        const chat = new EncryptedChat();
        const aliceKeys = chat.generateKeyPair();
        const bobKeys = chat.generateKeyPair();
        
        console.log('🔐 Generated RSA key pairs for encryption');
        console.log('Alice RSA Public Key:', aliceKeys.publicKey.substring(0, 100) + '...');
        console.log('Bob RSA Public Key:', bobKeys.publicKey.substring(0, 100) + '...');
        console.log();

        // Initialize chat with Alice as the first user
        await chat.initialize(new Wallet(alice));
        
        // Request airdrop for Alice to pay for transactions
        console.log('💰 Requesting airdrop for Alice...');
        const airdropSignature = await chat.connection.requestAirdrop(
            alice.publicKey,
            2000000000 // 2 SOL
        );
        await chat.connection.confirmTransaction(airdropSignature);
        console.log('Airdrop completed');
        console.log();

        // Initialize chat room
        await chat.initializeChatRoom();
        console.log();

        // Alice sends an encrypted message to Bob
        const message = "Hello Bob! This is a secret message from Alice. 🔒";
        console.log('📝 Original message:', message);
        
        const encryptedMessage = chat.encryptMessage(message, bobKeys.publicKey);
        console.log('🔐 Encrypted message:', encryptedMessage.substring(0, 100) + '...');
        console.log();

        // Send the encrypted message to Solana
        const result = await chat.sendMessage(encryptedMessage, bob.publicKey.toString());
        console.log('✅ Message sent to blockchain!');
        console.log();

        // Bob retrieves his messages
        console.log('📨 Bob checking for messages...');
        const bobMessages = await chat.getMessagesForUser(bob.publicKey);
        
        if (bobMessages.length > 0) {
            console.log(`Found ${bobMessages.length} message(s) for Bob:`);
            
            bobMessages.forEach((msg, index) => {
                console.log(`\nMessage ${index + 1}:`);
                console.log('From:', msg.sender);
                console.log('Timestamp:', msg.timestamp);
                console.log('Encrypted Content:', msg.encryptedContent.substring(0, 100) + '...');
                
                // Bob decrypts the message using his private key
                try {
                    const decryptedMessage = chat.decryptMessage(msg.encryptedContent, bobKeys.privateKey);
                    console.log('🔓 Decrypted Message:', decryptedMessage);
                } catch (error) {
                    console.log('❌ Failed to decrypt message:', error.message);
                }
            });
        } else {
            console.log('No messages found for Bob');
        }

        console.log('\n🎉 Demo completed successfully!');
        console.log('\nHow it works:');
        console.log('1. Alice generates an RSA key pair for encryption');
        console.log('2. Bob generates an RSA key pair for encryption');
        console.log('3. Alice encrypts her message using Bob\'s public key');
        console.log('4. Alice sends the encrypted message to Solana blockchain');
        console.log('5. Bob retrieves the message from blockchain');
        console.log('6. Bob decrypts the message using his private key');
        
    } catch (error) {
        console.error('❌ Demo failed:', error);
    }
}

// Export for use in tests
module.exports = { EncryptedChat };

// Run demo if this file is executed directly
if (require.main === module) {
    demo().catch(console.error);
} 