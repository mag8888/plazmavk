import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteEmptyCategory() {
    try {
        // Delete the empty "Каталог" category
        const categoryId = '059250b2-1a61-4d60-86f5-945995057c5a';

        const deleted = await prisma.category.delete({
            where: { id: categoryId }
        });

        console.log('✅ Successfully deleted category:', deleted.name);
        console.log('ID:', deleted.id);

    } catch (error) {
        console.error('Error deleting category:', error);
    } finally {
        await prisma.$disconnect();
    }
}

deleteEmptyCategory();
