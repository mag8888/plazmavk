/**
 * Cloudinary Migration Script
 * Migrates all images from old cloud (dt4r1tigf) to new cloud (dcldvbjvf)
 * 
 * Usage: npx tsx scripts/migrate-cloudinary.ts
 * 
 * Reads all imageUrl/photoUrl fields from DB, downloads from old cloud,
 * re-uploads to new cloud, and updates DB records.
 */

import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

const OLD_CLOUD = 'dt4r1tigf';
const NEW_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || 'dcldvbjvf';

// Configure new Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcldvbjvf',
    api_key: process.env.CLOUDINARY_API_KEY || '953284994966623',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'H7UkkarRVXwHw57XMHhtS0gJpG0',
    secure: true,
});

const prisma = new PrismaClient();

interface MigrationRecord {
    model: string;
    id: string;
    field: string;
    oldUrl: string;
    newUrl?: string;
    status: 'pending' | 'migrated' | 'skipped' | 'failed';
    error?: string;
}

const results: MigrationRecord[] = [];

/**
 * Upload an image from URL to new Cloudinary
 */
async function reUpload(oldUrl: string, folder: string): Promise<string> {
    const result = await cloudinary.uploader.upload(oldUrl, {
        folder,
        resource_type: 'auto',
    });
    return result.secure_url;
}

/**
 * Migrate a single URL field for a model
 */
async function migrateRecord(
    model: string,
    id: string,
    field: string,
    oldUrl: string,
    folder: string,
    updateFn: (id: string, newUrl: string) => Promise<void>
) {
    const record: MigrationRecord = { model, id, field, oldUrl, status: 'pending' };
    results.push(record);

    // Skip if not from old cloud
    if (!oldUrl.includes(OLD_CLOUD)) {
        record.status = 'skipped';
        return;
    }

    try {
        const newUrl = await reUpload(oldUrl, folder);
        await updateFn(id, newUrl);
        record.newUrl = newUrl;
        record.status = 'migrated';
        console.log(`  ✅ ${model}#${id.slice(0, 8)} ${field}: migrated`);
    } catch (err: any) {
        record.status = 'failed';
        record.error = err.message;
        console.error(`  ❌ ${model}#${id.slice(0, 8)} ${field}: ${err.message}`);
    }
}

