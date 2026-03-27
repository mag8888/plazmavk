import { Telegraf, Markup } from 'telegraf';
import { Context } from '../../bot/context.js';
import { BotModule } from '../../bot/types.js';
import { logUserAction } from '../../services/user-history.js';
import { getBotContent } from '../../services/bot-content-service.js';

// Fallback текст, если контент не найден в БД
const fallbackAboutText = `💧 <b>О PLAZMA WATER</b>

✨ <b>Plazma Water</b> — это революционная форма витаминов и микроэлементов в плазменной наноформе.

🚀 <b>Преимущества:</b>
• Усвоение до 99,9% (в отличие от таблеток 1-10%)
• Проникает напрямую в клетки
• Без нагрузки на печень и почки
• Поддержка иммунитета и восстановление клеток

🤝 Присоединяйтесь к нашему сообществу!`;

export const aboutModule: BotModule = {
  async register(bot: Telegraf<Context>) {
    // Handle about command
    bot.command('about', async (ctx) => {
      try {
        await logUserAction(ctx, 'command:about');
        await showAbout(ctx);
      } catch (error) {
        console.error('ℹ️ About: Failed to process /about command', error);
        await ctx.reply('❌ Не удалось загрузить информацию. Попробуйте позже.');
      }
    });

    bot.hears(['ℹ️ О PLAZMA WATER'], async (ctx) => {
      try {
        await logUserAction(ctx, 'menu:about');
        await showAbout(ctx);
      } catch (error) {
        console.error('ℹ️ About: Failed to process about menu', error);
        await ctx.reply('❌ Не удалось загрузить информацию. Попробуйте позже.');
      }
    });
  },
};

export async function showAbout(ctx: Context) {
  try {
    const aboutText = (await getBotContent('about_text')) || fallbackAboutText;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.url('📱 VK', 'https://vk.com/iplazma'),
        Markup.button.url('📸 Instagram', 'https://www.instagram.com/iplazmanano/')
      ],
      [
        Markup.button.url('🆘 Поддержка', 'https://t.me/diglukhov?text=Здрасвуйте у меня вопрос по VITAL')
      ],
      [
        Markup.button.url('🌐 Каталог', 'https://ivital.tilda.ws/'),
        Markup.button.url('💬 Telegram', 'https://t.me/Vital_shop_bot')
      ]
    ]);

    await ctx.reply(aboutText, { ...keyboard, parse_mode: 'HTML' });
  } catch (error) {
    console.error('ℹ️ About: Failed to load about content', error);
    await ctx.reply(fallbackAboutText, { parse_mode: 'HTML' });
  }
}
