
import { prisma } from '../src/lib/prisma.js';
import { addProductToCart, getCartItems, removeProductFromCart, clearCart } from '../src/services/cart-service.js';

async function main() {
    console.log('🧪 Starting Cart Service Audit...');

    // 1. Get a test user (or create one)
    let user = await prisma.user.findFirst();
    if (!user) {
        console.log('⚠️ No user found, creating test user...');
        user = await prisma.user.create({
            data: {
                telegramId: '123456789',
                firstName: 'Test',
                username: 'test_user_' + Date.now(),
            }
        });
    }
    console.log(`👤 Using user: ${user.id} (${user.firstName})`);

    // 2. Get a test product
    const product = await prisma.product.findFirst({ where: { isActive: true } });
    if (!product) {
        console.error('❌ No active products found to test with.');
        return;
    }
    console.log(`📦 Using product: ${product.id} (${product.title})`);

    // 3. Clear cart first
    console.log('🧹 Clearing cart...');
    await clearCart(user.id);
    let items = await getCartItems(user.id);
    console.log(`   Cart items after clear: ${items.length}`);
    if (items.length !== 0) throw new Error('Cart not cleared');

    // 4. Add item
    console.log('➕ Adding product to cart...');
    await addProductToCart(user.id, product.id);
    items = await getCartItems(user.id);
    console.log(`   Cart items after add: ${items.length}`);
    if (items.length !== 1) throw new Error('Item not added');
    if (items[0].quantity !== 1) throw new Error('Quantity mismatch');

    // 5. Add same item again (increment)
    console.log('➕ Adding same product again...');
    await addProductToCart(user.id, product.id);
    items = await getCartItems(user.id);
    console.log(`   Quantity after second add: ${items[0].quantity}`);
    if (items[0].quantity !== 2) throw new Error('Quantity not incremented');

    // 6. Remove item
    console.log('🗑️ Removing product...');
    await removeProductFromCart(user.id, product.id);
    items = await getCartItems(user.id);
    console.log(`   Cart items after remove: ${items.length}`);
    if (items.length !== 0) throw new Error('Item not removed');

    console.log('✅ Cart Service Audit Passed!');
}

main()
    .catch(e => {
        console.error('❌ Test Failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
