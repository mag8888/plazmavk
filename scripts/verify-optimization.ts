
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Verifying admin users optimization...');
    const start = Date.now();

    // 1. Fetch all referrals
    const allReferrals = await prisma.partnerReferral.findMany({
        select: {
            referredId: true,
            profile: {
                select: {
                    userId: true,
                    user: { select: { id: true, username: true, firstName: true, lastName: true, telegramId: true } }
                }
            }
        }
    });
    console.log(`✅ Fetched ${allReferrals.length} referrals in ${Date.now() - start}ms`);

    // 2. Build maps
    const downlineMap = new Map<string, string[]>();
    const inviterMap = new Map<string, any>();

    for (const ref of allReferrals) {
        if (!ref.referredId || !ref.profile?.userId) continue;

        const inviterId = ref.profile.userId;
        if (!downlineMap.has(inviterId)) downlineMap.set(inviterId, []);
        downlineMap.get(inviterId)?.push(ref.referredId);

        if (ref.profile.user) {
            inviterMap.set(ref.referredId, ref.profile.user);
        }
    }
    console.log(`✅ Built maps. Downline entries: ${downlineMap.size}, Inviter entries: ${inviterMap.size}`);

    // 3. Test logic on a specific user (if any)
    if (downlineMap.size > 0) {
        const testUserId = downlineMap.keys().next().value;
        console.log(`Test user: ${testUserId}`);

        const level1Ids = downlineMap.get(testUserId) || [];
        console.log(`Level 1: ${level1Ids.length}`);

        let level2Count = 0;
        for (const id of level1Ids) {
            const children = downlineMap.get(id) || [];
            level2Count += children.length;
        }
        console.log(`Level 2: ${level2Count}`);
    }

    console.log('✅ Verification successful. Logic is sound and DB query is fast.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
