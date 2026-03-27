
import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';

const prisma = new PrismaClient();
const MONGO_URI = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';

// Mongo Schemas (Loose)
const UserSchema = new mongoose.Schema({}, { strict: false });
const UserMongo = mongoose.model('User', UserSchema, 'User');
const PartnerProfileMongo = mongoose.model('PartnerProfile', UserSchema, 'PartnerProfile');
const PartnerReferralMongo = mongoose.model('PartnerReferral', UserSchema, 'PartnerReferral');

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected to Mongo.');

        console.log('Fetching Mongo data...');
        const mongoUsers = await UserMongo.find({});
        const mongoProfiles = await PartnerProfileMongo.find({});
        const mongoReferrals = await PartnerReferralMongo.find({});

        console.log(`Found ${mongoUsers.length} users, ${mongoProfiles.length} profiles, ${mongoReferrals.length} referrals in Mongo.`);

        // --- Phase 1: Sync Users ---
        console.log('\n--- Phase 1: Syncing Users ---');
        let createdUsers = 0;

        // Cache Map: MongoID -> TelegramID
        const mongoIdToTelegram = new Map<string, string>();
        const telegramToMongoUser = new Map<string, any>();

        for (const mUser of mongoUsers) {
            const tid = String(mUser.toJSON().telegramId);
            mongoIdToTelegram.set(String(mUser._id), tid);
            telegramToMongoUser.set(tid, mUser);

            // Check if exists in Prisma
            const pUser = await prisma.user.findFirst({
                where: { telegramId: tid }
            });

            if (!pUser) {
                console.log(`Creating missing user: ${mUser.toJSON().username || tid}`);
                try {
                    await prisma.user.create({
                        data: {
                            telegramId: tid,
                            username: mUser.toJSON().username,
                            firstName: mUser.toJSON().firstName || '',
                            lastName: mUser.toJSON().lastName,
                            languageCode: mUser.toJSON().languageCode || 'ru',
                            balance: 0, // Don't sync balance blindly? Or should we? Risk of double spending if logic differs.
                            // Better safe: init 0, maybe sync later if requested.
                        }
                    });
                    createdUsers++;
                } catch (e) {
                    console.error(`Failed to create user ${tid}:`, e);
                }
            }
        }
        console.log(`Phase 1 Complete. Created ${createdUsers} missing users.`);

        // --- Phase 2: Ensure Partner Profiles Exist in Postgres ---
        console.log('\n--- Phase 2: Syncing Partner Profiles ---');
        let createdProfiles = 0;

        // Map Mongo Profile ID -> Postgres Profile ID (needed for referrals)
        const mongoProfileIdToPostgresProfileId = new Map<string, string>();

        for (const mProfile of mongoProfiles) {
            const mUserId = String(mProfile.toJSON().userId);
            const telegramId = mongoIdToTelegram.get(mUserId);

            if (!telegramId) continue; // Profile points to non-existent user?

            const pUser = await prisma.user.findFirst({ where: { telegramId } });
            if (!pUser) continue; // Should exist now

            // Check if PUser has profile
            let pProfile = await prisma.partnerProfile.findUnique({ where: { userId: pUser.id } });

            if (!pProfile) {
                console.log(`Creating profile for ${pUser.username}`);
                pProfile = await prisma.partnerProfile.create({
                    data: {
                        userId: pUser.id,
                        isActive: mProfile.toJSON().isActive || false,
                        referralCode: mProfile.toJSON().referralCode || undefined,
                        programType: 'MULTI_LEVEL',
                        // balance: mProfile.balance // Skip balance sync for safety unless asked
                    }
                });
                createdProfiles++;
            }

            // Map Mongo Profile ID -> Postgres Profile ID
            mongoProfileIdToPostgresProfileId.set(String(mProfile._id), pProfile.id);
        }
        console.log(`Phase 2 Complete. Matches/Created ${createdProfiles} profiles.`);


        // --- Phase 3: Sync Referrals (The Fix) ---
        console.log('\n--- Phase 3: Syncing Referrals ---');
        let fixedReferrals = 0;

        for (const mRef of mongoReferrals) {
            const mRefJSON = mRef.toJSON();
            const mReferredId = String(mRefJSON.referredId);
            const mProfileId = String(mRefJSON.profileId);
            const level = mRefJSON.level;

            // Find Postgres User (Referred)
            const referredTid = mongoIdToTelegram.get(mReferredId);
            if (!referredTid) continue;

            const pReferredUser = await prisma.user.findFirst({ where: { telegramId: referredTid } });
            if (!pReferredUser) continue;

            // Find Postgres Inviter Profile
            const pInviterProfileId = mongoProfileIdToPostgresProfileId.get(mProfileId);
            if (!pInviterProfileId) continue;

            // Check if this referral link exists
            const existingRef = await prisma.partnerReferral.findFirst({
                where: {
                    referredId: pReferredUser.id,
                    level: level // strict level check?
                    // Note: Postgres schema might be unique on (referredId, level) or similar?
                    // Actually, usually user has 1 inviter (level 1).
                }
            });

            if (level === 1) {
                // This is the direct inviter. 
                // If existingRef points to someone else, we update it.
                if (existingRef) {
                    if (existingRef.profileId !== pInviterProfileId) {
                        console.log(`Fixing Inviter for ${pReferredUser.username}: Was ${existingRef.profileId}, Should be ${pInviterProfileId} (from Mongo)`);

                        await prisma.partnerReferral.update({
                            where: { id: existingRef.id },
                            data: { profileId: pInviterProfileId }
                        });
                        fixedReferrals++;
                    }
                } else {
                    console.log(`Creating missing referral for ${pReferredUser.username} -> Profile ${pInviterProfileId}`);
                    await prisma.partnerReferral.create({
                        data: {
                            referredId: pReferredUser.id,
                            profileId: pInviterProfileId,
                            level: 1,
                            referralType: 'DIRECT'
                        }
                    });
                    fixedReferrals++;
                }
            }
            // TODO: Handle levels 2, 3? 
            // The request specifically highlighted Dimas's issue which is direct inviter.
            // Let's stick to level 1 for safety to avoid exploding the graph if levels are calculated differently.
        }

        console.log(`Phase 3 Complete. Fixed/Created ${fixedReferrals} direct referrals.`);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
        await prisma.$disconnect();
    }
}

migrate();
