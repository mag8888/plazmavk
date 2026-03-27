
import { PrismaClient } from '@prisma/client';
import { getPartnerDashboard } from '../src/services/partner-service.js';

const prisma = new PrismaClient();

async function main() {
    try {
        // Find a user who is likely a partner or just the first user
        const user = await prisma.user.findFirst({
            where: { partner: { isNot: null } }
        });

        if (!user) {
            console.log('No user with partner profile found.');
            return;
        }

        console.log(`Checking dashboard for user: ${user.id} (${user.username})`);

        const dashboard = await getPartnerDashboard(user.id);
        console.log('Dashboard Result:', JSON.stringify(dashboard, null, 2));

    } catch (error) {
        console.error('Error in debug script:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
