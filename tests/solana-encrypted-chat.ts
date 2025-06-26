import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaEncryptedChat } from "../target/types/solana_encrypted_chat";
import { expect } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";

describe("solana-encrypted-chat", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolanaEncryptedChat as Program<SolanaEncryptedChat>;
  const provider = anchor.getProvider();

  // Generate test keypairs
  const alice = Keypair.generate();
  const bob = Keypair.generate();
  
  let chatRoomPda: PublicKey;
  let chatRoomBump: number;

  before(async () => {
    // Airdrop to test accounts
    const airdropSignature = await provider.connection.requestAirdrop(
      alice.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    // Calculate chat room PDA
    [chatRoomPda, chatRoomBump] = await PublicKey.findProgramAddress(
      [Buffer.from("chat_room")],
      program.programId
    );
  });

  it("Initializes the chat room", async () => {
    try {
      const tx = await program.methods
        .initialize()
        .accounts({
          chatRoom: chatRoomPda,
          user: alice.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([alice])
        .rpc();

      console.log("Initialize transaction signature", tx);

      // Verify the chat room was created
      const chatRoomAccount = await program.account.chatRoom.fetch(chatRoomPda);
      expect(chatRoomAccount.messageCount.toNumber()).to.equal(0);
    } catch (error) {
      console.log("Chat room already exists or error:", error.message);
    }
  });

  it("Sends an encrypted message", async () => {
    // Mock encrypted message (in real scenario, this would be encrypted with recipient's RSA public key)
    const mockEncryptedMessage = Buffer.from("This is a mock encrypted message");
    
    // Get current message count
    const chatRoomAccount = await program.account.chatRoom.fetch(chatRoomPda);
    const messageCount = chatRoomAccount.messageCount;
    
    // Calculate message PDA
    const [messagePda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("message"),
        messageCount.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const tx = await program.methods
      .sendMessage(
        Array.from(mockEncryptedMessage),
        bob.publicKey
      )
      .accounts({
        message: messagePda,
        chatRoom: chatRoomPda,
        sender: alice.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    console.log("Send message transaction signature", tx);

    // Verify the message was stored
    const messageAccount = await program.account.message.fetch(messagePda);
    expect(messageAccount.sender.toString()).to.equal(alice.publicKey.toString());
    expect(messageAccount.recipient.toString()).to.equal(bob.publicKey.toString());
    expect(Buffer.from(messageAccount.encryptedContent)).to.deep.equal(mockEncryptedMessage);
    expect(messageAccount.messageId.toNumber()).to.equal(0);

    // Verify chat room message count increased
    const updatedChatRoom = await program.account.chatRoom.fetch(chatRoomPda);
    expect(updatedChatRoom.messageCount.toNumber()).to.equal(1);
  });

  it("Retrieves messages for a user", async () => {
    // Get all message accounts
    const messages = await program.account.message.all();
    
    // Filter messages for Bob
    const bobMessages = messages.filter(msg => 
      msg.account.recipient.toString() === bob.publicKey.toString()
    );

    expect(bobMessages.length).to.be.greaterThan(0);
    
    if (bobMessages.length > 0) {
      const firstMessage = bobMessages[0];
      expect(firstMessage.account.sender.toString()).to.equal(alice.publicKey.toString());
      expect(firstMessage.account.recipient.toString()).to.equal(bob.publicKey.toString());
      console.log("Message found for Bob:", {
        sender: firstMessage.account.sender.toString(),
        recipient: firstMessage.account.recipient.toString(),
        messageId: firstMessage.account.messageId.toString(),
        timestamp: new Date(firstMessage.account.timestamp.toNumber() * 1000)
      });
    }
  });

  it("Sends multiple messages", async () => {
    // Send another message from Alice to Bob
    const chatRoomAccount = await program.account.chatRoom.fetch(chatRoomPda);
    const messageCount = chatRoomAccount.messageCount;
    
    const [messagePda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("message"),
        messageCount.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const secondMessage = Buffer.from("Second encrypted message");
    
    await program.methods
      .sendMessage(
        Array.from(secondMessage),
        bob.publicKey
      )
      .accounts({
        message: messagePda,
        chatRoom: chatRoomPda,
        sender: alice.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    // Verify we now have 2 messages
    const updatedChatRoom = await program.account.chatRoom.fetch(chatRoomPda);
    expect(updatedChatRoom.messageCount.toNumber()).to.equal(2);
  });
});
