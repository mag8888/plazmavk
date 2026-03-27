
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 debugging admin users query...');
    try {
        const users = await prisma.user.findMany({
            include: {
                partner: {
                    include: {
                        referrals: true,
                        transactions: true
                    }
                },
                orders: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        console.log(`✅ Found ${users.length} users`);

        // Simulate the N+1 queries
        console.log('🔄 Simulating N+1 stats calculation...');
        for (const user of users) {
            /*
           const referralRecord = await prisma.partnerReferral.findFirst({
            where: { referredId: user.id },
            include: {
              profile: {
                include: { user: { select: { username: true, firstName: true } } }
              }
            }
          });
          */
        }
        console.log('✅ Stats calculation simulation finished (skipped actual queries to save time but main query worked)');

    } catch (error) {
        console.error('❌ Error in admin users query:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
