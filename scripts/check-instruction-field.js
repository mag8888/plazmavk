import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkInstructionField() {
  console.log('🔍 Проверяем поле instruction в базе данных...');

  try {
    // Получаем первый товар для проверки
    const product = await prisma.product.findFirst({
      where: { isActive: true }
    });

    if (product) {
      console.log(`📦 Товар: ${product.title}`);
      console.log(`📋 Инструкция: ${product.instruction ? 'Есть' : 'Нет'}`);
      
      if (product.instruction) {
        console.log(`📝 Длина инструкции: ${product.instruction.length} символов`);
        console.log(`📄 Первые 100 символов: ${product.instruction.substring(0, 100)}...`);
      }
    } else {
      console.log('❌ Товары не найдены');
    }

    // Проверяем схему базы данных
    console.log('\n🔍 Проверяем схему базы данных...');
    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        instruction: true,
      },
      take: 3
    });

    console.log(`📊 Найдено товаров: ${products.length}`);
    products.forEach((p, index) => {
      console.log(`${index + 1}. ${p.title} - Инструкция: ${p.instruction ? '✅' : '❌'}`);
    });

  } catch (error) {
    console.error('❌ Ошибка при проверке:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInstructionField().catch(async (e) => {
  console.error('❌ Script failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
