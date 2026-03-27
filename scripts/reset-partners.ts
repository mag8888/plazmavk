import { prisma } from '../src/lib/prisma.js';

async function main() {
    console.log('🔄 Resetting all partner profiles to INACTIVE...');

    const result = await prisma.partnerProfile.updateMany({
        data: {
            isActive: false
            // We don't necessarily need to clear expiresAt, but user said "remove current activation"
            // If we keep expiresAt, they might auto-expire later. Let's keep it simple: just deactivate.
        }
    });

    console.log(`✅ Deactivated ${result.count} partner profiles.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
