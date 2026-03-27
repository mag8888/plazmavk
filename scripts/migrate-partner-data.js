import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';

const MONGO_URL = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';
const prisma = new PrismaClient();

async function migratePartnerData() {
    console.log('🚀 Starting Partner Data Migration...\n');

    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB\n');

    const mongoDb = mongoClient.db();

    try {
        // === STEP 1: Migrate PartnerProfile ===
        console.log('📋 Step 1: Migrating Partner Profiles...');
        const partnerProfiles = await mongoDb.collection('PartnerProfile').find().toArray();
        console.log(`Found ${partnerProfiles.length} partner profiles`);

        let profileSuccess = 0;
        let profileErrors = 0;

        for (const mp of partnerProfiles) {
            try {
                // Check if user exists in PostgreSQL
                const userExists = await prisma.user.findUnique({
                    where: { id: mp.userId }
                });

                if (!userExists) {
                    console.log(`⚠️  Skipping profile ${mp._id.toString()} - user ${mp.userId} not found`);
                    profileErrors++;
                    continue;
                }

                const profileData = {
                    id: mp._id.toString(),
                    userId: mp.userId,
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
                };

                await prisma.partnerProfile.upsert({
                    where: { id: profileData.id },
                    update: profileData,
                    create: profileData
                });

                profileSuccess++;
                if (profileSuccess % 10 === 0) process.stdout.write('.');
            } catch (err) {
                profileErrors++;
                console.error(`\n❌ Error migrating profile ${mp._id}:`, err.message);
            }
        }

        console.log(`\n✅ Profiles: ${profileSuccess} success, ${profileErrors} errors\n`);

        // === STEP 2: Migrate PartnerReferral ===
        console.log('📋 Step 2: Migrating Partner Referrals...');
        const referrals = await mongoDb.collection('PartnerReferral').find().toArray();
        console.log(`Found ${referrals.length} referrals`);

        let referralSuccess = 0;
        let referralErrors = 0;

        for (const mr of referrals) {
            try {
                const referralData = {
                    id: mr._id.toString(),
                    profileId: mr.profileId || mr._id.toString(), // fallback if profileId missing
                    referredId: mr.referredId || null,
                    contact: mr.contact || null,
                    level: mr.level || 1,
                    referralType: mr.referralType || 'DIRECT',
                    createdAt: mr.createdAt ? new Date(mr.createdAt) : new Date()
                };

                await prisma.partnerReferral.upsert({
                    where: { id: referralData.id },
                    update: referralData,
                    create: referralData
                });

                referralSuccess++;
                if (referralSuccess % 10 === 0) process.stdout.write('.');
            } catch (err) {
                referralErrors++;
                console.error(`\n❌ Error migrating referral ${mr._id}:`, err.message);
            }
        }

        console.log(`\n✅ Referrals: ${referralSuccess} success, ${referralErrors} errors\n`);

        // === STEP 3: Migrate PartnerTransaction ===
        console.log('📋 Step 3: Migrating Partner Transactions...');
        const transactions = await mongoDb.collection('PartnerTransaction').find().toArray();
        console.log(`Found ${transactions.length} transactions`);

        let txSuccess = 0;
        let txErrors = 0;

        for (const mt of transactions) {
            try {
                const txData = {
                    id: mt._id.toString(),
                    profileId: mt.profileId || mt._id.toString(),
                    amount: mt.amount || 0,
                    type: mt.type || 'COMMISSION',
                    description: mt.description || 'Migrated transaction',
                    createdAt: mt.createdAt ? new Date(mt.createdAt) : new Date()
                };

                await prisma.partnerTransaction.upsert({
                    where: { id: txData.id },
                    update: txData,
                    create: txData
                });

                txSuccess++;
                if (txSuccess % 10 === 0) process.stdout.write('.');
            } catch (err) {
                txErrors++;
                console.error(`\n❌ Error migrating transaction ${mt._id}:`, err.message);
            }
        }

        console.log(`\n✅ Transactions: ${txSuccess} success, ${txErrors} errors\n`);

        // === STEP 4: Migrate PartnerActivationHistory ===
        console.log('📋 Step 4: Migrating Partner Activation History...');
        const history = await mongoDb.collection('PartnerActivationHistory').find().toArray();
        console.log(`Found ${history.length} history records`);

        let historySuccess = 0;
        let historyErrors = 0;

        for (const mh of history) {
            try {
                const historyData = {
                    id: mh._id.toString(),
                    profileId: mh.profileId || mh._id.toString(),
                    action: mh.action || 'UNKNOWN',
                    activationType: mh.activationType || null,
                    reason: mh.reason || null,
                    expiresAt: mh.expiresAt ? new Date(mh.expiresAt) : null,
                    adminId: mh.adminId || null,
                    createdAt: mh.createdAt ? new Date(mh.createdAt) : new Date()
                };

                await prisma.partnerActivationHistory.upsert({
                    where: { id: historyData.id },
                    update: historyData,
                    create: historyData
                });

                historySuccess++;
                if (historySuccess % 10 === 0) process.stdout.write('.');
            } catch (err) {
                historyErrors++;
                console.error(`\n❌ Error migrating history ${mh._id}:`, err.message);
            }
        }

        console.log(`\n✅ History: ${historySuccess} success, ${historyErrors} errors\n`);

        // === Summary ===
        console.log('═'.repeat(50));
        console.log('🎉 Migration Complete!');
        console.log('═'.repeat(50));
        console.log(`Partner Profiles:  ${profileSuccess}/${partnerProfiles.length}`);
        console.log(`Referrals:         ${referralSuccess}/${referrals.length}`);
        console.log(`Transactions:      ${txSuccess}/${transactions.length}`);
        console.log(`History:           ${historySuccess}/${history.length}`);
        console.log('═'.repeat(50));

    } catch (error) {
        console.error('💥 Migration failed:', error);
    } finally {
        await mongoClient.close();
        await prisma.$disconnect();
    }
}

migratePartnerData().catch(e => {
    console.error('💥 Fatal Error:', e);
    process.exit(1);
});
