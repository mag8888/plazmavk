import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    try {
        const product = await prisma.product.findFirst({
            where: { title: "Цинковая плазма" }
        });

        if (product) {
            console.log('Product Found:', product.title);
            console.log('Description Start:', product.description?.substring(0, 100));
            console.log('Instruction Start:', product.instruction?.substring(0, 100));
            console.log('Description contains newline:', product.description?.includes('\n'));
        } else {
            console.log('Product not found');
        }
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
