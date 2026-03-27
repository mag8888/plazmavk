
import { Telegraf } from 'telegraf';
import { env } from '../src/config/env.js';

// Simple script to check if bot token is valid and can connect
async function checkBot() {
    console.log('Checking bot connection...');
    const bot = new Telegraf(env.botToken);

    try {
        const me = await bot.telegram.getMe();
        console.log('Bot info:', me);
    } catch (e) {
        console.error('Bot check failed:', e);
    }
}

checkBot();
