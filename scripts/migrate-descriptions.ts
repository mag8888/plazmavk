import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';

const MONGO_URI = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';

const prisma = new PrismaClient();

// MongoDB Schema
const ProductSchema = new mongoose.Schema({}, { strict: false });
const ProductModel = mongoose.model('ProductModel', ProductSchema, 'Product'); // Capitalized collection name

async function migrate() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🔌 Connecting to Postgres...');
        await prisma.$connect();
        console.log('✅ Connected to Postgres');

        // Fetch all products from Mongo
        const mongoProducts = await ProductModel.find({}).lean();
        console.log(`📦 Found ${mongoProducts.length} products in MongoDB`);

        for (const mp of mongoProducts) {
            // @ts-ignore
            const title = mp.title;
            // @ts-ignore
            const description = mp.description;
            // @ts-ignore
            const instruction = mp.instruction;

            if (!title) continue;

            // Find matching product in Postgres by Title (case-insensitive trim)
            // We fetch all and match manually to be safe with loose matching
            const pgProducts = await prisma.product.findMany();

            // Allow fuzzy match: if PG title contains Mongo title or vice versa
            const match = pgProducts.find(p =>
                p.title.trim().toLowerCase() === title.trim().toLowerCase() ||
                p.title.trim().toLowerCase().includes(title.trim().toLowerCase()) ||
                title.trim().toLowerCase().includes(p.title.trim().toLowerCase())
            );

            if (match) {
                console.log(`🔄 Updating: "${match.title}" (ID: ${match.id})`);

                // Update description and instruction
                await prisma.product.update({
                    where: { id: match.id },
                    data: {
                        description: description || match.description, // Only update if Mongo has value
                        instruction: instruction || match.instruction
                    }
                });
                console.log(`   ✅ Updated description/instruction`);
            } else {
                console.warn(`⚠️  No match found for Mongo product: "${title}"`);
            }
        }

        console.log('🎉 Migration completed!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        await prisma.$disconnect();
    }
}

migrate();
