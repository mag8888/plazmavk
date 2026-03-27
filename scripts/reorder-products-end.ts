
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const productsToMove = [
        'АвтоГармония',
        'Плазменный браслет',
        'Плазменный кулон'
    ];

    console.log('🔄 Updating sort order for products...');

    for (const title of productsToMove) {
        try {
            // Find product by title part (case insensitive if possible, but title usually matches)
            const product = await prisma.product.findFirst({
                where: {
                    title: {
                        contains: title,
                        mode: 'insensitive'
                    }
                }
            });

            if (product) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: { sortOrder: 1000 } // High number to move to end
                });
                console.log(`✅ Moved "${product.title}" to end (sortOrder: 1000)`);
            } else {
                console.log(`⚠️ Product containing "${title}" not found`);
            }
        } catch (e) {
            console.error(`❌ Error updating ${title}:`, e);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
