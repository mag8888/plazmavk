
import mongoose from 'mongoose';

const mongoUrl = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';

async function inspectMongo() {
    console.log('Connecting to Mongo...');
    try {
        await mongoose.connect(mongoUrl);
        console.log('Connected.');

        // List collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        const targetTelegramId = 377367869; // Number
        const targetTelegramIdStr = '377367869'; // String

        for (const col of collections) {
            if (col.name.toLowerCase().includes('user')) {
                console.log(`\nChecking collection: ${col.name}`);
                const Model = mongoose.model(col.name, new mongoose.Schema({}, { strict: false }));

                let user = await Model.findOne({ telegramId: targetTelegramId });
                if (!user) user = await Model.findOne({ telegramId: targetTelegramIdStr });

                if (user) {
                    console.log(`FOUND User in ${col.name}:`, user);
                } else {
                    console.log(`User not found in ${col.name}`);
                }
            }

            if (col.name.toLowerCase().includes('partner')) {
                console.log(`\nChecking collection: ${col.name}`);
                const Model = mongoose.model(col.name, new mongoose.Schema({}, { strict: false }));
                // Try finding by userId or telegramId if present
                const p = await Model.findOne({ telegramId: targetTelegramId }); // unlikely but checking
                if (p) {
                    console.log(`FOUND Partner in ${col.name} via telegramId:`, p);
                }
            }
        }

    } catch (err) {
        console.error('Mongo Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

inspectMongo();
