
// Mock Context and SceneSession
const mockCtx = {
    message: {
        reply_to_message: {
            text: `📨 Сообщение в поддержку (WebApp)

👤 Пользователь: Test User
🆔 Telegram ID: 123456789
📱 Username: @testuser

💬 Сообщение:
Hello help!`
        }
    },
    from: {
        id: 12345, // Needs to be in ADMIN_CHAT_ID
        first_name: 'Admin'
    },
    session: {},
    reply: (msg) => console.log('Bot Reply:', msg),
    telegram: {
        sendMessage: (id, msg) => console.log(`Sent to ${id}:`, msg)
    }
};

async function testReply() {
    console.log('--- Testing Admin Reply Logic ---');

    // Extracted regex logic from src/modules/navigation/index.ts
    const replyTo = mockCtx.message.reply_to_message;
    console.log('Reply Text:', replyTo.text);

    if (replyTo.text && (replyTo.text.includes('Telegram ID:') || replyTo.text.includes('ID:'))) {
        const match = replyTo.text.match(/Telegram ID:\s*(\d+)/) ||
            replyTo.text.match(/ID:\s*(\d+)/) ||
            replyTo.text.match(/ID:.*?(\d+)/);

        if (match && match[1]) {
            console.log('✅ Matched ID:', match[1]);
        } else {
            console.log('❌ Failed to match ID');
        }
    } else {
        console.log('❌ Text condition failed');
    }
}

testReply();
