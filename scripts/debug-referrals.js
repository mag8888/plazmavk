import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';

const MONGO_URL = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';
const prisma = new PrismaClient();

async function debugReferrals() {
    console.log('🔍 Debugging Referral Migration...\n');

    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    const mongoDb = mongoClient.db();

    // Get sample data
    const mongoReferrals = await mongoDb.collection('PartnerReferral').find().limit(10).toArray();
    const mongoProfiles = await mongoDb.collection('PartnerProfile').find().toArray();
    const mongoUsers = await mongoDb.collection('User').find().toArray();

    console.log('📊 Sample Referral from MongoDB:');
    const sample = mongoReferrals[0];
    console.log(JSON.stringify(sample, null, 2));
    console.log();

    // Build maps
    const mongoUserMap = {};
    mongoUsers.forEach(u => {
        mongoUserMap[u._id.toString()] = u;
    });

    const mongoProfileMap = {};
    mongoProfiles.forEach(p => {
        mongoProfileMap[p._id.toString()] = p;
    });

    // Check sample referral
    console.log('🔍 Checking sample referral:');
    console.log(`   profileId: ${sample.profileId}`);

    const mongoProfile = mongoProfileMap[sample.profileId];
    if (!mongoProfile) {
        console.log('   ❌ No profile found in MongoDB');
    } else {
        console.log(`   ✅ Found profile: ${mongoProfile.referralCode} (userId: ${mongoProfile.userId})`);

        const profileOwnerUser = mongoUserMap[mongoProfile.userId];
        if (profileOwnerUser) {
            console.log(`      Profile owner telegramId: ${profileOwnerUser.telegramId}`);
        }
    }

    console.log(`\n   userId: ${sample.userId}`);
    const mongoUser = mongoUserMap[sample.userId];
    if (!mongoUser) {
        console.log('   ❌ No user found in MongoDB');
    } else {
        console.log(`   ✅ Found user: ${mongoUser.firstName} (telegramId: ${mongoUser.telegramId})`);
    }

    // Check PostgreSQL
    console.log('\n📊 Checking PostgreSQL:');

    if (mongoProfile) {
        const pgProfile = await prisma.partnerProfile.findFirst({
            where: { referralCode: mongoProfile.referralCode },
            include: { user: true }
        });

        if (!pgProfile) {
            console.log(`   ❌ No PG profile with code ${mongoProfile.referralCode}`);
        } else {
            console.log(`   ✅ Found PG profile: ${pgProfile.referralCode}`);
            console.log(`      PG profile.id: ${pgProfile.id}`);
            console.log(`      PG user telegramId: ${pgProfile.user.telegramId}`);
        }
    }

    if (mongoUser) {
        const pgUser = await prisma.user.findUnique({
            where: { telegramId: String(mongoUser.telegramId) }
        });

        if (!pgUser) {
            console.log(`   ❌ No PG user with telegramId ${mongoUser.telegramId}`);
        } else {
            console.log(`   ✅ Found PG user: ${pgUser.firstName} (id: ${pgUser.id})`);
        }
    }

    // Check total counts
    console.log('\n📈 Totals:');
    const pgProfileCount = await prisma.partnerProfile.count();
    const pgUserCount = await prisma.user.count();
    console.log(`   PG Profiles: ${pgProfileCount}`);
    console.log(`   PG Users: ${pgUserCount}`);
    console.log(`   Mongo Profiles: ${mongoProfiles.length}`);
    console.log(`   Mongo Users: ${mongoUsers.length}`);

    await mongoClient.close();
    await prisma.$disconnect();
}

debugReferrals().catch(e => {
    console.error('💥 Error:', e);
    process.exit(1);
});
