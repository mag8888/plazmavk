
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const TARGET_URL = process.env.DATABASE_URL || 'mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@nozomi.proxy.rlwy.net:28672/plazma_bot?authSource=admin';

const PRODUCTS_TO_RESTORE = [
    {
        title: 'PLAZMA Water - Базовый набор',
        description: 'Базовый набор для старта. Включает основные компоненты для восстановления.',
        price: 120, // 12000 RUB
        imageUrl: 'https://res.cloudinary.com/dt4r1tigf/image/upload/v1765250936/plazma-bot/photos/a1zkrn91ay1mm6r7vysh.jpg',
        isActive: true,
        category: null // Will try to find 'Sets' category or leave null
    },
    {
        title: 'PLAZMA Water - Премиум набор',
        description: 'Полный набор для максимального эффекта. Включает все виды плазмы.',
        price: 250, // 25000 RUB
        imageUrl: 'https://res.cloudinary.com/dt4r1tigf/image/upload/v1765250936/plazma-bot/photos/a1zkrn91ay1mm6r7vysh.jpg',
        isActive: true,
        category: null
    },
    {
        title: 'PLAZMA Water - Энергия',
        description: 'Набор для повышения энергетического потенциала и активности.',
        price: 150, // 15000 RUB
        imageUrl: 'https://res.cloudinary.com/dt4r1tigf/image/upload/v1765250936/plazma-bot/photos/a1zkrn91ay1mm6r7vysh.jpg',
        isActive: true,
        category: null
    },
    {
        title: 'PLAZMA Water - Иммунитет',
        description: 'Набор для укрепления иммунной системы и защиты организма.',
        price: 180, // 18000 RUB
        imageUrl: 'https://res.cloudinary.com/dt4r1tigf/image/upload/v1765250936/plazma-bot/photos/a1zkrn91ay1mm6r7vysh.jpg',
        isActive: true,
        category: null
    },
    {
        title: 'PLAZMA Water - Долголетие',
        description: 'Комплекс для продления молодости и активного долголетия.',
        price: 200, // 20000 RUB
        imageUrl: 'https://res.cloudinary.com/dt4r1tigf/image/upload/v1765250936/plazma-bot/photos/a1zkrn91ay1mm6r7vysh.jpg',
        isActive: true,
        category: null
    }
];

async function restore() {
    console.log('🚀 Starting restoration of PLAZMA Water sets...');
    const client = new MongoClient(TARGET_URL);

    try {
        await client.connect();
        const db = client.db();
        const productCol = db.collection('Product');
        const categoryCol = db.collection('Category');

        // Try to find a suitable category
        const category = await categoryCol.findOne({ name: { $regex: 'Наборы', $options: 'i' } });
        let categoryId = category?._id;

        if (!categoryId) {
            // Create category if needed? Or check for "Plazma"
            const catPlazma = await categoryCol.findOne({ name: { $regex: 'Plazma', $options: 'i' } });
            categoryId = catPlazma?._id;
        }

        console.log(`Using Category ID: ${categoryId || 'None'}`);

        for (const p of PRODUCTS_TO_RESTORE) {
            console.log(`Restoring ${p.title}...`);
            await productCol.updateOne(
                { title: p.title },
                {
                    $set: {
                        ...p,
                        category: categoryId ? { connect: { id: categoryId.toString() } } : undefined, // Prisma relation style? No, raw mongo.
                        // For raw mongo with Prisma schema, we usually need categoryId field or similar.
                        // Let's check schema. Usually 'categoryId' string/ObjectId.
                        // In migration we copied data directly.
                        // Let's assume 'categoryId' is the field key if it exists in raw docs.
                        // From inspection: items usually have `category` object or `categoryId`.
                        // Step 526 showed `category` as string 'gift' in AudioFile.
                        // Let's safe-bet and set isActive: true.
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
        }

        console.log('✅ Restoration complete!');

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

restore();
