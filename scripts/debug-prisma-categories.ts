
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to Prisma...');
    await prisma.$connect();
    console.log('Connected.');

    console.log('Fetching all categories...');
    const allCategories = await prisma.category.findMany();
    console.log(`Found ${allCategories.length} categories.`);
    console.log(JSON.stringify(allCategories, null, 2));

    console.log('Fetching active categories...');
    const activeCategories = await prisma.category.findMany({
        where: { isActive: true }
    });
    console.log(`Found ${activeCategories.length} active categories.`);

    await prisma.$disconnect();
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
