# Solana Encrypted Chat

A peer-to-peer encrypted chat system built on the Solana blockchain. This project demonstrates how to securely send encrypted messages between users using RSA encryption, where messages are encrypted with the recipient's public key and can only be decrypted with their private key.

## How It Works

1. **RSA Key Generation**: Each user generates an RSA key pair (public/private) for encryption
2. **Message Encryption**: Sender encrypts the message using recipient's RSA public key
3. **Blockchain Storage**: Encrypted message is stored on Solana blockchain via a smart contract
4. **Message Retrieval**: Recipient fetches their messages from the blockchain
5. **Message Decryption**: Recipient decrypts messages using their RSA private key

## Features

- ✅ End-to-end encryption using RSA-OAEP
- ✅ Decentralized storage on Solana blockchain
- ✅ Each user can only decrypt their own messages
- ✅ Persistent message history
- ✅ CLI interface for easy interaction
- ✅ Automated demo script

## Prerequisites

- Node.js (v14+ recommended)
- Solana CLI tools installed
- Anchor framework

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the Solana program:
```bash
anchor build
```

3. Deploy to devnet (optional, for testing):
```bash
anchor deploy --provider.cluster devnet
```

## Quick Start

### 1. Setup Users and Keys
```bash
node cli.js setup
```
This creates two users (Alice and Bob) with their Solana keypairs and RSA encryption keys.

### 2. Fund Users with SOL
```bash
node cli.js airdrop alice
node cli.js airdrop bob
```

### 3. Initialize Chat Room
```bash
node cli.js init alice
```

### 4. Send Encrypted Message
```bash
node cli.js send alice bob "Hello Bob! This is a secret message from Alice."
```

### 5. Read Messages
```bash
node cli.js read bob
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `node cli.js setup` | Setup user accounts and encryption keys |
| `node cli.js balance [user]` | Check user's SOL balance |
| `node cli.js airdrop [user]` | Request SOL airdrop for user |
| `node cli.js init [user]` | Initialize chat room on blockchain |
| `node cli.js send [from] [to] [message]` | Send encrypted message |
| `node cli.js read [user]` | Read and decrypt messages for user |

## Demo

Run the complete demo that shows the entire flow:
```bash
node app/index.js
```

This will:
1. Generate two users (Alice and Bob)
2. Create RSA key pairs for both
3. Request airdrop for Alice
4. Initialize the chat room
5. Send an encrypted message from Alice to Bob
6. Retrieve and decrypt Bob's messages

## Project Structure

```
solana-encrypted-chat/
├── programs/
│   └── solana-encrypted-chat/
│       └── src/
│           └── lib.rs              # Solana smart contract
├── app/
│   └── index.js                    # Main application logic
├── tests/
│   └── solana-encrypted-chat.ts    # Test suite
├── cli.js                          # Command-line interface
├── keys/                           # Generated user keys (created after setup)
└── target/                         # Build artifacts
```

## Security Features

### RSA Encryption
- **Algorithm**: RSA-OAEP with 2048-bit keys
- **Message Encryption**: Only recipient can decrypt with their private key
- **Key Storage**: Private keys stored locally, never transmitted

### Blockchain Security
- **Immutable Storage**: Messages stored permanently on Solana
- **Program Derived Addresses (PDAs)**: Deterministic account generation
- **Sender Verification**: Only message sender can create message accounts

## Technical Implementation

### Smart Contract (Rust)
The Solana program handles:
- Chat room initialization
- Message storage with sender/recipient info
- Message retrieval by recipient

### Client (JavaScript)
The client application provides:
- RSA key pair generation
- Message encryption/decryption
- Solana transaction handling
- CLI interface

### Data Structures

**ChatRoom Account:**
```rust
pub struct ChatRoom {
    pub message_count: u64,
}
```

**Message Account:**
```rust
pub struct Message {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub encrypted_content: Vec<u8>,
    pub timestamp: i64,
    pub message_id: u64,
}
```

## Testing

Run the test suite:
```bash
anchor test
```

The tests verify:
- Chat room initialization
- Message sending and storage
- Message retrieval
- Multiple message handling

## Troubleshooting

### Common Issues

1. **"Insufficient funds" error**
   - Solution: Request airdrop with `node cli.js airdrop [user]`

2. **"Chat room already exists" error**
   - This is normal on subsequent runs, the program will continue

3. **Build errors**
   - Ensure Anchor is installed: `cargo install --git https://github.com/coral-xyz/anchor avm --locked --force`
   - Update to latest Anchor: `avm install latest && avm use latest`

4. **Connection errors**
   - Check internet connection for devnet access
   - Ensure Solana CLI is configured: `solana config get`

## Development

### Program ID
The program ID is defined in:
- `programs/solana-encrypted-chat/src/lib.rs`
- `Anchor.toml`

### Customization
- Modify message size limit in `lib.rs` (currently 512 bytes)
- Change encryption algorithm in `app/index.js`
- Add additional user verification

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Future Enhancements

- [ ] Group chat functionality
- [ ] Message editing/deletion
- [ ] File attachment support
- [ ] Web interface
- [ ] Mobile app
- [ ] Mainnet deployment scripts
- [ ] Message compression
- [ ] Alternative encryption algorithms 