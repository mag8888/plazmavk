
import { MongoClient } from 'mongodb';

const MONGO_URL = 'mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@nozomi.proxy.rlwy.net:28672';

async function inspectNewDb() {
    console.log('🔍 Connecting to NEW MongoDB...');
    console.log(`   URL: ${MONGO_URL.replace(/:[^:]*@/, ':****@')}`);

    const client = new MongoClient(MONGO_URL);

    try {
        await client.connect();
        console.log('✅ Connected successfully');

        const db = client.db();
        const collections = await db.listCollections().toArray();

        console.log(`\n📊 Found ${collections.length} collections:`);

        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`   - ${col.name.padEnd(30)} : ${count} docs`);
        }

        // Deep dive into User/users collections if they exist
        for (const colName of ['User', 'users', 'plazma_bot.User']) {
            if (collections.find(c => c.name === colName)) {
                console.log(`\n🕵️‍♀️ Sampling ${colName}:`);
                const samples = await db.collection(colName).find().sort({ _id: -1 }).limit(3).toArray();
                console.log(JSON.stringify(samples, null, 2));
            }
        }

    } catch (error) {
        console.error('❌ Error inspecting DB:', error);
    } finally {
        await client.close();
    }
}

inspectNewDb();
