import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

const MONGO_URL = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';
const prisma = new PrismaClient();

async function checkReferrals() {
    console.log('🔍 Checking Partner Referrals...\n');

    // Check PostgreSQL
    const pgProfiles = await prisma.partnerProfile.findMany({
        include: {
            _count: {
                select: { referrals: true }
            }
        },
        orderBy: { totalPartners: 'desc' }
    });

    console.log(`📊 PostgreSQL Partner Profiles: ${pgProfiles.length}`);
    console.log(`   Profiles with totalPartners > 0: ${pgProfiles.filter(p => p.totalPartners > 0).length}`);
    console.log(`   Profiles with actual referrals: ${pgProfiles.filter(p => p._count.referrals > 0).length}\n`);

    // Show profiles with mismatch
    const mismatches = pgProfiles.filter(p => p.totalPartners !== p._count.referrals);
    if (mismatches.length > 0) {
        console.log(`⚠️  Found ${mismatches.length} profiles where totalPartners doesn't match actual referral count:\n`);
        mismatches.slice(0, 10).forEach(p => {
            console.log(`   ${p.referralCode}: totalPartners=${p.totalPartners}, actual referrals=${p._count.referrals}`);
        });
    }

    // Check MongoDB
    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    const mongoDb = mongoClient.db();

    const mongoReferrals = await mongoDb.collection('PartnerReferral').countDocuments();
    const mongoProfiles = await mongoDb.collection('PartnerProfile').find().toArray();

    console.log(`\n📈 MongoDB Data:`);
    console.log(`   Partner Referrals: ${mongoReferrals}`);
    console.log(`   Profiles with partners > 0: ${mongoProfiles.filter(p => p.totalPartners > 0).length}`);

    // Show sample from MongoDB
    const mongoProfilesWithPartners = mongoProfiles.filter(p => p.totalPartners > 0).slice(0, 5);
    console.log(`\n📋 Sample MongoDB profiles with partners:`);
    mongoProfilesWithPartners.forEach(p => {
        console.log(`   ${p.referralCode}: totalPartners=${p.totalPartners}, directPartners=${p.directPartners}`);
    });

    await mongoClient.close();
    await prisma.$disconnect();
}

checkReferrals().catch(e => {
    console.error('💥 Error:', e);
    process.exit(1);
});
