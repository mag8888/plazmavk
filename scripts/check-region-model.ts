
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking Prisma Region model...');

    if (!prisma.region) {
        console.error('❌ prisma.region is undefined!');
        process.exit(1);
    }

    const regions = await prisma.region.findMany();
    console.log(`✅ Found ${regions.length} regions.`);
    regions.forEach(r => console.log(` - ${r.name} (${r.code})`));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
