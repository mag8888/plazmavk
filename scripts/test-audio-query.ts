
import { PrismaClient } from '@prisma/client';

// Bypass app config and use process.env directly
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error('DATABASE_URL is missing!');
    process.exit(1);
}

const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: ['query', 'info', 'warn', 'error']
});

async function main() {
    console.log(`Test: Connecting to ${dbUrl.split('@')[1]}...`); // Log host only
    await prisma.$connect();
    console.log('Test: Connected.');

    console.log("Test: Querying AudioFile where category='gift' AND isActive=true...");

    // Replicating getActiveAudioFiles logic
    const files = await prisma.audioFile.findMany({
        where: {
            isActive: true,
            category: 'gift'
        },
        orderBy: { createdAt: 'desc' },
    });

    console.log(`Test: Result count: ${files.length}`);
    files.forEach(f => {
        console.log(` - ${f.title} (ID: ${f.id}, Category: '${f.category}', Active: ${f.isActive})`);
    });

    if (files.length === 0) {
        console.log('Test: No files found for "gift". Checking all active files...');
        const allActive = await prisma.audioFile.findMany({ where: { isActive: true } });
        console.log(`Test: Found ${allActive.length} active files total.`);
        allActive.forEach(f => {
            console.log(` - ${f.title} (Category: '${f.category}')`);
        });
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
