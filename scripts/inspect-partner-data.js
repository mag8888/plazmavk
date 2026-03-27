import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';

// Source: MongoDB with partner data
const MONGO_URL = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';

const prisma = new PrismaClient();

async function inspectPartnerData() {
    console.log('🔍 Inspecting Partner Data in MongoDB...');

    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB');

    const mongoDb = mongoClient.db();

    // Check available collections
    const collections = await mongoDb.listCollections().toArray();
    console.log('\n📁 Available collections:');
    collections.forEach(c => console.log(`  - ${c.name}`));

    // Try to find partner-related collections
    const possiblePartnerCollections = [
        'Partner',
        'PartnerProfile',
        'partner',
        'partnerprofile',
        'partners'
    ];

    console.log('\n🔍 Checking for partner data...');
    for (const collName of possiblePartnerCollections) {
        try {
            const coll = mongoDb.collection(collName);
            const count = await coll.countDocuments();
            if (count > 0) {
                console.log(`\n✅ Found collection: ${collName} (${count} documents)`);
                const sample = await coll.findOne();
                console.log('Sample document:', JSON.stringify(sample, null, 2));
            }
        } catch (err) {
            // Collection doesn't exist
        }
    }

    // Check if User collection has partner fields
    console.log('\n🔍 Checking User collection for partner fields...');
    const usersCollection = mongoDb.collection('User');
    const userWithPartnerData = await usersCollection.findOne({
        $or: [
            { partner: { $exists: true } },
            { partnerProfile: { $exists: true } },
            { referredBy: { $exists: true } },
            { referralCode: { $exists: true } }
        ]
    });

    if (userWithPartnerData) {
        console.log('\n✅ Found user with partner data:');
        console.log(JSON.stringify(userWithPartnerData, null, 2));
    } else {
        console.log('\n⚠️ No users found with partner-related fields');
    }

    await mongoClient.close();
    await prisma.$disconnect();
}

inspectPartnerData().catch(e => {
    console.error('💥 Error:', e);
    process.exit(1);
});
