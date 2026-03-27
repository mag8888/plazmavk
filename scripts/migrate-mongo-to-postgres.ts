
import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

// Production MongoDB URL provided by user
const MONGO_URL = 'mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@nozomi.proxy.rlwy.net:28672';

const prisma = new PrismaClient();

async function migrate() {
    console.log('🚀 Starting migration from REAL Production DB...');
    console.log('Connecting to MongoDB...', MONGO_URL);

    const client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    // DATABASE MAPPING BASED ON INSPECTION
    // Users -> plazma_bot.User (1577 docs)
    // Products -> plazma.products (22 docs)
    // Categories -> plazma.categories (4 docs)

    const userDb = client.db('plazma_bot');
    const catalogDb = client.db('plazma');

    // --- 1. MIGRATE CATEGORIES (from plazma.categories) ---
    console.log('\n--- Migrating Categories ---');
    let categories = await catalogDb.collection('categories').find({}).toArray();
    // Fallback: search 'Category' if 'categories' is empty
    if (categories.length === 0) {
        console.log('categories empty, checking Category...');
        categories = await catalogDb.collection('Category').find({}).toArray();
    }

    const categoryMap = new Map<string, string>(); // Mongo ID -> Postgres UUID

    // Ensure Fallback Category exists
    const fallbackCategory = await prisma.category.upsert({
        where: { slug: 'uncategorized' },
        update: {},
        create: {
            name: 'Uncategorized',
            slug: 'uncategorized',
            description: 'Items without a specific category',
            isActive: true,
            isVisibleInWebapp: false
        }
    });

    for (const cat of categories) {
        const slug = cat.slug || cat.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
        console.log(`Migrating Category: ${cat.name} (${slug})`);

        const created = await prisma.category.upsert({
            where: { slug },
            update: {
                name: cat.name,
                description: cat.description,
                isActive: cat.isActive !== false,
                imageUrl: cat.imageUrl || null,
            },
            create: {
                name: cat.name || 'Unknown Category',
                slug,
                description: cat.description,
                isActive: cat.isActive !== false,
                imageUrl: cat.imageUrl || null,
                isVisibleInWebapp: true
            }
        });

        categoryMap.set(String(cat._id), created.id);
    }

    // --- 2. MIGRATE PRODUCTS (from plazma.products) ---
    console.log('\n--- Migrating Products ---');
    // Inspection showed 'products' collection in 'plazma' DB
    const products = await catalogDb.collection('products').find({}).toArray();
    console.log(`Found ${products.length} products in 'plazma.products'`);

    for (const p of products) {
        // Map Mongo Category ID to Postgres Category UUID
        let categoryId = categoryMap.get(String(p.categoryId));
        if (!categoryId) {
            categoryId = fallbackCategory.id;
        }

        const sku = p.sku || `legacy-${String(p._id)}`;

        // Check if price needs correction (heuristic: if < 500, likely misplaced decimal for RUB)
        let finalPrice = Number(p.price || 0);
        if (finalPrice > 0 && finalPrice < 1000) {
            finalPrice = finalPrice * 100;
        }

        // Use findFirst + update/create because 'sku' might not be unique in schema
        const existing = await prisma.product.findFirst({
            where: { sku: sku }
        });

        const productData = {
            title: p.title || p.name || 'Untitled Product',
            description: p.description,
            summary: p.summary,
            instruction: p.instruction,
            price: finalPrice,
            stock: Number(p.stock || 0),
            imageUrl: p.imageUrl || null,
            isActive: p.isActive !== false,
            categoryId: categoryId,
            sku: sku,
            availableInRussia: p.availableInRussia !== false,
            availableInBali: p.availableInBali === true
        };

        if (existing) {
            await prisma.product.update({
                where: { id: existing.id },
                data: productData
            });
            // console.log(`Updated product: ${productData.title}`);
        } else {
            await prisma.product.create({
                data: productData
            });
            console.log(`Created product: ${productData.title}`);
        }
    }


    // --- 3. MIGRATE USERS (from plazma_bot.User) ---
    console.log('\n--- Migrating Users ---');
    // Inspection showed 'User' collection in 'plazma_bot' (1577 docs)
    const users = await userDb.collection('User').find({}).toArray();
    console.log(`Found ${users.length} users in 'plazma_bot.User'`);

    let userCount = 0;
    for (const u of users) {
        if (!u.telegramId) continue;

        const telegramId = String(u.telegramId);
        let region = 'RUSSIA';
        if (u.selectedRegion === 'BALI') region = 'BALI';
        if (u.selectedRegion === 'WORLD') region = 'WORLD';

        try {
            await prisma.user.upsert({
                where: { telegramId },
                update: {
                    firstName: u.firstName,
                    lastName: u.lastName,
                    username: u.username,
                    languageCode: u.languageCode,
                    phone: u.phone,
                    deliveryAddress: u.deliveryAddress,
                    balance: Number(u.balance || 0),
                    selectedRegion: region as any,
                    photoUrl: u.photoUrl || null // If supported in schema
                },
                create: {
                    telegramId,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    username: u.username,
                    languageCode: u.languageCode || 'ru',
                    phone: u.phone,
                    deliveryAddress: u.deliveryAddress,
                    balance: Number(u.balance || 0),
                    selectedRegion: region as any,
                    photoUrl: u.photoUrl || null
                }
            });
            userCount++;
            if (userCount % 100 === 0) process.stdout.write('.');
        } catch (e) {
            console.error(`Failed to migrate user ${telegramId}:`, e);
        }
    }
    console.log(`\n✅ Migrated ${userCount} users.`);

    await client.close();
    await prisma.$disconnect();
}

migrate().catch(console.error);
