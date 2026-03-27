import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';

const MONGO_URL = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';
const prisma = new PrismaClient();

async function migratePartnerDataFixed() {
    console.log('🚀 Starting FIXED Partner Data Migration...\\n');

    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB\\n');

    const mongoDb = mongoClient.db();

    try {
        // === STEP 1: Migrate PartnerProfile ===
        console.log('📋 Step 1: Migrating Partner Profiles...');
        const partnerProfiles = await mongoDb.collection('PartnerProfile').find().toArray();
        const mongoUsers = await mongoDb.collection('User').find().toArray();
        console.log(`Found ${partnerProfiles.length} partner profiles`);
        console.log(`Found ${mongoUsers.length} users in MongoDB\\n`);

        // Create mapping of mongoUserId -> User object
        const mongoUserMap = {};
        mongoUsers.forEach(u => {
            mongoUserMap[u._id.toString()] = u;
        });

        let profileSuccess = 0;
        let profileErrors = 0;
        let profileSkipped = 0;

        for (const mp of partnerProfiles) {
            try {
                const mongoUser = mongoUserMap[mp.userId];
                if (!mongoUser) {
                    console.log(`⚠️  No mongo user found for profile ${mp._id.toString()}`);
                    profileSkipped++;
                    continue;
                }

                // Find PostgreSQL user by telegramId
                const pgUser = await prisma.user.findUnique({
                    where: { telegramId: String(mongoUser.telegramId) }
                });

                if (!pgUser) {
                    console.log(`⚠️  No PG user found for telegramId ${mongoUser.telegramId}`);
                    profileSkipped++;
                    continue;
                }

                // Check if profile already exists for this user
                const existingProfile = await prisma.partnerProfile.findUnique({
                    where: { userId: pgUser.id }
                });

                if (existingProfile) {
                    // Update existing profile
                    await prisma.partnerProfile.update({
                        where: { userId: pgUser.id },
                        data: {
                            isActive: mp.isActive || false,
                            activatedAt: mp.activatedAt ? new Date(mp.activatedAt) : null,
                            expiresAt: mp.expiresAt ? new Date(mp.expiresAt) : null,
                            activationType: mp.activationType || null,
                            programType: mp.programType || 'DIRECT',
                            referralCode: mp.referralCode,
                            referralDirectQrUrl: mp.referralDirectQrUrl || null,
                            referralMultiQrUrl: mp.referralMultiQrUrl || null,
                            balance: mp.balance || 0,
                            bonus: mp.bonus || 0,
                            totalPartners: mp.totalPartners || 0,
                            directPartners: mp.directPartners || 0,
                            multiPartners: mp.multiPartners || 0,
                            updatedAt: mp.updatedAt ? new Date(mp.updatedAt) : new Date()
                        }
                    });
                } else {
                    // Create new profile
                    await prisma.partnerProfile.create({
                        data: {
                            userId: pgUser.id,
                            isActive: mp.isActive || false,
                            activatedAt: mp.activatedAt ? new Date(mp.activatedAt) : null,
                            expiresAt: mp.expiresAt ? new Date(mp.expiresAt) : null,
                            activationType: mp.activationType || null,
                            programType: mp.programType || 'DIRECT',
                            referralCode: mp.referralCode,
                            referralDirectQrUrl: mp.referralDirectQrUrl || null,
                            referralMultiQrUrl: mp.referralMultiQrUrl || null,
                            balance: mp.balance || 0,
                            bonus: mp.bonus || 0,
                            totalPartners: mp.totalPartners || 0,
                            directPartners: mp.directPartners || 0,
                            multiPartners: mp.multiPartners || 0,
                            createdAt: mp.createdAt ? new Date(mp.createdAt) : new Date(),
                            updatedAt: mp.updatedAt ? new Date(mp.updatedAt) : new Date()
                        }
                    });
                }

                profileSuccess++;
                if (profileSuccess % 10 === 0) process.stdout.write('.');
            } catch (err) {
                profileErrors++;
                console.error(`\\n❌ Error migrating profile ${mp._id}:`, err.message);
            }
        }

        console.log(`\\n✅ Profiles: ${profileSuccess} success, ${profileErrors} errors, ${profileSkipped} skipped\\n`);

        // === Summary ===
        console.log('═'.repeat(50));
        console.log('🎉 Migration Complete!');
        console.log('═'.repeat(50));
        console.log(`Partner Profiles:  ${profileSuccess}/${partnerProfiles.length}`);
        console.log(`Total Balance will be preserved`);
        console.log('═'.repeat(50));

    } catch (error) {
        console.error('💥 Migration failed:', error);
    } finally {
        await mongoClient.close();
        await prisma.$disconnect();
    }
}

migratePartnerDataFixed().catch(e => {
    console.error('💥 Fatal Error:', e);
    process.exit(1);
});
