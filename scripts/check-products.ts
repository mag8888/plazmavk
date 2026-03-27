
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkProducts() {
    try {
        const products = await prisma.product.findMany({
            include: { category: true }
        });

        console.log(`\n📦 Found ${products.length} products in PostgreSQL:\n`);

        products.forEach(p => {
            console.log(`- [${p.id}] ${p.title}`);
            console.log(`  Price: ${p.price}`);
            console.log(`  Image: ${p.imageUrl}`);
            console.log(`  Category: ${p.category?.name} (${p.categoryId})`);
            console.log(`  Active: ${p.isActive}`);
            console.log('---');
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkProducts();
