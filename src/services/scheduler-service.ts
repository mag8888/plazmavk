import cron from 'node-cron';
import { checkExpiringPartners } from './partner-service.js';
import { getBotInstance } from '../lib/bot-instance.js';
import { prisma } from '../lib/prisma.js';
import { createBackup, cleanupOldBackups } from './backup-service.js';

export class SchedulerService {
    private jobs: cron.ScheduledTask[] = [];

    constructor() { }

    public initialize() {
        console.log('⏰ Initializing Scheduler Service...');

        // Run every day at 10:00 AM — partner expiration check
        this.scheduleJob('0 10 * * *', async () => {
            console.log('⏰ Running daily partner expiration check...');
            try {
                await this.handlePartnerExpirationNotifications();
            } catch (error) {
                console.error('❌ Error in partner expiration check:', error);
            }
        });

        // Run every day at 3:00 AM — database backup
        this.scheduleJob('0 3 * * *', async () => {
            console.log('💾 Running scheduled database backup...');
            try {
                const result = await createBackup();
                if (result.success) {
                    console.log(`✅ Scheduled backup complete: ${result.totalRecords} records, ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
                    // Keep only last 7 backups
                    await cleanupOldBackups(7);
                } else {
                    console.error('❌ Scheduled backup failed:', result.error);
                }
            } catch (error) {
                console.error('❌ Error in scheduled backup:', error);
            }
        });

        console.log(`✅ Scheduler Service initialized with ${this.jobs.length} jobs.`);
    }

    private scheduleJob(cronExpression: string, task: () => Promise<void>) {
        const job = cron.schedule(cronExpression, task, {
            scheduled: true,
            timezone: "Europe/Moscow"
        });
        this.jobs.push(job);
    }

    private async handlePartnerExpirationNotifications() {
        const notifications = await checkExpiringPartners();

        if (notifications.length === 0) {
            console.log('✅ No partners expiring in 10, 3, or 1 days.');
            return;
        }

        console.log(`📢 Sending expiration notifications to ${notifications.length} partners.`);

        const bot = await getBotInstance();
        if (!bot) {
            console.warn('⚠️ Bot instance not available for notifications.');
            return;
        }

        for (const note of notifications) {
            if (!note.telegramId) {
                console.warn(`⚠️ User ${note.userId} has no telegramId, skipping notification.`);
                continue;
            }

            const daysText = note.daysLeft === 1 ? '1 день' : `${note.daysLeft} дней`;
            const dateStr = note.expiresAt ? new Date(note.expiresAt).toLocaleDateString('ru-RU') : 'неизвестно';

            let message = '';
            if (note.daysLeft === 10) {
                message = `⚠️ <b>Внимание! Истекает срок партнёрской программы</b>\n\n` +
                    `До окончания действия вашей партнёрской программы (15%) осталось <b>10 дней</b> (до ${dateStr}).\n\n` +
                    `Чтобы сохранить статус партнёра и продолжать получать 15% с рекомендаций, сделайте покупку на 12 000 ₽ до окончания срока.`;
            } else if (note.daysLeft === 3) {
                message = `⚠️ <b>Осталось 3 дня!</b>\n\n` +
                    `Ваша партнёрская программа истекает ${dateStr}.\n\n` +
                    `Не упустите 15% бонус с рекомендаций! Для продления сделайте покупку на 12 000 ₽.`;
            } else if (note.daysLeft === 1) {
                message = `🚨 <b>Последний день партнёрской программы!</b>\n\n` +
                    `Завтра ваша партнёрская программа (15%) будет деактивирована.\n\n` +
                    `Сделайте заказ на 12 000 ₽ сегодня, чтобы продлить статус на 2 месяца и сохранить все бонусы!`;
            }

            try {
                await bot.telegram.sendMessage(note.telegramId, message, { parse_mode: 'HTML' });
                console.log(`✅ Notification sent to ${note.telegramId} (days left: ${note.daysLeft})`);
            } catch (err) {
                console.error(`❌ Failed to send notification to ${note.telegramId}:`, err);
            }
        }
    }
}

export const schedulerService = new SchedulerService();
