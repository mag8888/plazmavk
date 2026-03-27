
import { prisma } from '../src/lib/prisma.js';

async function checkUser() {
    console.log('Searching for user @billion_2222...');
    const user = await prisma.user.findFirst({
        where: { username: 'billion_2222' }
    });

    if (user) {
        console.log('User found:', user);
        // Check history
        const history = await prisma.userHistory.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        console.log('Recent history:', history);
    } else {
        console.log('User @billion_2222 NOT found in DB.');
    }
}

checkUser()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
