
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔄 Connecting with Prisma...');
        const userCount = await prisma.user.count();
        console.log(`✅ Prisma found ${userCount} users.`);

        if (userCount > 0) {
            const lastUser = await prisma.user.findFirst({
                orderBy: { createdAt: 'desc' }
            });
            console.log('🕵️‍♀️ Latest user:', lastUser);
        }

    } catch (error) {
        console.error('❌ Prisma Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
