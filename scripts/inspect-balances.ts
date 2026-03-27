import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();

const prisma = new PrismaClient();

async function inspectBalances() {
    console.log('🔍 Inspecting balances in Postgres...');

    const users = await prisma.user.findMany({
        where: {
            partner: {
                isActive: true
            }
        },
        include: {
            partner: true
        }
    });

    console.log(`Found ${users.length} active partners.`);

    let doubledCount = 0;

    console.log('--- Users with both Balance and Bonus > 0 ---');
    for (const user of users) {
        const balance = user.balance || 0;
        const bonus = user.partner?.bonus || 0;

        if (balance > 0 && bonus > 0) {
            console.log(`User ${user.telegramId} (${user.firstName}): Balance=${balance}, Bonus=${bonus}, TotalDisplayed=${balance + bonus}`);
            if (Math.abs(balance - bonus) < 0.1) {
                console.log('   ⚠️ POTENTIAL DUPLICATION (Values are equal)');
            }
            doubledCount++;
        }
    }

    console.log(`\nTotal users with both non-zero: ${doubledCount}`);
}

inspectBalances()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
