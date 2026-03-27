#!/usr/bin/env node

/**
 * Скрипт для удаления тестового товара
 * 
 * Использование:
 * node scripts/remove-test-product.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeTestProduct() {
  try {
    console.log('🗑️ Удаление тестового товара...\n');

    // Находим тестовый товар (ищем по названию или описанию)
    const testProduct = await prisma.product.findFirst({
      where: {
        OR: [
          { title: { contains: 'Тестовый товар' } },
          { summary: { contains: 'Тестовый товар' } },
          { description: { contains: 'Тестовый товар' } }
        ]
      }
    });

    if (!testProduct) {
      console.log('ℹ️ Тестовый товар не найден.');
      return;
    }

    console.log(`📋 Найден товар: ${testProduct.title}`);
    console.log(`💰 Цена: $${testProduct.price}`);

    // Удаляем товар
    await prisma.product.delete({
      where: { id: testProduct.id }
    });

    console.log('✅ Тестовый товар успешно удален!');

  } catch (error) {
    console.error('❌ Ошибка при удалении тестового товара:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
removeTestProduct();
