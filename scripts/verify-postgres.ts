
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    try {
        const userCount = await prisma.user.count();
        const productCount = await prisma.product.count();
        const categoryCount = await prisma.category.count();

        console.log(`\n📊 Verification Results:`);
        console.log(`- Users: ${userCount}`);
        console.log(`- Products: ${productCount}`);
        console.log(`- Categories: ${categoryCount}`);

        console.log('\n📦 Sample Products:');
        const products = await prisma.product.findMany({ take: 5 });
        for (const p of products) {
            console.log(`  - ${p.title} | Price: ${p.price} | Stock: ${p.stock} | Image: ${p.imageUrl ? '✅ Present' : '❌ Missing'}`);
            if (p.imageUrl) console.log(`    URL: ${p.imageUrl}`);
        }

    } catch (error) {
        console.error('Error verifying:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
