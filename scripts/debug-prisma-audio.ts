
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Debugging Prisma Audio connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL); // Mask if printing logs!

    try {
        // 1. Check count of all audio files
        const all = await prisma.audioFile.findMany();
        console.log(`\n📚 Total AudioFiles found via Prisma: ${all.length}`);

        if (all.length > 0) {
            console.log('Sample:', all[0]);
        }

        // 2. Check specific query used by bot
        const category = 'gift';
        const activeGift = await prisma.audioFile.findMany({
            where: {
                isActive: true,
                category: category
            }
        });
        console.log(`\n🎁 Active 'gift' AudioFiles via Prisma: ${activeGift.length}`);

        // 3. Check for specific title
        const specific = await prisma.audioFile.findFirst({
            where: { title: { contains: 'Relaxation' } }
        });
        console.log(`\n🔎 Search 'Relaxation': ${specific ? 'Found' : 'Not Found'}`);

    } catch (error) {
        console.error('❌ Prisma Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
