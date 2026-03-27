import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';

async function inspect() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const collectionName = 'Product'; // Explicitly check Product
        console.log(`Inspecting collection: ${collectionName}`);

        const ProductModel = mongoose.model('DynamicProduct', new mongoose.Schema({}, { strict: false }), collectionName);
        const products = await ProductModel.find({}).limit(3).lean(); // Get 3 products

        if (products.length > 0) {
            console.log(`Found ${products.length} products. Sample:`);
            console.log(JSON.stringify(products[0], null, 2));
        } else {
            console.log('No products found in ' + collectionName);

            // Fallback list
            const collections = await mongoose.connection.db.listCollections().toArray();
            console.log('Available collections:', collections.map(c => c.name));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspect();
