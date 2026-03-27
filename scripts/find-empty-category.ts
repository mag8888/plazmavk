import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findEmptyCategory() {
    try {
        // Find category with name "Каталог"
        const categories = await prisma.category.findMany({
            where: {
                OR: [
                    { name: 'Каталог' },
                    { name: { contains: 'Каталог' } },
                    { name: { contains: 'каталог' } }
                ]
            },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });

        console.log('Found categories matching "Каталог":');
        categories.forEach(cat => {
            console.log(`
ID: ${cat.id}
Name: ${cat.name}
Slug: ${cat.slug}
Is Active: ${cat.isActive}
Products Count: ${cat._count.products}
---
      `);
        });

        if (categories.length === 0) {
            console.log('No category found with name "Каталог"');

            // List all categories
            const allCategories = await prisma.category.findMany({
                include: {
                    _count: {
                        select: { products: true }
                    }
                },
                orderBy: { sortOrder: 'asc' }
            });

            console.log('\nAll categories:');
            allCategories.forEach(cat => {
                console.log(`${cat.sortOrder}. ${cat.name} (${cat.slug}) - ${cat._count.products} products - Active: ${cat.isActive}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findEmptyCategory();
