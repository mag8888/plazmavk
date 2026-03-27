
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://mongo:qhvgdpCniWwJzVzUoliPpzHEopBAZzOv@crossover.proxy.rlwy.net:50105';

async function inspectMongo() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected!');

        // List all databases
        const admin = mongoose.connection.db.admin();
        const result = await admin.listDatabases();
        console.log('\nDatabases found:', result.databases.map(db => db.name).join(', '));

        // Check each database for collections (skipping system DBs)
        for (const dbInfo of result.databases) {
            if (['local', 'config', 'admin'].includes(dbInfo.name)) continue;

            console.log(`\nInspecting database: ${dbInfo.name}`);
            const db = mongoose.connection.useDb(dbInfo.name);
            const collections = await db.db.listCollections().toArray();

            for (const coll of collections) {
                const count = await db.db.collection(coll.name).estimatedDocumentCount();
                console.log(`  - ${coll.name}: ${count} documents`);
            }
        }

    } catch (error) {
        console.error('Error inspecting MongoDB:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectMongo();
