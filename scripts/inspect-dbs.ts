
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:qhvgdpCniWwJzVzUoliPpzHEopBAZzOv@crossover.proxy.rlwy.net:50105';

async function inspect() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URL);
        console.log('✅ Connected');

        // List all databases
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        console.log('\n--- Available Databases ---');

        for (const dbInfo of dbs.databases) {
            console.log(`\n📂 Database: ${dbInfo.name} (size: ${dbInfo.sizeOnDisk})`);

            // Skip system databases
            if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;

            try {
                const db = mongoose.connection.useDb(dbInfo.name);
                const collections = await db.listCollections();

                for (const col of collections) {
                    const count = await db.collection(col.name).countDocuments();
                    console.log(`  - ${col.name}: ${count} docs`);

                    // Sample check for users
                    if (count > 0 && (col.name.toLowerCase().includes('user') || col.name.toLowerCase().includes('client') || col.name.toLowerCase().includes('profile'))) {
                        const sample = await db.collection(col.name).findOne({});
                        console.log(`    -> Sample ${col.name}:`, JSON.stringify(sample, null, 2));
                    }
                }
            } catch (e) {
                console.log(`  ⚠️ Error inspecting ${dbInfo.name}: ${e.message}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspect();
