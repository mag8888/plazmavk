
import { MongoClient } from 'mongodb';
import 'dotenv/config';

// Source: 'plazma' database (which has lowercase collections)
const SOURCE_URL = 'mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@nozomi.proxy.rlwy.net:28672/plazma?authSource=admin';

// Target: 'plazma_bot' (which has PascalCase collections for Prisma)
// Or use process.env.DATABASE_URL if you want to use exactly what's in local .env
const TARGET_URL = process.env.DATABASE_URL || 'mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@nozomi.proxy.rlwy.net:28672/plazma_bot?authSource=admin';

const COLLECTIONS_TO_MIGRATE = [
    { source: 'products', target: 'Product' },
    { source: 'categories', target: 'Category' },
    // Use 'audioFiles' (plural, camelCase) from source based on inspection
    { source: 'audioFiles', target: 'AudioFile' }
];

async function migrate() {
    if (!TARGET_URL) {
        console.error('❌ Error: TARGET_URL is missing.');
        process.exit(1);
    }

    console.log('🚀 Starting migration...');
    console.log(`📡 Source: ${SOURCE_URL.replace(/:[^:]*@/, ':****@')}`);
    console.log(`🎯 Target: ${TARGET_URL.replace(/:[^:]*@/, ':****@')}`);

    const sourceClient = new MongoClient(SOURCE_URL);
    const targetClient = new MongoClient(TARGET_URL);

    try {
        await sourceClient.connect();
        await targetClient.connect();
        console.log('✅ Connected to both databases.');

        const sourceDb = sourceClient.db();
        const targetDb = targetClient.db();

        for (const collectionMap of COLLECTIONS_TO_MIGRATE) {
            const sourceName = collectionMap.source;
            const targetName = collectionMap.target;

            console.log(`\n📦 Migrating ${sourceName} -> ${targetName}...`);

            const sourceCollection = sourceDb.collection(sourceName);
            const targetCollection = targetDb.collection(targetName);

            const count = await sourceCollection.countDocuments();
            if (count === 0) {

                console.log(`   Fooled you! It's empty. Skipping.`);
                continue;
            }

            // Wipe target collection to ensure we don't have leftovers (like "PLAZMA Water - ...")
            console.log(`   🧹 Clearing target collection ${targetName}...`);
            await targetCollection.deleteMany({});

            console.log(`   Found ${count} documents. Reading...`);
            const docs = await sourceCollection.find().toArray();

            if (docs.length > 0) {
                const ops = docs.map(doc => ({
                    replaceOne: {
                        filter: { _id: doc._id },
                        replacement: doc,
                        upsert: true
                    }
                }));

                console.log(`   Writing ${ops.length} documents to target...`);
                // Use targetCollection here correctly
                const result = await targetCollection.bulkWrite(ops);
                console.log(`   ✅ Synced: ${result.upsertedCount} inserted, ${result.modifiedCount} updated, ${result.matchedCount} matched.`);
            }
        }

        console.log('\n🎉 Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await sourceClient.close();
        await targetClient.close();
    }
}

migrate();
