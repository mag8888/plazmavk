
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const order = ['Набор', 'На каждый день', 'Артефакты'];

    console.log('🔄 Setting category sort order...');

    // Update known categories
    for (let i = 0; i < order.length; i++) {
        const name = order[i];
        const result = await prisma.category.updateMany({
            where: { name: name },
            data: { sortOrder: (i + 1) * 10 } // 10, 20, 30... (space for later inserts)
        });
        console.log(`Updated ${result.count} categories for "${name}" with order ${(i + 1) * 10}`);
    }

    // Set default order for others (if any)
    const others = await prisma.category.findMany({
        where: {
            name: { notIn: order }
        }
    });

    if (others.length > 0) {
        console.log(`Setting default order for ${others.length} other categories...`);
        let startOrder = (order.length + 1) * 10;
        for (const cat of others) {
            await prisma.category.update({
                where: { id: cat.id },
                data: { sortOrder: startOrder }
            });
            console.log(`Updated "${cat.name}" with order ${startOrder}`);
            startOrder += 10;
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
