
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔄 Connecting to PostgreSQL...');
        const userCount = await prisma.user.count();
        console.log(`✅ PostgreSQL User Count: ${userCount}`);

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
