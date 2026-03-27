
import { prisma } from '../src/lib/prisma.js';

async function main() {
    const username = 'diglukhov';
    console.log(`Searching for user with username: ${username}`);

    const user = await prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
        include: {
            partner: true, // PartnerProfile of the user themselves
        }
    });

    if (!user) {
        console.log('User not found!');
        return;
    }

    console.log('User found:', {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName
    });

    // Find who invited this user (PartnerReferral where referredId = user.id)
    // We want the direct inviter (level 1 usually, or just the one record if logic implies single inviter)
    const referralRecord = await prisma.partnerReferral.findFirst({
        where: {
            referredId: user.id,
            level: 1
        },
        include: {
            profile: { // This is the inviter's PartnerProfile
                include: {
                    user: true // The inviter's User record
                }
            }
        }
    });

    if (!referralRecord) {
        console.log('No direct inviter found (no PartnerReferral record with level 1).');
    } else {
        const inviterProfile = referralRecord.profile;
        const inviterUser = inviterProfile.user;

        console.log('Inviter Found:', {
            referralParams: {
                level: referralRecord.level,
                type: referralRecord.referralType
            },
            inviterProfile: {
                id: inviterProfile.id,
                referralCode: inviterProfile.referralCode
            },
            inviterUser: {
                id: inviterUser.id,
                username: inviterUser.username,
                firstName: inviterUser.firstName,
                lastName: inviterUser.lastName
            }
        });
    }

    // Also check if there are other referral records (multi-level) just in case
    const allReferrals = await prisma.partnerReferral.findMany({
        where: { referredId: user.id },
        include: {
            profile: { include: { user: true } }
        }
    });

    console.log(`Total referral records for this user: ${allReferrals.length}`);
    if (allReferrals.length > 1) {
        console.log('Other referral records:', allReferrals.map(r => ({
            level: r.level,
            inviterUsername: r.profile.user.username,
            code: r.profile.referralCode
        })));
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
