
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const keywords = ['Кубок', 'кристалл', 'Противовирусная', 'Медная'];

    console.log('🔍 Searching for products...');

    for (const keyword of keywords) {
        const products = await prisma.product.findMany({
            where: {
                title: {
                    contains: keyword
                }
            },
            select: { title: true, id: true }
        });
        console.log(`\nResults for "${keyword}":`);
        products.forEach(p => console.log(`- "${p.title}"`));
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
