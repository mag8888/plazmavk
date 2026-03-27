import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';

const MONGO_URL = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';
const prisma = new PrismaClient();

async function compareUsers() {
    console.log('🔍 Comparing MongoDB and PostgreSQL users...\n');

    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    const mongoDb = mongoClient.db();

    // Get partner profiles that need users
    const partnerProfiles = await mongoDb.collection('PartnerProfile').find().toArray();
    const partnerUserIds = partnerProfiles.map(p => p.userId);

    console.log(`📊 Partner profiles in MongoDB: ${partnerUserIds.length}`);
    console.log('   Unique user IDs needed:', new Set(partnerUserIds).size);

    // Check which users exist in PostgreSQL
    let existingCount = 0;
    let missingCount = 0;
    const missingUsers = [];

    for (const userId of partnerUserIds) {
        const exists = await prisma.user.findUnique({ where: { id: userId } });
        if (exists) {
            existingCount++;
        } else {
            missingCount++;
            missingUsers.push(userId);
        }
    }

    console.log(`\n✅ Users already in PostgreSQL: ${existingCount}`);
    console.log(`❌ Missing users: ${missingCount}\n`);

    if (missingCount > 0 && missingCount <= 20) {
        console.log('Missing user IDs:');
        missingUsers.forEach(id => console.log(`  - ${id}`));
    }

    // Check total users in both databases
    const mongoUserCount = await mongoDb.collection('User').countDocuments();
    const pgUserCount = await prisma.user.count();

    console.log(`\n📈 Total users:`);
    console.log(`   MongoDB: ${mongoUserCount}`);
    console.log(`   PostgreSQL: ${pgUserCount}`);
    console.log(`   Difference: ${mongoUserCount - pgUserCount}\n`);

    await mongoClient.close();
    await prisma.$disconnect();
}

compareUsers().catch(e => {
    console.error('💥 Error:', e);
    process.exit(1);
});
