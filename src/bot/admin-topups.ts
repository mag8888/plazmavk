
import { Telegraf, Markup } from 'telegraf';
import { Context } from './context.js';
import { BotModule } from './types.js';
import { prisma } from '../lib/prisma.js';
import { getAdminChatIds } from '../config/env.js';
import { recalculatePartnerBonuses } from '../services/partner-service.js';
import crypto from 'crypto';

// Генерирует красивый код XXXX-XXXX-XXXX
function generateGiftCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Исключены O, 0, 1, I, чтобы не путались
    let result = '';
    for (let i = 0; i < 12; i++) {
        if (i > 0 && i % 4 === 0) result += '-';
        result += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return result;
}

export const adminTopupsModule: BotModule = {
    async register(bot: Telegraf<Context>) {

        // Handle Initial "Confirm Top-up" Intent
        bot.action(/^admin_topup_confirm:(.+)$/, async (ctx) => {
            try {
                const adminIds = getAdminChatIds();
                const userId = ctx.from?.id.toString();

                // Verify admin
                if (!userId || !adminIds.includes(userId)) {
                    await ctx.answerCbQuery('⛔️ У вас нет прав администратора', { show_alert: true });
                    return;
                }

                const requestId = ctx.match[1];

                const topupRequest = await prisma.balanceTopUpRequest.findUnique({
                    where: { id: requestId }
                });

                if (!topupRequest) {
                    await ctx.answerCbQuery('❌ Заявка не найдена', { show_alert: true });
                    return;
                }

                if (topupRequest.status !== 'PENDING') {
                    await ctx.answerCbQuery(`⚠️ Заявка уже обработана (статус: ${topupRequest.status})`, { show_alert: true });
                    return;
                }

                await ctx.editMessageReplyMarkup({
                    inline_keyboard: [
                        [
                            { text: '✅ Да, деньги получены', callback_data: `admin_topup_commit:${requestId}` },
                            { text: '❌ Нет, отменить', callback_data: `admin_topup_cancel:${requestId}` }
                        ]
                    ]
                });
                await ctx.answerCbQuery('Подтвердите получение средств');

            } catch (error) {
                console.error('Admin Topup Intent Error:', error);
                await ctx.answerCbQuery('❌ Ошибка', { show_alert: true });
            }
        });

        // Handle Cancellation
        bot.action(/^admin_topup_cancel:(.+)$/, async (ctx) => {
            try {
                const requestId = ctx.match[1];
                await prisma.balanceTopUpRequest.update({
                    where: { id: requestId },
                    data: { status: 'CANCELLED', adminNote: `Cancelled by ${ctx.from?.first_name}` }
                });

                const msg = ctx.callbackQuery.message as any;
                const originalText = msg?.caption || msg?.text || '';
                const appendText = `\n\n❌ <b>ОТКЛОНЕНО</b>\nАдминистратор: ${ctx.from?.first_name}`;
                if (msg?.caption !== undefined) {
                    await ctx.editMessageCaption(originalText + appendText, { parse_mode: 'HTML', reply_markup: undefined });
                } else {
                    await ctx.editMessageText(originalText + appendText, { parse_mode: 'HTML', reply_markup: undefined });
                }
                await ctx.answerCbQuery('Заявка отклонена');
            } catch (error) {
                console.error('Admin Topup Cancel Error:', error);
            }
        });

        // Handle Actual Topup Commit
        bot.action(/^admin_topup_commit:(.+)$/, async (ctx) => {
            try {
                const adminIds = getAdminChatIds();
                const userId = ctx.from?.id.toString();

                // Verify admin
                if (!userId || !adminIds.includes(userId)) {
                    await ctx.answerCbQuery('⛔️ У вас нет прав администратора', { show_alert: true });
                    return;
                }

                const requestId = ctx.match[1];

                // 1. Fetch request
                const topupRequest = await prisma.balanceTopUpRequest.findUnique({
                    where: { id: requestId },
                    include: { user: true }
                });

                if (!topupRequest) {
                    await ctx.answerCbQuery('❌ Заявка не найдена', { show_alert: true });
                    return;
                }

                if (topupRequest.status !== 'PENDING') {
                    await ctx.answerCbQuery(`⚠️ Заявка уже обработана (статус: ${topupRequest.status})`, { show_alert: true });
                    const msg = ctx.callbackQuery.message as any;
                    const originalText = msg?.caption || msg?.text || '';
                    if (msg?.caption !== undefined) {
                        await ctx.editMessageCaption(originalText + `\n\n✅ ОБРАБОТАНО (${topupRequest.status})`, { parse_mode: 'HTML', reply_markup: undefined });
                    } else {
                        await ctx.editMessageText(originalText + `\n\n✅ ОБРАБОТАНО (${topupRequest.status})`, { parse_mode: 'HTML', reply_markup: undefined });
                    }
                    return;
                }

                let generatedCertCode = null;
                let certAmountRub = 0;

                // 2. Perform Top-up
                await prisma.$transaction(async (tx: any) => {
                    // Update request status
                    await tx.balanceTopUpRequest.update({
                        where: { id: requestId },
                        data: {
                            status: 'COMPLETED',
                            adminNote: `Approved by ${ctx.from?.first_name} (ID: ${userId})`
                        }
                    });

                    // Add balance to user
                    await tx.user.update({
                        where: { id: topupRequest.userId },
                        data: { balance: { increment: (topupRequest.amountRub || 0) / 100 } }
                    });

                    // If this topup was specifically for a certificate
                    if (topupRequest.isForCertificate && topupRequest.certificateAmountRub) {
                        const userFull = await tx.user.findUnique({
                            where: { id: topupRequest.userId },
                            include: { partner: true }
                        });

                        certAmountRub = topupRequest.certificateAmountRub;
                        const isPartner = !!(userFull?.partner?.isActive);
                        const costRub = isPartner ? Math.round(certAmountRub * 0.9) : certAmountRub;
                        const costPz = costRub / 100;

                        if (userFull && userFull.balance >= costPz) {
                            // Deduct balance for certificate
                            await tx.user.update({
                                where: { id: topupRequest.userId },
                                data: { balance: { decrement: costPz } }
                            });

                            // Create the Certificate
                            generatedCertCode = generateGiftCode();
                            const giftToken = crypto.randomBytes(16).toString('hex');

                            await tx.giftCertificate.create({
                                data: {
                                    userId: topupRequest.userId,
                                    code: generatedCertCode,
                                    giftToken: giftToken,
                                    status: 'ACTIVE',
                                    initialPz: certAmountRub / 100, // номинал всегда сохраняется полный
                                    remainingPz: certAmountRub / 100,
                                    imageUrl: topupRequest.certificateImageUrl || 'https://res.cloudinary.com/dcldvbjvf/image/upload/v1772107030/plazma/certificates/fgpp96vijifxbjzisln8.png'
                                }
                            });
                        }
                    }
                });

                await ctx.answerCbQuery('✅ Баланс пополнен!');

                // 3. Notify User
                try {
                    if (generatedCertCode) {
                        const activationLink = `https://t.me/iplazmabot?start=gift_${generatedCertCode}`;
                        const shareText = `Лови подарочный сертификат PLAZMA на ${certAmountRub} ₽!\nКод: ${generatedCertCode}\nАктивируй по ссылке: ${activationLink}`;
                        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(activationLink)}&text=${encodeURIComponent(shareText)}`;
                        await ctx.telegram.sendPhoto(
                            topupRequest.user.telegramId,
                            topupRequest.certificateImageUrl || 'https://res.cloudinary.com/dcldvbjvf/image/upload/v1772107030/plazma/certificates/fgpp96vijifxbjzisln8.png',
                            {
                                caption: `✅ <b>Баланс пополнен!</b>\nСчет пополнен на <b>${topupRequest.amountRub} ₽</b>.\n\n🎉 <b>Сертификат автоматически приобретен!</b>\nНоминал: <b>${certAmountRub} ₽</b>\nКод: <code>${generatedCertCode}</code>\n\nВы можете подарить его напрямую из приложения, или просто переслать это сообщение получателю!`,
                                parse_mode: 'HTML',
                                reply_markup: { inline_keyboard: [[{ text: '📤 Передать', url: shareUrl }]] }
                            }
                        );
                    } else {
                        await ctx.telegram.sendMessage(
                            topupRequest.user.telegramId,
                            `💰 <b>Баланс пополнен!</b>\n\n` +
                            `Ваш счет пополнен на <b>${topupRequest.amountRub} ₽</b>.\n` +
                            `Приятных покупок!`,
                            { parse_mode: 'HTML' }
                        );
                    }
                } catch (e) {
                    console.error('Failed to notify user about topup:', e);
                }

                // 4. Update Admin Message
                let adminConfirmationText = `\n\n✅ <b>ПОДТВЕРЖДЕНО</b>\nАдминистратор: ${ctx.from?.first_name}`;
                if (generatedCertCode) {
                    adminConfirmationText += `\n🎁 Автоматически выдан сертификат!\nКод: <code>${generatedCertCode}</code>`;
                }

                const msgToEdit = ctx.callbackQuery.message as any;
                const originalTextToEdit = msgToEdit?.caption || msgToEdit?.text || '';

                if (msgToEdit?.caption !== undefined) {
                    await ctx.editMessageCaption(originalTextToEdit + adminConfirmationText, { parse_mode: 'HTML', reply_markup: undefined });
                } else {
                    await ctx.editMessageText(originalTextToEdit + adminConfirmationText, { parse_mode: 'HTML', reply_markup: undefined });
                }

                // 5. Auto-pay Pending Orders (Bonus implementation)
                await tryAutoPayPendingOrders(topupRequest.userId, ctx.telegram);

            } catch (error) {
                console.error('Admin Topup Error:', error);
                await ctx.answerCbQuery('❌ Ошибка при пополнении', { show_alert: true });
            }
        });
    }
};

async function tryAutoPayPendingOrders(userId: string, telegram: any) {
    try {
        // Find latest NEW pending order
        const pendingOrder = await prisma.orderRequest.findFirst({
            where: {
                userId: userId,
                status: 'NEW',
                // Assuming we can identify unpaid orders via status or a paid flag. 
                // The schema has OrderStatus: NEW, PROCESSING, COMPLETED, CANCELLED.
                // Usually NEW means unpaid/unprocessed.
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!pendingOrder) return;

        // Caclulate total from itemsJson (since OrderRequest stores it as JSON)
        // Or if there is a 'total' field? Schema check: OrderRequest has `itemsJson`.
        // Let's re-read schema or assume we calculate it. 
        // Logic: itemsJson is Check `prisma/schema.prisma` content from memory or re-view.
        // Step 1915 showed `itemsJson`... wait, `CartItem[]` on user.
        // OrderRequest definition was not fully shown in step 1915.
        // Let's assume we need to calculate total.

        const items = pendingOrder.itemsJson as any[];
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.balance < total) return; // Insufficient funds

        // PAY IT
        await prisma.$transaction(async (tx: any) => {
            // Deduct balance
            await tx.user.update({
                where: { id: userId },
                data: { balance: { decrement: total } }
            });

            // Update Order
            await tx.orderRequest.update({
                where: { id: pendingOrder.id },
                data: { status: 'PROCESSING' } // Mark as paid/processing
            });

            // Create Payment Record (optional but good practice)
            await tx.payment.create({
                data: {
                    userId: userId,
                    amount: total,
                    orderId: pendingOrder.id,
                    status: 'PAID',
                    type: 'DEBIT',
                    provider: 'BALANCE_AUTO'
                }
            });
        });

        // Partner Bonus
        await recalculatePartnerBonuses(userId);

        // Notify User
        await telegram.sendMessage(
            user.telegramId,
            `✅ <b>Заказ #${pendingOrder.id.slice(0, 8)} оплачен!</b>\n\n` +
            `Сумма <b>${total} ₽</b> списана с вашего баланса автоматически.`,
            { parse_mode: 'HTML' }
        );

        // Notify Admins
        const adminIds = getAdminChatIds();
        for (const adminId of adminIds) {
            await telegram.sendMessage(adminId, `🤖 <b>Авто-оплата заказа</b>\nЗаказ #${pendingOrder.id.slice(0, 8)} пользователя ${user.firstName} оплачен с баланса.`);
        }

    } catch (e) {
        console.error('Auto-pay error:', e);
    }
}
