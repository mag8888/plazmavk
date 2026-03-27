#!/usr/bin/env node

/**
 * Скрипт для очистки дублирующихся уведомлений о бонусах
 * Удаляет повторные записи в UserHistory с одинаковыми данными о бонусах
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicateBonuses() {
  console.log('🧹 Начинаем очистку дублирующихся бонусов...');
  
  try {
    // Находим все записи о бонусах
    const bonusRecords = await prisma.userHistory.findMany({
      where: {
        action: 'REFERRAL_BONUS'
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    console.log(`📊 Найдено ${bonusRecords.length} записей о бонусах`);
    
    // Группируем записи по пользователю и данным о бонусе
    const groupedRecords = new Map();
    
    for (const record of bonusRecords) {
      try {
        const payload = record.payload;
        if (!payload || typeof payload !== 'object') continue;
        
        // Создаем ключ для группировки (пользователь + сумма + заказ)
        const key = `${record.userId}_${payload.amount}_${payload.referredUserId}_${payload.orderAmount}`;
        
        if (!groupedRecords.has(key)) {
          groupedRecords.set(key, []);
        }
        groupedRecords.get(key).push(record);
      } catch (error) {
        console.warn(`⚠️ Ошибка при обработке записи ${record.id}:`, error.message);
      }
    }
    
    console.log(`🔍 Найдено ${groupedRecords.size} уникальных групп бонусов`);
    
    let totalDeleted = 0;
    
    // Обрабатываем каждую группу
    for (const [key, records] of groupedRecords) {
      if (records.length > 1) {
        console.log(`🔄 Группа "${key}": найдено ${records.length} дублей`);
        
        // Оставляем самую раннюю запись, удаляем остальные
        const sortedRecords = records.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const keepRecord = sortedRecords[0];
        const deleteRecords = sortedRecords.slice(1);
        
        console.log(`  ✅ Оставляем запись от ${keepRecord.createdAt.toISOString()}`);
        
        for (const deleteRecord of deleteRecords) {
          console.log(`  🗑️ Удаляем дубль от ${deleteRecord.createdAt.toISOString()}`);
          await prisma.userHistory.delete({
            where: { id: deleteRecord.id }
          });
          totalDeleted++;
        }
      }
    }
    
    console.log(`\n🎉 Очистка завершена!`);
    console.log(`✅ Удалено дублирующихся записей: ${totalDeleted}`);
    
    if (totalDeleted > 0) {
      console.log(`\n💡 Рекомендации:`);
      console.log(`   - Проверьте балансы пользователей`);
      console.log(`   - При необходимости пересчитайте бонусы`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при очистке дублей:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем очистку
cleanupDuplicateBonuses()
  .then(() => {
    console.log('✅ Скрипт завершен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });
