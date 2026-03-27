import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findFirst({
            where: { partner: { isNot: null } },
            include: { partner: true }
        });

        if (!user) {
            console.log('No user with partner profile found.');
            return;
        }

        console.log(`Checking dashboard for user: ${user.id} (${user.username})`);

        const profile = await prisma.partnerProfile.findUnique({
            where: { userId: user.id },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
                referrals: true,
            },
        });

        if (!profile) {
            console.log('Profile not found via findUnique');
            return;
        }

        const partners = await prisma.partnerReferral.count({ where: { profileId: profile.id } });
        const directPartners = await prisma.partnerReferral.count({ where: { profileId: profile.id, level: 1 } });
        const multiPartners = await prisma.partnerReferral.count({ where: { profileId: profile.id, level: 2 } });

        const dashboard = {
            profile,
            stats: {
                partners,
                directPartners,
                multiPartners
            }
        };

        console.log('Dashboard Result (Simulated):', JSON.stringify(dashboard, null, 2));

    } catch (error) {
        console.error('Error in debug script:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
