
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSession() {
    console.log('Checking sessions...');
    const sessions = await prisma.$queryRaw`SELECT * FROM session LIMIT 5`;
    console.log('Recent sessions:', sessions);

    // Check specifically for admin session if possible (requires knowing session ID logic)
    // For telegraf-session-pg, the key is usually `${userId}:${chatId}`
    // Let's try to find potential admin sessions

    // Assuming admin ID is 6054363358 (from screenshot)
    const adminId = '6054363358';
    const key = `${adminId}:${adminId}`;

    const adminSession = await prisma.$queryRaw`SELECT * FROM session WHERE sid = ${key}`;
    console.log('Admin session:', adminSession);
}

checkSession()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
