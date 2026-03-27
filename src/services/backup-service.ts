/**
 * Internal Backup Service
 * 
 * Exports all database tables as JSON and uploads to Cloudinary.
 * Scheduled daily via node-cron, also available via admin API.
 */

import { prisma } from '../lib/prisma.js';
import { uploadImage, isCloudinaryConfigured, listCloudinaryResources, cloudinary } from './cloudinary-service.js';

// Lazy imports to avoid crashing when BOT_TOKEN is not set
async function getNotificationDeps() {
    try {
        const { getAdminChatIds } = await import('../config/env.js');
        const { getBotInstance } = await import('../lib/bot-instance.js');
        return { getAdminChatIds, getBotInstance };
    } catch {
        return null;
    }
}

export interface BackupResult {
    success: boolean;
    timestamp: string;
    sizeBytes: number;
    tablesCount: number;
    totalRecords: number;
    cloudinaryUrl?: string;
    cloudinaryPublicId?: string;
    error?: string;
    duration: number; // ms
}

export interface BackupInfo {
    publicId: string;
    url: string;
    createdAt: string;
    sizeBytes: number;
}

/**
 * Export all database tables and upload as JSON to Cloudinary
 */
export async function createBackup(): Promise<BackupResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    try {
        console.log(`📦 Starting database backup [${timestamp}]...`);

        // Export all tables
        const [
            users,
            products,
            categories,
            orders,
            cartItems,
            partners,
            referrals,
            transactions,
            activationHistory,
            certificates,
            certificateTypes,
            specialists,
            specialistCategories,
            specialistSpecialties,
            specialistServices,
            reviews,
            payments,
            promotions,
            broadcasts,
            broadcastTargets,
            botContents,
            messageTemplates,
            settings,
            audioFiles,
            mediaFiles,
            balanceTopups,
            userHistory,
            regions,
            b2bPartners,
            b2bCertificateIssues,
        ] = await Promise.all([
            prisma.user.findMany(),
            prisma.product.findMany(),
            prisma.category.findMany(),
            prisma.orderRequest.findMany(),
            prisma.cartItem.findMany(),
            prisma.partnerProfile.findMany(),
            prisma.partnerReferral.findMany(),
            prisma.partnerTransaction.findMany(),
            prisma.partnerActivationHistory.findMany(),
            prisma.giftCertificate.findMany(),
            prisma.certificateType.findMany(),
            prisma.specialist.findMany(),
            prisma.specialistCategory.findMany(),
            prisma.specialistSpecialty.findMany(),
            prisma.specialistService.findMany(),
            prisma.review.findMany(),
            prisma.payment.findMany(),
            prisma.promotion.findMany(),
            prisma.broadcast.findMany(),
            prisma.broadcastTarget.findMany(),
            prisma.botContent.findMany(),
            prisma.messageTemplate.findMany(),
            prisma.settings.findMany(),
            prisma.audioFile.findMany(),
            prisma.mediaFile.findMany(),
            prisma.balanceTopUpRequest.findMany(),
            prisma.userHistory.findMany({ take: 10000, orderBy: { createdAt: 'desc' } }),
            prisma.region.findMany(),
            (prisma as any).b2BPartner.findMany(),
            (prisma as any).b2BCertificateIssue.findMany(),
        ]);

        const data: Record<string, any[]> = {
            users,
            products,
            categories,
            orders,
            cartItems,
            partners,
            referrals,
            transactions,
            activationHistory,
            certificates,
            certificateTypes,
            specialists,
            specialistCategories,
            specialistSpecialties,
            specialistServices,
            reviews,
            payments,
            promotions,
            broadcasts,
            broadcastTargets,
            botContents,
            messageTemplates,
            settings,
            audioFiles,
            mediaFiles,
            balanceTopups,
            userHistory,
            regions,
            b2bPartners,
            b2bCertificateIssues,
        };

        const totalRecords = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
        const tablesCount = Object.keys(data).length;

        // Build JSON
        const backup = {
            meta: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                tablesCount,
                totalRecords,
                tables: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
            },
            data,
        };

        const jsonStr = JSON.stringify(backup);
        const sizeBytes = Buffer.byteLength(jsonStr, 'utf-8');

        console.log(`  📊 ${tablesCount} tables, ${totalRecords} records, ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);

        // Upload to Cloudinary
        if (!isCloudinaryConfigured()) {
            return {
                success: false,
                timestamp,
                sizeBytes,
                tablesCount,
                totalRecords,
                error: 'Cloudinary not configured',
                duration: Date.now() - startTime,
            };
        }

        const buffer = Buffer.from(jsonStr, 'utf-8');
        const result = await uploadImage(buffer, {
            folder: 'plazma/backups',
            publicId: `backup-${timestamp}`,
            resourceType: 'raw',
            format: 'json',
        });

        const duration = Date.now() - startTime;
        console.log(`  ✅ Backup uploaded: ${result.secureUrl} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB, ${duration}ms)`);

        // Notify admins via bot
        try {
            const deps = await getNotificationDeps();
            if (deps) {
                const bot = await deps.getBotInstance();
                if (bot) {
                    const adminIds = deps.getAdminChatIds();
                    const msg = `💾 <b>Бэкап базы данных</b>\n\n` +
                        `📅 ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU')}\n` +
                        `📊 ${tablesCount} таблиц, ${totalRecords} записей\n` +
                        `💿 ${(sizeBytes / 1024 / 1024).toFixed(2)} MB\n` +
                        `⏱ ${(duration / 1000).toFixed(1)}s\n` +
                        `✅ Загружено в Cloudinary`;
                    for (const adminId of adminIds) {
                        try {
                            await bot.telegram.sendMessage(adminId, msg, { parse_mode: 'HTML' });
                        } catch (_) { /* ignore send errors */ }
                    }
                }
            }
        } catch (_) { /* ignore notification errors */ }

        return {
            success: true,
            timestamp,
            sizeBytes,
            tablesCount,
            totalRecords,
            cloudinaryUrl: result.secureUrl,
            cloudinaryPublicId: result.publicId,
            duration,
        };

    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error(`❌ Backup failed:`, error);
        return {
            success: false,
            timestamp,
            sizeBytes: 0,
            tablesCount: 0,
            totalRecords: 0,
            error: error.message,
            duration,
        };
    }
}

/**
 * List existing backups from Cloudinary
 */
export async function listBackups(): Promise<BackupInfo[]> {
    if (!isCloudinaryConfigured()) return [];

    try {
        const resources = await listCloudinaryResources('plazma/backups', 'raw', 50);
        return resources
            .filter(r => r.public_id.includes('backup-'))
            .map(r => ({
                publicId: r.public_id,
                url: r.secure_url,
                createdAt: r.created_at || '',
                sizeBytes: r.bytes || 0,
            }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
        console.error('Failed to list backups:', error);
        return [];
    }
}

/**
 * Delete old backups, keeping only the latest N
 */
export async function cleanupOldBackups(keepCount: number = 7): Promise<number> {
    const backups = await listBackups();
    if (backups.length <= keepCount) return 0;

    const toDelete = backups.slice(keepCount);
    let deleted = 0;

    for (const backup of toDelete) {
        try {
            await cloudinary.uploader.destroy(backup.publicId, { resource_type: 'raw' });
            deleted++;
            console.log(`  🗑 Deleted old backup: ${backup.publicId}`);
        } catch (_) { /* ignore */ }
    }

    return deleted;
}
