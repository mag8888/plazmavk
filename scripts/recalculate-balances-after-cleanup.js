#!/usr/bin/env node

/**
 * Скрипт для пересчета балансов пользователей после очистки дублей
 * Пересчитывает балансы на основе актуальных транзакций
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function recalculateBalances() {
  console.log('🔄 Начинаем пересчет балансов пользователей...');
  
  try {
    // Получаем всех пользователей с партнерскими профилями
    const partners = await prisma.partnerProfile.findMany({
      include: {
        user: true,
        transactions: true
      }
    });
    
    console.log(`📊 Найдено ${partners.length} партнерских профилей`);
    
    let totalRecalculated = 0;
    let totalAmount = 0;
    
    for (const partner of partners) {
      console.log(`\n🔍 Обрабатываем партнера ${partner.user.firstName} (${partner.userId})`);
      
      // Считаем общий бонус из транзакций
      const calculatedBonus = partner.transactions.reduce((sum, tx) => {
        const amount = tx.type === 'CREDIT' ? tx.amount : -tx.amount;
        console.log(`  - ${tx.type} ${tx.amount} PZ (${tx.description})`);
        return sum + amount;
      }, 0);
      
      const oldBalance = partner.balance;
      const oldBonus = partner.bonus;
      
      console.log(`  📊 Старый баланс: ${oldBalance} PZ, бонус: ${oldBonus} PZ`);
      console.log(`  📊 Новый баланс: ${calculatedBonus} PZ`);
      
      if (oldBalance !== calculatedBonus || oldBonus !== calculatedBonus) {
        // Обновляем баланс в партнерском профиле
        await prisma.partnerProfile.update({
          where: { id: partner.id },
          data: {
            balance: calculatedBonus,
            bonus: calculatedBonus
          }
        });
        
        // Обновляем баланс пользователя
        await prisma.user.update({
          where: { id: partner.userId },
          data: { balance: calculatedBonus }
        });
        
        console.log(`  ✅ Обновлен баланс: ${calculatedBonus} PZ`);
        totalRecalculated++;
        totalAmount += calculatedBonus;
      } else {
        console.log(`  ⏭️ Баланс уже корректный, пропускаем`);
      }
    }
    
    console.log(`\n🎉 Пересчет завершен!`);
    console.log(`✅ Обработано профилей: ${partners.length}`);
    console.log(`✅ Обновлено балансов: ${totalRecalculated}`);
    console.log(`💰 Общая сумма бонусов: ${totalAmount.toFixed(2)} PZ`);
    
  } catch (error) {
    console.error('❌ Ошибка при пересчете балансов:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем пересчет
recalculateBalances()
  .then(() => {
    console.log('✅ Скрипт завершен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });
