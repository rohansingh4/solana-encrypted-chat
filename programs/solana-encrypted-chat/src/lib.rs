use anchor_lang::prelude::*;

declare_id!("2ZrfKcAszeddfxEcr5b1zTpSDosQheYpPqiPmyoXQvV4");

#[program]
pub mod solana_encrypted_chat {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let chat_room = &mut ctx.accounts.chat_room;
        chat_room.message_count = 0;
        msg!("Chat room initialized!");
        Ok(())
    }

    pub fn send_message(
        ctx: Context<SendMessage>,
        encrypted_message: Vec<u8>,
        recipient: Pubkey,
    ) -> Result<()> {
        let message = &mut ctx.accounts.message;
        let chat_room = &mut ctx.accounts.chat_room;
        
        message.sender = ctx.accounts.sender.key();
        message.recipient = recipient;
        message.encrypted_content = encrypted_message;
        message.timestamp = Clock::get()?.unix_timestamp;
        message.message_id = chat_room.message_count;
        
        chat_room.message_count += 1;
        
        msg!("Message sent from {} to {}", message.sender, message.recipient);
        Ok(())
    }

    pub fn get_messages_for_user(
        _ctx: Context<GetMessages>,
        _user: Pubkey,
    ) -> Result<()> {
        msg!("Getting messages for user");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + ChatRoom::INIT_SPACE,
        seeds = [b"chat_room"],
        bump
    )]
    pub chat_room: Account<'info, ChatRoom>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendMessage<'info> {
    #[account(
        init,
        payer = sender,
        space = 8 + Message::INIT_SPACE,
        seeds = [b"message", chat_room.message_count.to_le_bytes().as_ref()],
        bump
    )]
    pub message: Account<'info, Message>,
    #[account(
        mut,
        seeds = [b"chat_room"],
        bump
    )]
    pub chat_room: Account<'info, ChatRoom>,
    #[account(mut)]
    pub sender: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetMessages<'info> {
    pub user: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct ChatRoom {
    pub message_count: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Message {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    #[max_len(512)]
    pub encrypted_content: Vec<u8>,
    pub timestamp: i64,
    pub message_id: u64,
}
