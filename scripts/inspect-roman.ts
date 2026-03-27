
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
    const roman = await prisma.user.findFirst({
        where: { username: { equals: 'roman_arctur', mode: 'insensitive' } },
        include: { partner: true }
    });

    console.log('--- Roman in Postgres ---');
    if (roman) {
        console.log(`User: ${roman.username} (${roman.id})`);
        console.log(`TelegramId: ${roman.telegramId}`);
        console.log(`Partner Profile:`, roman.partner);
    } else {
        console.log('User roman_arctur not found in Postgres.');
    }

    await prisma.$disconnect();
}

inspect();
