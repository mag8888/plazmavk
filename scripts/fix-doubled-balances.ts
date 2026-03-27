import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();

const prisma = new PrismaClient();

async function fixDoubledBalances() {
    console.log('🔧 Starting migration: Fix Doubled Balances (Balance == Bonus)...');

    try {
        const partners = await prisma.partnerProfile.findMany({
            where: {
                bonus: { gt: 0 }
            },
            include: {
                user: true
            }
        });

        console.log(`📊 Found ${partners.length} partners with bonus > 0`);
        let fixedCount = 0;

        for (const partner of partners) {
            const bonus = partner.bonus;
            const balance = partner.user.balance || 0;
            const userId = partner.userId;

            // Check if values are equal (within small epsilon for float)
            // Or if balance is exactly bonus
            const isEqual = Math.abs(balance - bonus) < 0.1;

            if (isEqual) {
                console.log(`⚠️  User ${partner.user.telegramId} (${partner.user.firstName}): Balance (${balance}) == Bonus (${bonus}). Fixing duplication...`);

                // Transaction: Zero out bonus
                await prisma.$transaction([
                    prisma.partnerProfile.update({
                        where: { id: partner.id },
                        data: { bonus: 0 }
                    }),
                    prisma.userHistory.create({
                        data: {
                            userId: userId,
                            action: 'FIX_DOUBLED_BALANCE',
                            payload: {
                                initialBalance: balance,
                                initialBonus: bonus,
                                newBalance: balance,
                                newBonus: 0,
                                reason: 'Deduplication'
                            }
                        }
                    })
                ]);
                console.log(`✅ Fixed! New Total: ${balance}`);
                fixedCount++;
            } else {
                // What if they are not equal?
                // If total displayed is "doubled", maybe it implies 2x?
                // But if they are different, we shouldn't touch them blindly.
                console.log(`ℹ️  User ${partner.user.telegramId}: Balance (${balance}) != Bonus (${bonus}). Skipping safe fix.`);
            }
        }

        console.log(`✅ Migration completed. Fixed ${fixedCount} users.`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixDoubledBalances();
