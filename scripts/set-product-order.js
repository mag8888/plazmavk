
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Order from user images (mapped to DB names)
    const productOrder = [
        'Плазменный набор',
        'Противовирусная плазма',
        'Медная плазма',
        'Углеродная плазма',
        'Цинковая плазма', // image 2 start
        'Магниевая плазма',
        'Железная плазма',
        'АвтоГармония',
        'Плазменный браслет', // image 3 start
        // 'Плазменный кристалл', // NOT IN DB
        'Плазменный кулон'
    ];

    console.log('🔄 Setting product sort order...');

    // Set default order for ALL products first to push unlisted ones to the end
    await prisma.product.updateMany({
        data: { sortOrder: 999 }
    });
    console.log('Reset all products to order 999');

    for (let i = 0; i < productOrder.length; i++) {
        const title = productOrder[i];
        // Exact match for title
        const result = await prisma.product.updateMany({
            where: {
                title: title
            },
            data: { sortOrder: (i + 1) * 10 }
        });

        if (result.count === 0) {
            console.log(`⚠️ Product NOT found: "${title}"`);
        } else {
            console.log(`Updated ${result.count} products for "${title}" with order ${(i + 1) * 10}`);
        }
    }

    console.log('✅ Done!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
