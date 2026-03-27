import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOrders() {
  console.log('🔍 Checking orders in database...');
  
  try {
    // Get all orders
    const orders = await prisma.orderRequest.findMany({
      include: {
        user: {
          select: { id: true, firstName: true, username: true, telegramId: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`📊 Found ${orders.length} orders in database:`);
    
    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order.id}`);
      console.log(`   User: ${order.user?.firstName || 'Unknown'} (@${order.user?.username || 'no_username'})`);
      console.log(`   User ID: ${order.userId || 'NULL'}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Created: ${order.createdAt}`);
      console.log(`   Message: ${order.message}`);
      console.log('   ---');
    });
    
    // Check specifically for Roman's orders
    console.log('\n🔍 Checking for Roman\'s orders specifically...');
    const romanOrders = await prisma.orderRequest.findMany({
      where: {
        OR: [
          { user: { username: 'Xcard555' } },
          { user: { firstName: 'Roman' } }
        ]
      },
      include: {
        user: {
          select: { id: true, firstName: true, username: true }
        }
      }
    });
    
    console.log(`📊 Found ${romanOrders.length} orders for Roman:`);
    romanOrders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order.id}, User ID: ${order.userId}, Status: ${order.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking orders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrders();
