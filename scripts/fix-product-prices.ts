
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPrices() {
    try {
        const products = await prisma.product.findMany();
        console.log(`Found ${products.length} products to check.`);

        for (const product of products) {
            if (product.price < 1000) {
                const newPrice = product.price * 100;
                console.log(`Updating ${product.title}: ${product.price} -> ${newPrice}`);

                await prisma.product.update({
                    where: { id: product.id },
                    data: { price: newPrice }
                });
            } else {
                console.log(`Skipping ${product.title}: price ${product.price} seems correct.`);
            }
        }
        console.log('✅ Prices updated successfully.');
    } catch (error) {
        console.error('Error updating prices:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixPrices();
