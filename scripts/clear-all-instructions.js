const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearAllInstructions() {
  try {
    console.log('🧹 Начинаем очистку всех инструкций...');
    
    // Получаем все товары с инструкциями
    const productsWithInstructions = await prisma.product.findMany({
      where: {
        instruction: {
          not: null
        }
      },
      select: {
        id: true,
        title: true,
        instruction: true
      }
    });
    
    console.log(`📦 Найдено товаров с инструкциями: ${productsWithInstructions.length}`);
    
    if (productsWithInstructions.length === 0) {
      console.log('✅ Все инструкции уже очищены');
      return;
    }
    
    // Показываем товары, которые будут очищены
    console.log('\n📋 Товары с инструкциями:');
    productsWithInstructions.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title}`);
      console.log(`   Инструкция: ${product.instruction?.substring(0, 100)}...`);
    });
    
    // Очищаем все инструкции
    const result = await prisma.product.updateMany({
      where: {
        instruction: {
          not: null
        }
      },
      data: {
        instruction: null
      }
    });
    
    console.log(`\n✅ Успешно очищено инструкций: ${result.count}`);
    console.log('🎉 Все инструкции удалены! Теперь можно заполнить новые.');
    
  } catch (error) {
    console.error('❌ Ошибка при очистке инструкций:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
clearAllInstructions();
