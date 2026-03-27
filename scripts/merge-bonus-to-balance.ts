import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

async function mergeBonusToBalance() {
    console.log('🔄 Starting migration: Merge Partner.bonus -> User.balance');

    try {
        // Find all partners with positive bonus
        const partners = await prisma.partnerProfile.findMany({
            where: {
                bonus: {
                    gt: 0
                }
            },
            include: {
                user: true
            }
        });

        console.log(`📊 Found ${partners.length} partners with bonus > 0`);

        for (const partner of partners) {
            const bonus = partner.bonus;
            const userId = partner.userId;
            const currentBalance = partner.user.balance;

            console.log(`Processing User ${userId} (${partner.user.firstName}): Bonus ${bonus} -> Balance ${currentBalance}`);

            // Transactional update
            await prisma.$transaction([
                // Add bonus to user balance
                prisma.user.update({
                    where: { id: userId },
                    data: {
                        balance: {
                            increment: bonus
                        }
                    }
                }),
                // Reset partner bonus to 0
                prisma.partnerProfile.update({
                    where: { id: partner.id },
                    data: {
                        bonus: 0
                    }
                }),
                // Log history
                prisma.userHistory.create({
                    data: {
                        userId: userId,
                        action: 'MERGE_BONUS_TO_BALANCE',
                        payload: {
                            oldBalance: currentBalance,
                            transferredBonus: bonus,
                            newBalance: currentBalance + bonus,
                            timestamp: new Date().toISOString()
                        }
                    }
                })
            ]);

            console.log(`✅ Transferred ${bonus} PZ to balance for user ${userId}`);
        }

        console.log('✅ Migration completed successfully');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

mergeBonusToBalance();
