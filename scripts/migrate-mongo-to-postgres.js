
import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';

// Source: The MongoDB instance with 2284 users
const MONGO_URL = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';

// Destination: The PostgreSQL database (configured in .env)
const prisma = new PrismaClient();

async function migrate() {
    console.log('🚀 Starting migration from Mongo to Postgres...');

    // 1. Connect to MongoDB
    console.log('🔌 Connecting to Source MongoDB...');
    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB');

    const mongoDb = mongoClient.db();
    const usersCollection = mongoDb.collection('User'); // I recall seeing 'User' (capitalized) in inspection

    // 2. Fetch Users
    console.log('📥 Fetching users from MongoDB...');
    const mongoUsers = await usersCollection.find().toArray();
    console.log(`📊 Found ${mongoUsers.length} users in MongoDB.`);

    if (mongoUsers.length === 0) {
        console.log('⚠️ No users found. Exiting.');
        await mongoClient.close();
        await prisma.$disconnect();
        return;
    }

    // 3. Migrate to Postgres
    console.log('📤 Migrating users to PostgreSQL...');
    let successCount = 0;
    let errorCount = 0;

    for (const mUser of mongoUsers) {
        try {
            // Map Mongo fields to Prisma/Postgres model
            const userData = {
                id: mUser._id.toString(), // Keep the ObjectId string as the ID
                telegramId: String(mUser.telegramId), // Ensure string
                firstName: mUser.firstName || null,
                lastName: mUser.lastName || null,
                username: mUser.username || null,
                languageCode: mUser.languageCode || null,
                balance: typeof mUser.balance === 'number' ? mUser.balance : 0,
                createdAt: mUser.createdAt ? new Date(mUser.createdAt) : new Date(),
                updatedAt: mUser.updatedAt ? new Date(mUser.updatedAt) : new Date(),
            };

            // Upsert: Create if not exists, Update if exists (by telegramId)
            // Note: user schema has unique constraint on telegramId
            await prisma.user.upsert({
                where: { telegramId: userData.telegramId },
                update: {
                    ...userData,
                    // Do not overwrite id on update if it already exists with a different ID (unlikely but safe)
                    id: undefined
                },
                create: userData,
            });

            successCount++;
            if (successCount % 100 === 0) process.stdout.write('.');
        } catch (err) {
            errorCount++;
            console.error(`\n❌ Error migrating user ${mUser.telegramId}:`, err.message);
        }
    }

    console.log('\n\n✅ Migration Complete!');
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors:  ${errorCount}`);

    await mongoClient.close();
    await prisma.$disconnect();
}

migrate().catch(e => {
    console.error('💥 Fatal Error:', e);
    process.exit(1);
});
