
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({
        where: { username: { equals: 'Olga_brug', mode: 'insensitive' } },
        include: { partner: true }
    });

    if (!user) {
        console.log('User Olga_brug NOT FOUND in DB.');
    } else {
        console.log(`User: ${user.username} (ID: ${user.id})`);
        if (user.partner) {
            console.log(`Partner Profile: ${user.partner.id}`);
            console.log(`Is Active: ${user.partner.isActive}`);
        } else {
            console.log('No Partner Profile (Should be visible)');
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
