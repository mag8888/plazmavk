
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://mongo:qhvgdpCniWwJzVzUoliPpzHEopBAZzOv@crossover.proxy.rlwy.net:50105';

async function sampleData() {
    try {
        await mongoose.connect(MONGO_URI);

        console.log('--- plazma_bot.Product ---');
        const plazmaDb = mongoose.connection.useDb('plazma_bot');
        const products = await plazmaDb.db.collection('Product').find({}).limit(5).toArray();
        console.log(JSON.stringify(products, null, 2));

        console.log('\n--- moneo.Category ---');
        const moneoDb = mongoose.connection.useDb('moneo');
        const categories = await moneoDb.db.collection('Category').find({}).limit(5).toArray();
        console.log(JSON.stringify(categories, null, 2));

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

sampleData();