async function main() {
    console.log(`\n🔄 Cloudinary Migration: ${OLD_CLOUD} → ${NEW_CLOUD}\n`);

    // 1. Products
    console.log('📦 Products...');
    const products = await prisma.product.findMany({ where: { imageUrl: { not: null } } });
    for (const p of products) {
        if (p.imageUrl) {
            await migrateRecord('Product', p.id, 'imageUrl', p.imageUrl, 'plazma/products', async (id, url) => {
                await prisma.product.update({ where: { id }, data: { imageUrl: url } });
            });
        }
    }

    // 2. Categories
    console.log('📂 Categories...');
    const categories = await prisma.category.findMany({ where: { imageUrl: { not: null } } });
    for (const c of categories) {
        if (c.imageUrl) {
            await migrateRecord('Category', c.id, 'imageUrl', c.imageUrl, 'plazma/categories', async (id, url) => {
                await prisma.category.update({ where: { id }, data: { imageUrl: url } });
            });
        }
    }

    // 3. CertificateType
    console.log('🎟 CertificateTypes...');
    const certTypes = await prisma.certificateType.findMany({ where: { imageUrl: { not: null } } });
    for (const ct of certTypes) {
        if (ct.imageUrl) {
            await migrateRecord('CertificateType', ct.id, 'imageUrl', ct.imageUrl, 'plazma/certificates', async (id, url) => {
                await prisma.certificateType.update({ where: { id }, data: { imageUrl: url } });
            });
        }
    }

    // 4. GiftCertificate
    console.log('🎁 GiftCertificates...');
    const certs = await prisma.giftCertificate.findMany({ where: { imageUrl: { not: null } } });
    for (const c of certs) {
        if (c.imageUrl) {
            await migrateRecord('GiftCertificate', c.id, 'imageUrl', c.imageUrl, 'plazma/certificates', async (id, url) => {
                await prisma.giftCertificate.update({ where: { id }, data: { imageUrl: url } });
            });
        }
    }

    // 5. Specialists
    console.log('👨‍⚕️ Specialists...');
    const specialists = await prisma.specialist.findMany({ where: { photoUrl: { not: null } } });
    for (const s of specialists) {
        if (s.photoUrl) {
            await migrateRecord('Specialist', s.id, 'photoUrl', s.photoUrl, 'plazma/specialists', async (id, url) => {
                await prisma.specialist.update({ where: { id }, data: { photoUrl: url } });
            });
        }
    }

    // 6. Reviews
    console.log('⭐ Reviews...');
    const reviews = await prisma.review.findMany({ where: { photoUrl: { not: null } } });
    for (const r of reviews) {
        if (r.photoUrl) {
            await migrateRecord('Review', r.id, 'photoUrl', r.photoUrl, 'plazma/reviews', async (id, url) => {
                await prisma.review.update({ where: { id }, data: { photoUrl: url } });
            });
        }
    }

    // 7. Promotions
    console.log('📣 Promotions...');
    const promos = await prisma.promotion.findMany({ where: { imageUrl: { not: null } } });
    for (const p of promos) {
        if (p.imageUrl) {
            await migrateRecord('Promotion', p.id, 'imageUrl', p.imageUrl, 'plazma/promotions', async (id, url) => {
                await prisma.promotion.update({ where: { id }, data: { imageUrl: url } });
            });
        }
    }

    // 8. Broadcasts
    console.log('📡 Broadcasts...');
    const broadcasts = await prisma.broadcast.findMany({ where: { photoUrl: { not: null } } });
    for (const b of broadcasts) {
        if (b.photoUrl) {
            await migrateRecord('Broadcast', b.id, 'photoUrl', b.photoUrl, 'plazma/broadcasts', async (id, url) => {
                await prisma.broadcast.update({ where: { id }, data: { photoUrl: url } });
            });
        }
    }

    // 9. MessageTemplates
    console.log('📝 MessageTemplates...');
    const templates = await prisma.messageTemplate.findMany({ where: { photoUrl: { not: null } } });
    for (const t of templates) {
        if (t.photoUrl) {
            await migrateRecord('MessageTemplate', t.id, 'photoUrl', t.photoUrl, 'plazma/templates', async (id, url) => {
                await prisma.messageTemplate.update({ where: { id }, data: { photoUrl: url } });
            });
        }
    }

    // 10. PartnerProfile (QR codes)
    console.log('🤝 PartnerProfiles (QR)...');
    const partners = await prisma.partnerProfile.findMany({
        where: {
            OR: [
                { referralDirectQrUrl: { not: null } },
                { referralMultiQrUrl: { not: null } },
            ]
        }
    });
    for (const p of partners) {
        if (p.referralDirectQrUrl?.includes(OLD_CLOUD)) {
            await migrateRecord('PartnerProfile', p.id, 'referralDirectQrUrl', p.referralDirectQrUrl, 'plazma/qr', async (id, url) => {
                await prisma.partnerProfile.update({ where: { id }, data: { referralDirectQrUrl: url } });
            });
        }
        if (p.referralMultiQrUrl?.includes(OLD_CLOUD)) {
            await migrateRecord('PartnerProfile', p.id, 'referralMultiQrUrl', p.referralMultiQrUrl, 'plazma/qr', async (id, url) => {
                await prisma.partnerProfile.update({ where: { id }, data: { referralMultiQrUrl: url } });
            });
        }
    }

    // Summary
    const migrated = results.filter(r => r.status === 'migrated').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const total = results.length;

    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 Migration complete!`);
    console.log(`   Total: ${total} | ✅ Migrated: ${migrated} | ⏭ Skipped: ${skipped} | ❌ Failed: ${failed}`);

    if (failed > 0) {
        console.log(`\n❌ Failed records:`);
        results.filter(r => r.status === 'failed').forEach(r => {
            console.log(`   ${r.model}#${r.id.slice(0, 8)} ${r.field}: ${r.error}`);
        });
    }

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error('Migration failed:', e);
    await prisma.$disconnect();
    process.exit(1);
});
