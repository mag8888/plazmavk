
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.partnerReferral.count();
    console.log(`✅ Total PartnerReferrals: ${count}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
