
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPrices() {
    console.log('📉 Fixing product prices (converting RUB to PZ)...');

    const products = await prisma.product.findMany();
    let updated = 0;

    for (const p of products) {
        // Assuming current price is in RUB (e.g., 6000) and we want PZ (e.g., 60)
        // 1 PZ = 100 RUB
        // So NewPrice = OldPrice / 100

        // Safety check: Don't divide if it looks like it's already small?
        // User said 6000 -> 60. 
        // If we have 100 -> 1.

        if (p.price > 0) {
            const newPrice = Math.round(p.price / 100);

            console.log(`Product: ${p.title} | ${p.price} -> ${newPrice}`);

            await prisma.product.update({
                where: { id: p.id },
                data: { price: newPrice }
            });
            updated++;
        }
    }

    console.log(`\n✅ Updated ${updated} products.`);
    await prisma.$disconnect();
}

fixPrices().catch(console.error);
