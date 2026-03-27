import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findFirst({
            where: { username: 'roman_arctur' }
        });
        if (user) {
            console.log(`Current Balance for ${user.username}: ${user.balance} PZ`);
            await prisma.user.update({
                where: { id: user.id },
                data: { balance: 0 }
            });
            console.log(`Balance reset to 0 PZ`);
        } else {
            console.log('User not found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
