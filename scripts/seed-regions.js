
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('🌍 Seeding Regions...');

    const regions = [
        { code: 'BALI', name: 'Бали', currency: 'RUB', sortOrder: 10, isDefault: false },
        { code: 'RUSSIA', name: 'Россия', currency: 'RUB', sortOrder: 20, isDefault: true },
        { code: 'DUBAI', name: 'Дубай', currency: 'AED', sortOrder: 30, isDefault: false },
        { code: 'KAZAKHSTAN', name: 'Казахстан', currency: 'RUB', sortOrder: 40, isDefault: false }, // Assuming RUB for simplicity or KZT
        { code: 'BELARUS', name: 'Беларусь', currency: 'RUB', sortOrder: 50, isDefault: false }, // BYN
        { code: 'OTHER', name: 'Другой', currency: 'RUB', sortOrder: 99, isDefault: false },
    ];

    for (const r of regions) {
        const region = await prisma.region.upsert({
            where: { code: r.code },
            update: r,
            create: r,
        });
        console.log(`✅ Region upserted: ${region.name} (${region.code})`);
    }

    console.log('✅ Regions seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
