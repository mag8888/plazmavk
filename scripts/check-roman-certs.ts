import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findFirst({
            where: { username: 'roman_arctur' }
        });
        if (user) {
            const certs = await prisma.giftCertificate.findMany({
                where: { userId: user.id }
            });
            console.log(certs);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
