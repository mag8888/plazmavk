import { Telegraf } from 'telegraf';
import { Context } from '../../bot/context.js';
import { BotModule } from '../../bot/types.js';
import { ensureUser, logUserAction } from '../../services/user-history.js';
import { createBalanceTopUp } from '../payment/index.js';

const CANCEL_KEYWORDS = ['отмена', 'cancel', 'stop'];

export const balanceModule: BotModule = {
  async register(bot: Telegraf<Context>) {
    bot.command('add_balance', async (ctx) => {
      try {
        await logUserAction(ctx, 'command:add_balance');

        const user = await ensureUser(ctx);
        if (!user) {
          await ctx.reply('❌ Не удалось определить пользователя. Попробуйте позже.');
          return;
        }

        if (!ctx.session) {
          ctx.session = {};
        }

        ctx.session.addBalanceFlow = { awaitingAmount: true };

        await ctx.reply(
          '💰 <b>Пополнение баланса</b>\n\n' +
            'Введите сумму в рублях, которую хотите внести, например <code>500</code> или <code>799.50</code>.\n' +
            'Если передумали, напишите «отмена».',
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        console.error('💳 Balance: failed to start add_balance command', error);
        await ctx.reply('❌ Не удалось начать пополнение. Попробуйте позже.');
      }
    });

    bot.on('text', async (ctx, next) => {
      if (!ctx.session?.addBalanceFlow?.awaitingAmount) {
        await next();
        return;
      }

      const messageText = ctx.message?.text?.trim();
      if (!messageText) {
        await next();
        return;
      }

      // Allow user to cancel the flow
      if (CANCEL_KEYWORDS.includes(messageText.toLowerCase())) {
        delete ctx.session.addBalanceFlow;
        await ctx.reply('⛔️ Пополнение отменено.');
        return;
      }

      // Prevent commands from being treated as amount
      if (messageText.startsWith('/')) {
        delete ctx.session.addBalanceFlow;
        await next();
        return;
      }

      const normalized = messageText.replace(/\s+/g, '').replace(',', '.');
      const amount = Number(normalized);

      if (!Number.isFinite(amount) || amount <= 0) {
        await ctx.reply(
          '⚠️ Введите корректную сумму числом, например <code>500</code> или <code>799.50</code>.\n' +
            'Чтобы отменить операцию, напишите «отмена».',
          { parse_mode: 'HTML' }
        );
        return;
      }

      if (amount < 10) {
        await ctx.reply('Минимальная сумма пополнения — 10 ₽. Пожалуйста, введите другую сумму.');
        return;
      }

      // Ограничим максимум для безопасности
      if (amount > 1000000) {
        await ctx.reply('Слишком большая сумма. Максимум для одного пополнения — 1 000 000 ₽.');
        return;
      }

      const roundedAmount = Math.round(amount * 100) / 100;

      delete ctx.session.addBalanceFlow;

      await logUserAction(ctx, 'balance:add_requested', { amount: roundedAmount });

      await createBalanceTopUp(ctx, roundedAmount);
    });
  },
};



