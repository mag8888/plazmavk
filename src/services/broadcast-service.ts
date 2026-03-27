
import { prisma } from '../lib/prisma.js';
import { getBotInstance } from '../lib/bot-instance.js';
import { Markup } from 'telegraf';

const BATCH_SIZE = 50; // Process 50 users at a time
const PROCESSING_INTERVAL = 2000; // Run every 2 seconds

export class BroadcastService {
    private isProcessing = false;

    constructor() {
        // Start the worker loop
        setInterval(() => this.processQueue(), PROCESSING_INTERVAL);
    }

    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 1. Find active broadcasts (PROCESSING status)
            const activeBroadcasts = await prisma.broadcast.findMany({
                where: { status: 'PROCESSING' },
                select: { id: true, message: true, photoUrl: true, buttonText: true, buttonUrl: true, sourceMessageId: true, sourceChatId: true, sentCount: true, failedCount: true, totalRecipients: true }
            });

            if (activeBroadcasts.length === 0) {
                this.isProcessing = false;
                return;
            }

            const bot = await getBotInstance();

            for (const broadcast of activeBroadcasts) {
                // 2. Atomically claim pending targets to prevent duplicate sends
                // across multiple instances/workers
                const pendingTargets = await prisma.broadcastTarget.findMany({
                    where: { broadcastId: broadcast.id, status: 'PENDING' },
                    select: { id: true },
                    take: BATCH_SIZE
                });

                if (pendingTargets.length === 0) {
                    // No more pending targets, mark broadcast as COMPLETED
                    await prisma.broadcast.update({
                        where: { id: broadcast.id },
                        data: { status: 'COMPLETED', completedAt: new Date() }
                    });
                    // Completion notification handled below - skip to next broadcast
                    continue;
                }

                // Atomically mark as SENDING so no other worker picks them up
                const targetIds = pendingTargets.map(t => t.id);
                await prisma.broadcastTarget.updateMany({
                    where: { id: { in: targetIds }, status: 'PENDING' }, // double-check status
                    data: { status: 'SENDING' }
                });

                // Fetch updated targets with user info (only ones we just claimed)
                const targets = await prisma.broadcastTarget.findMany({
                    where: { id: { in: targetIds }, status: 'SENDING' },
                    include: { user: { select: { id: true, telegramId: true, isBlocked: true, firstName: true } } },
                });

                // 3. Process claimed batch in parallel
                let batchSent = 0;
                let batchFailed = 0;

                await Promise.all(targets.map(async (target: any) => {
                    // Skip if user is known to be blocked
                    if (target.user.isBlocked) {
                        await prisma.broadcastTarget.update({
                            where: { id: target.id },
                            data: { status: 'FAILED', error: 'User blocked bot previously' }
                        });
                        await prisma.broadcast.update({
                            where: { id: broadcast.id },
                            data: { failedCount: { increment: 1 } }
                        });
                        batchFailed++;
                        return;
                    }

                    try {

                        const extra: any = { parse_mode: 'Markdown' };
                        if (broadcast.buttonText && broadcast.buttonUrl) {
                            extra.reply_markup = {
                                inline_keyboard: [[{ text: broadcast.buttonText, url: broadcast.buttonUrl }]]
                            };
                        }

                        // Send message
                        if (broadcast.sourceMessageId && broadcast.sourceChatId) {
                            // Use copyMessage for forwarded content (preserves style, media, entities)
                            await bot.telegram.copyMessage(target.user.telegramId, broadcast.sourceChatId, broadcast.sourceMessageId, {
                                ...extra
                            });
                        } else if (broadcast.photoUrl) {
                            let photoInput: any = broadcast.photoUrl;
                            if (!broadcast.photoUrl.startsWith('http')) {
                                photoInput = { source: broadcast.photoUrl };
                            }

                            await bot.telegram.sendPhoto(target.user.telegramId, photoInput, {
                                caption: broadcast.message,
                                ...extra
                            });
                        } else {
                            await bot.telegram.sendMessage(target.user.telegramId, broadcast.message, extra);
                        }

                        // Success
                        await prisma.broadcastTarget.update({
                            where: { id: target.id },
                            data: { status: 'SENT', sentAt: new Date() }
                        });

                        await prisma.broadcast.update({
                            where: { id: broadcast.id },
                            data: { sentCount: { increment: 1 } }
                        });
                        batchSent++;

                    } catch (error: any) {
                        const errorMsg = error.message || String(error);
                        const isBlocked = errorMsg.includes('blocked') || errorMsg.includes('Forbidden: bot was blocked');

                        // Mark user as blocked if detected
                        if (isBlocked) {
                            await prisma.user.update({
                                where: { id: target.user.id },
                                data: { isBlocked: true }
                            });
                        }

                        await prisma.broadcastTarget.update({
                            where: { id: target.id },
                            data: { status: 'FAILED', error: errorMsg }
                        });

                        await prisma.broadcast.update({
                            where: { id: broadcast.id },
                            data: { failedCount: { increment: 1 } }
                        });
                        batchFailed++;
                    }
                }));

                // Optional: Notify progress every N users (e.g. 100)
                // We use current sentCount from DB + batchSent
                const currentTotal = broadcast.sentCount + broadcast.failedCount + batchSent + batchFailed;
                if (currentTotal > 0 && currentTotal % 100 === 0 && broadcast.sourceChatId) {
                    await bot.telegram.sendMessage(
                        broadcast.sourceChatId,
                        `📊 <b>Рассылка:</b> обработано ${currentTotal} из ${broadcast.totalRecipients || '?'}`,
                        { parse_mode: 'HTML' }
                    ).catch(() => { });
                }
            }

        } catch (error) {
            console.error('❌ Broadcast Worker Error:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    async sendTestBroadcast(adminTelegramId: string | number, opts: { message: string, photo?: Express.Multer.File, buttonText?: string, buttonUrl?: string, sourceMessageId?: number, sourceChatId?: string }) {
        const bot = await getBotInstance();
        const extra: any = { parse_mode: 'Markdown' };

        if (opts.buttonText && opts.buttonUrl) {
            extra.reply_markup = {
                inline_keyboard: [[{ text: opts.buttonText, url: opts.buttonUrl }]]
            };
        }

        try {
            if (opts.sourceMessageId && opts.sourceChatId) {
                await bot.telegram.copyMessage(adminTelegramId, opts.sourceChatId, opts.sourceMessageId, {
                    ...extra
                });
            } else if (opts.photo) {
                await bot.telegram.sendPhoto(adminTelegramId, { source: opts.photo.path }, {
                    caption: opts.message,
                    ...extra
                });
            } else {
                await bot.telegram.sendMessage(adminTelegramId, opts.message, extra);
            }
        } catch (e) {
            console.error('Test broadcast failed:', e);
            throw e;
        }
    }
}

// Singleton instance
export const broadcastService = new BroadcastService();
