// Migrate: copy PartnerProfile.balance → User.balance (single source of truth)
// Run once: node scripts/migrate-balance-to-user.js

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Find all partner profiles where PartnerProfile.balance > 0
    const partners = await prisma.partnerProfile.findMany({
        where: { balance: { gt: 0 } },
        include: { user: true }
    });

    console.log(`Found ${partners.length} partners with non-zero PartnerProfile.balance`);

    let updated = 0;
    for (const partner of partners) {
        if (!partner.user) continue;
        const partnerBal = Number(partner.balance);
        const userBal = Number(partner.user.balance || 0);

        // Use the larger value as source of truth (avoid overwriting genuine User.balance)
        const newBal = Math.max(partnerBal, userBal);
        if (newBal !== userBal) {
            await prisma.user.update({
                where: { id: partner.user.id },
                data: { balance: newBal }
            });
            console.log(`  ${partner.user.firstName || partner.user.id}: ${userBal} → ${newBal} PZ`);
            updated++;
        } else {
            console.log(`  ${partner.user.firstName || partner.user.id}: already ${userBal} PZ (no change)`);
        }
    }

    console.log(`\n✅ Done. Updated ${updated} users. User.balance is now the single source of truth.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
