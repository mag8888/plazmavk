
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔄 Checking Specialists...');
        const count = await prisma.specialist.count();
        console.log(`✅ Found ${count} specialists.`);

        if (count > 0) {
            const all = await prisma.specialist.findMany({
                take: 3,
                include: { category: true, specialtyRef: true }
            });
            console.log('🕵️‍♀️ Sample:', JSON.stringify(all, null, 2));
        } else {
            console.log('⚠️ No specialists found. You might need to create some via Admin Panel first.');
        }
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
