
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const levels = await prisma.partnerReferral.groupBy({
        by: ['level'],
        _count: {
            id: true
        }
    });

    console.log('Referral Counts by Level:', levels);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
