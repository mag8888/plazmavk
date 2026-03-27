import { Markup, Telegraf } from 'telegraf';
import { Context } from '../../bot/context.js';
import { BotModule } from '../../bot/types.js';
import { prisma } from '../../lib/prisma.js';
import { getAdminChatIds } from '../../config/env.js';
import { broadcastService } from '../../services/broadcast-service.js';

function isAdmin(ctx: Context): boolean {
    const id = ctx.from?.id?.toString();
    if (!id) return false;
    const adminIds = getAdminChatIds();
    return adminIds.length > 0 ? adminIds.includes(id) : id === process.env.ADMIN_CHAT_ID;
}

export const broadcastListenerModule: BotModule = {
    async register(bot: Telegraf<Context>) {

        // Listener for forwarded or regular messages from Admin
        bot.on(['message'], async (ctx, next) => {
            // 1. Validations
            if (!isAdmin(ctx)) return next();
            if (!ctx.message) return next();

            // Skip if admin is in "Reply to User" mode (handled by navigation module)
            if (ctx.session?.replyingTo) return next();

            // Skip if this is a native Telegram reply to another message (not an intended broadcast)
            if (ctx.message && 'reply_to_message' in ctx.message && ctx.message.reply_to_message) {
                return next();
            }

            // Skip commands
            if ('text' in ctx.message && ctx.message.text.startsWith('/')) return next();

            // Skip if it's part of a conversation scene (if any) - simple check
            // For now, we assume admin only sends messages to bot for broadcasting or commands

            // 2. Formatting the prompt
            // We identify the message by ID and Chat ID
            // We don't save it yet, we just ask what to do with it.

            await ctx.reply(
                '📢 <b>Новая рассылка?</b>\n\nВы отправили сообщение. Хотите превратить его в рассылку?',
                {
                    parse_mode: 'HTML',
                    reply_parameters: { message_id: ctx.message.message_id },
                    ...Markup.inlineKeyboard([
                        [
                            Markup.button.callback('✅ Создать черновик', `broadcast:create:${ctx.message.message_id}`),
                            Markup.button.callback('❌ Отмена', 'broadcast:cancel')
                        ]
                    ])
                }
            );

            // Don't stop propagation, maybe other listeners need it (though unlikely for admin)
            return next();
        });

        // Handle Create Action
        bot.action(/broadcast:create:(\d+)/, async (ctx) => {
            if (!isAdmin(ctx)) return;

            const messageId = parseInt(ctx.match[1]);
            const chatId = ctx.chat?.id.toString();

            if (!chatId) {
                return ctx.reply('Ошибка: не удалось определить ID чата.');
            }

            await ctx.answerCbQuery('Создаем черновик...');

            try {
                // Create Broadcast Record
                const broadcast = await prisma.broadcast.create({
                    data: {
                        title: `Forwarded ${new Date().toLocaleString('ru-RU')}`,
                        message: 'Forwarded/Copied message', // Placeholder, we use sourceMessageId
                        targetType: 'ALL',
                        status: 'DRAFT',
                        sourceChatId: chatId,
                        sourceMessageId: messageId,
                        totalRecipients: 0
                    } as any
                });

                await ctx.editMessageText(
                    `📝 <b>Черновик рассылки #${broadcast.id.substring(0, 8)} создан!</b>\n\n` +
                    `Сообщение будет скопировано (стиль, медиа, смайлы сохранятся).\n` +
                    `Отправитель будет заменен на @${ctx.botInfo.username}.\n\n` +
                    `<b>Действия:</b>`,
                    {
                        parse_mode: 'HTML',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('🧪 Тест мне', `broadcast:test:${broadcast.id}`)],
                            [Markup.button.callback('👥 Настроить аудиторию', `broadcast:audience:${broadcast.id}`)],
                            [Markup.button.callback('🚀 ОТПРАВИТЬ ВСЕМ', `broadcast:send:${broadcast.id}`)],
                            [Markup.button.callback('🗑 Удалить', `broadcast:delete:${broadcast.id}`)]
                        ])
                    }
                );
            } catch (e: any) {
                console.error('Broadcast create error:', e?.message || e);
                await ctx.reply(`Ошибка создания рассылки: ${e?.message || 'неизвестная ошибка'}. Проверьте логи.`);
            }
        });

        // Cancel Action
        bot.action('broadcast:cancel', async (ctx) => {
            await ctx.deleteMessage();
        });

        // Delete Action
        bot.action(/broadcast:delete:(.+)/, async (ctx) => {
            await prisma.broadcast.delete({ where: { id: ctx.match[1] } });
            await ctx.editMessageText('🗑 Рассылка удалена.');
        });

        // Test Action
        bot.action(/broadcast:test:(.+)/, async (ctx) => {
            const broadcastId = ctx.match[1];
            const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });

            if (!broadcast) return ctx.reply('Рассылка не найдена.');

            await ctx.answerCbQuery('Отправляем тест...');

            try {
                await broadcastService.sendTestBroadcast(ctx.from!.id, {
                    message: broadcast.message, // Fallback
                    sourceChatId: broadcast.sourceChatId || undefined,
                    sourceMessageId: broadcast.sourceMessageId || undefined,
                    buttonText: broadcast.buttonText || undefined,
                    buttonUrl: broadcast.buttonUrl || undefined
                });
                await ctx.reply('✅ Тест отправлен вам в личку (проверьте копию).');
            } catch (e) {
                await ctx.reply('❌ Ошибка теста: ' + e);
            }
        });

        // Send Action with Queue
        bot.action(/broadcast:send:(.+)/, async (ctx) => {
            const broadcastId = ctx.match[1];

            // Confirm first?
            // Using a mechanic of "Are you sure?"
            // We can just switch keyboard to "Confirm"

            await ctx.editMessageText(
                '⚠️ <b>Вы уверены, что хотите запустить рассылку?</b>\n\n' +
                'Это действие нельзя отменить. Сообщение уйдет всем пользователям.',
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('✅ ДА, ЗАПУСТИТЬ', `broadcast:confirm:${broadcastId}`)],
                        [Markup.button.callback('❌ Отмена', `broadcast:cancel_flow:${broadcastId}`)]
                    ])
                }
            );
        });

        // Final Confirm
        bot.action(/broadcast:confirm:(.+)/, async (ctx) => {
            const broadcastId = ctx.match[1];
            const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
            if (!broadcast) return ctx.reply('Рассылка не найдена.');

            // Initialize Targets
            let whereClause: any = { isBlocked: false };
            if (broadcast.targetType === 'BUYERS') {
                whereClause.orders = { some: { status: 'COMPLETED' } };
            } else if (broadcast.targetType === 'NON_BUYERS') {
                whereClause.orders = { none: { status: 'COMPLETED' } };
            }

            const usersCount = await prisma.user.count({ where: whereClause });
            if (usersCount === 0) return ctx.reply('Нет получателей для этой аудитории.');

            await ctx.editMessageText('⏳ <b>Подготовка получателей...</b>\n\nЭто может занять некоторое время.', { parse_mode: 'HTML' });

            // Populate targets FIRST to avoid race condition with worker
            try {
                await populateTargets(broadcastId, whereClause);
            } catch (e) {
                console.error('Target population error', e);
                return ctx.editMessageText('❌ Ошибка подготовки получателей.');
            }

            // Update status to PROCESSING to let the worker pick it up
            await prisma.broadcast.update({
                where: { id: broadcastId },
                data: {
                    status: 'PROCESSING',
                    totalRecipients: usersCount,
                    startedAt: new Date()
                }
            });

            await ctx.editMessageText(`🚀 <b>Рассылка запущена!</b>\n\nВсего получателей: ${usersCount}.\nПроцесс пошел. Бот уведомит вас о завершении.`, { parse_mode: 'HTML' });
        });

        // Back from confirm
        bot.action(/broadcast:cancel_flow:(.+)/, async (ctx) => {
            await ctx.deleteMessage(); // Or go back to menu, but delete is safer
        });

        // Audience Selector
        bot.action(/broadcast:audience:(.+)/, async (ctx) => {
            const broadcastId = ctx.match[1];
            await ctx.editMessageText(
                '👥 <b>Выберите аудиторию:</b>',
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('Все', `broadcast:set_target:${broadcastId}:ALL`)],
                        [Markup.button.callback('Только купившие', `broadcast:set_target:${broadcastId}:BUYERS`)],
                        [Markup.button.callback('Не купившие', `broadcast:set_target:${broadcastId}:NON_BUYERS`)],
                        [Markup.button.callback('🔙 Назад', `broadcast:back:${broadcastId}`)] // Handled by re-showing main menu logic
                    ])
                }
            );
        });

        bot.action(/broadcast:set_target:(.+):(.+)/, async (ctx) => {
            const [_, broadcastId, type] = ctx.match;
            await prisma.broadcast.update({ where: { id: broadcastId }, data: { targetType: type } });
            await ctx.answerCbQuery('Аудитория обновлена');

            // Go back to menu (duplicate logic, could refactor)
            // Check "Create Action" to see menu structure
            await ctx.editMessageText(
                `📝 <b>Черновик рассылки</b>\nТип: ${type}\n\nДействия:`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('🧪 Тест мне', `broadcast:test:${broadcastId}`)],
                        [Markup.button.callback('👥 Настроить аудиторию', `broadcast:audience:${broadcastId}`)],
                        [Markup.button.callback('🚀 ОТПРАВИТЬ ВСЕМ', `broadcast:send:${broadcastId}`)],
                        [Markup.button.callback('🗑 Удалить', `broadcast:delete:${broadcastId}`)]
                    ])
                }
            );
        });

    }
};

async function populateTargets(broadcastId: string, whereClause: any) {
    const users = await prisma.user.findMany({ where: whereClause, select: { id: true } });
    const BATCH = 5000;
    for (let i = 0; i < users.length; i += BATCH) {
        const batch = users.slice(i, i + BATCH);
        await prisma.broadcastTarget.createMany({
            data: batch.map(u => ({
                broadcastId,
                userId: u.id,
                status: 'PENDING'
            }))
        });
    }
}
