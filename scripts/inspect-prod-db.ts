
import { MongoClient } from 'mongodb';

// Provided by user
const MONGO_URL = 'mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@nozomi.proxy.rlwy.net:28672';

async function inspect() {
    console.log('Connecting to MongoDB...', MONGO_URL);
    const client = new MongoClient(MONGO_URL);

    try {
        await client.connect();
        console.log('✅ Connected');

        const admin = client.db().admin();
        const { databases } = await admin.listDatabases();

        console.log('\nDatabases found:', databases.map(d => d.name).join(', '));

        for (const dbInfo of databases) {
            if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;

            console.log(`\n📂 Inspecting DB: ${dbInfo.name}`);
            const db = client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();

            for (const col of collections) {
                const count = await db.collection(col.name).countDocuments();
                console.log(`  - Collection: ${col.name} (${count} docs)`);

                // Sample one doc from key collections
                if (['User', 'users', 'Product', 'products', 'Category', 'categories'].includes(col.name) && count > 0) {
                    const sample = await db.collection(col.name).findOne({});
                    console.log(`    Sample doc keys:`, Object.keys(sample || {}));
                    if (col.name.toLowerCase().includes('user')) console.log('    User Sample:', JSON.stringify(sample, null, 2));
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

inspect();
