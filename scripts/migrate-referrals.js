import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';

const MONGO_URL = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';
const prisma = new PrismaClient();

async function migrateReferrals() {
    console.log('🚀 Starting Partner Referrals Migration...\n');

    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB\n');

    const mongoDb = mongoClient.db();

    try {
        // Get all MongoDB data
        const mongoReferrals = await mongoDb.collection('PartnerReferral').find().toArray();
        const mongoProfiles = await mongoDb.collection('PartnerProfile').find().toArray();
        const mongoUsers = await mongoDb.collection('User').find().toArray();

        console.log(`📊 Found ${mongoReferrals.length} referrals in MongoDB`);
        console.log(`   ${mongoProfiles.length} profiles`);
        console.log(`   ${mongoUsers.length} users\n`);

        // Build mappings
        const mongoUserMap = {};
        mongoUsers.forEach(u => {
            mongoUserMap[u._id.toString()] = u;
        });

        const mongoProfileMap = {};
        mongoProfiles.forEach(p => {
            mongoProfileMap[p._id.toString()] = p;
        });

        // Get all PG profiles
        const pgProfiles = await prisma.partnerProfile.findMany({
            include: { user: true }
        });

        // Build mapping: referralCode -> pgProfile
        const pgProfileByCode = {};
        pgProfiles.forEach(p => {
            pgProfileByCode[p.referralCode] = p;
        });

        // Build mapping: telegramId -> pgUser
        const pgUserByTelegramId = {};
        for (const profile of pgProfiles) {
            pgUserByTelegramId[profile.user.telegramId] = profile.user;
        }

        let success = 0;
        let skipped = 0;
        let errors = 0;

        console.log('📋 Migrating referrals...\n');

        for (const mr of mongoReferrals) {
            try {
                // Find the referrer's profile
                const mongoProfile = mongoProfileMap[mr.profileId];
                if (!mongoProfile) {
                    skipped++;
                    continue;
                }

                const pgProfile = pgProfileByCode[mongoProfile.referralCode];
                if (!pgProfile) {
                    skipped++;
                    continue;
                }

                // Find the referred user - use 'referredId' field from MongoDB
                const mongoUser = mongoUserMap[mr.referredId];
                if (!mongoUser) {
                    skipped++;
                    continue;
                }

                const pgUser = pgUserByTelegramId[String(mongoUser.telegramId)];
                if (!pgUser) {
                    skipped++;
                    continue;
                }

                // Create referral (Prisma schema uses referredId not userId)
                await prisma.partnerReferral.create({
                    data: {
                        profileId: pgProfile.id,
                        referredId: pgUser.id,
                        level: mr.level || 1,
                        referralType: mr.referralType || 'DIRECT',
                        createdAt: mr.createdAt ? new Date(mr.createdAt) : new Date()
                    }
                });

                success++;
                if (success % 25 === 0) process.stdout.write('.');
            } catch (err) {
                errors++;
                if (errors < 5) {
                    console.error(`\n❌ Error migrating referral:`, err.message);
                }
            }
        }

        console.log(`\n\n✅ Referrals: ${success} success, ${errors} errors, ${skipped} skipped\n`);

        // Recalculate partner counts
        console.log('🔄 Recalculating partner counts...\n');

        const allProfiles = await prisma.partnerProfile.findMany({
            include: {
                _count: {
                    select: { referrals: true }
                }
            }
        });

        let updated = 0;
        for (const profile of allProfiles) {
            const actualCount = profile._count.referrals;

            if (profile.totalPartners !== actualCount) {
                await prisma.partnerProfile.update({
                    where: { id: profile.id },
                    data: {
                        totalPartners: actualCount,
                        directPartners: actualCount // All are direct for now
                    }
                });
                updated++;
            }
        }

        console.log(`✅ Updated ${updated} partner counts\n`);

        console.log('═'.repeat(50));
        console.log('🎉 Migration Complete!');
        console.log('═'.repeat(50));
        console.log(`Referrals migrated: ${success}/${mongoReferrals.length}`);
        console.log(`Partner counts updated: ${updated}`);
        console.log('═'.repeat(50));

    } catch (error) {
        console.error('💥 Migration failed:', error);
    } finally {
        await mongoClient.close();
        await prisma.$disconnect();
    }
}

migrateReferrals().catch(e => {
    console.error('💥 Fatal Error:', e);
    process.exit(1);
});
