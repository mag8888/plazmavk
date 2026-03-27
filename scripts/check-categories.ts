
import { prisma } from '../src/lib/prisma.js';

async function checkCategories() {
    const categories = await prisma.category.findMany({
        include: { products: { select: { id: true, title: true, imageUrl: true } } }
    });

    console.log(`Found ${categories.length} categories.`);
    for (const cat of categories) {
        console.log(`Category: ${cat.name} (ID: ${cat.id})`);
        console.log(`  - ImageUrl: ${cat.imageUrl || 'MISSING'}`);
        console.log(`  - Products Count: ${cat.products.length}`);
        const productWithImage = cat.products.find(p => p.imageUrl);
        console.log(`  - First Product with Image: ${productWithImage ? productWithImage.title : 'NONE'}`);
    }
}

checkCategories()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
