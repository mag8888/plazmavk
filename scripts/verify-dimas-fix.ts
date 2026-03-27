
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    try {
        const username = 'diglukhov';
        const user = await prisma.user.findFirst({
            where: { username: { equals: username, mode: 'insensitive' } },
            include: { partner: true }
        });

        if (!user) {
            console.log(`User ${username} not found.`);
            return;
        }

        console.log(`User: ${user.username} (${user.id})`);

        const referral = await prisma.partnerReferral.findFirst({
            where: { referredId: user.id, level: 1 },
            include: {
                profile: {
                    include: { user: true }
                }
            }
        });

        if (referral) {
            console.log('--- Current Inviter (Level 1) ---');
            console.log(`Inviter: ${referral.profile.user.username} (${referral.profile.user.firstName})`);
            console.log(`Referral Code: ${referral.profile.referralCode}`);
            console.log(`Profile ID: ${referral.profileId}`);
        } else {
            console.log('No inviter found.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
