
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // 1. Recover existing history to see if we can read it with new logic (simulation)
        const history = await prisma.userHistory.findMany({
            where: { action: 'favorites:toggle' },
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        console.log('--- Reading existing history ---');
        for (const h of history) {
            let payload = h.payload;
            if (typeof payload === 'string') {
                console.log(`ID: ${h.id} is STRING. Parsing...`);
                try {
                    payload = JSON.parse(payload);
                    console.log('Parsed:', payload);
                } catch (e) { console.log('Parse error'); }
            } else {
                console.log(`ID: ${h.id} is OBJECT:`, payload);
            }
        }

        // 2. Create a new entry with OBJECT payload (simulating the fix)
        const userId = history[0]?.userId;
        if (!userId) {
            console.log('No user found to test creation.');
            return;
        }

        console.log('\n--- Creating new entry with OBJECT payload ---');
        const newEntry = await prisma.userHistory.create({
            data: {
                userId,
                action: 'favorites:toggle',
                payload: { productId: 'test-product-id', isFavorite: true, test: 'fix-verification' }
            }
        });
        console.log('Created:', newEntry.id);

        // 3. Read it back
        const readBack = await prisma.userHistory.findUnique({ where: { id: newEntry.id } });
        console.log('Read back type:', typeof readBack.payload);
        console.log('Read back value:', readBack.payload);

        if (typeof readBack.payload === 'object' && readBack.payload !== null) {
            console.log('SUCCESS: Payload is stored as OBJECT.');
        } else {
            console.log('FAILURE: Payload is NOT an object.');
        }

        // Cleanup
        await prisma.userHistory.delete({ where: { id: newEntry.id } });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
