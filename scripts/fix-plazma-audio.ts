
import { MongoClient } from 'mongodb';

// Using the same base connection, but targeting 'plazma' specifically
const url = 'mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@nozomi.proxy.rlwy.net:28672/plazma?authSource=admin';

async function fix() {
    console.log('🚀 Fixing AudioFile collection in plazma database...');
    const client = new MongoClient(url);
    try {
        await client.connect();
        const db = client.db(); // uses 'plazma' from url

        // 1. Get source data from 'audioFiles'
        const sourceCol = db.collection('audioFiles');
        const docs = await sourceCol.find({}).toArray();
        console.log(`Found ${docs.length} docs in 'audioFiles'`);

        if (docs.length === 0) {
            console.log('No source documents found.');
            return;
        }

        // 2. Insert into 'AudioFile'
        const targetCol = db.collection('AudioFile');
        const targetCount = await targetCol.countDocuments();
        console.log(`Current 'AudioFile' count: ${targetCount}`);

        if (targetCount === 0) {
            console.log(`Copying ${docs.length} docs to 'AudioFile'...`);
            // Remove _id to avoid collision if any (or keep if we want exact clones, usually fine for cross-collection)
            // But if we copy literal objects, mongo handles _id.
            // Wait, if _id is same, it's fine for distinct collections.
            const result = await targetCol.insertMany(docs);
            console.log(`✅ Inserted ${result.insertedCount} documents.`);
        } else {
            console.log('Target collection not empty. Skipping to avoid duplicates.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

fix();
