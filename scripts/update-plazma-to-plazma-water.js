#!/usr/bin/env node

/**
 * Скрипт для замены "Plazma" на "Plazma Water" в описаниях
 * в базе данных (BotContent)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updatePlazmaToPlazmaWater() {
  try {
    console.log('🔄 Поиск записей с "Plazma" без "Water"...');
    
    // Получаем все записи BotContent
    const allContents = await prisma.botContent.findMany({
      where: {
        OR: [
          { content: { contains: 'Plazma', mode: 'insensitive' } },
          { title: { contains: 'Plazma', mode: 'insensitive' } },
          { description: { contains: 'Plazma', mode: 'insensitive' } }
        ]
      }
    });
    
    console.log(`📝 Найдено записей: ${allContents.length}`);
    
    let updatedCount = 0;
    
    for (const content of allContents) {
      let updated = false;
      let newContent = content.content;
      let newTitle = content.title;
      let newDescription = content.description;
      
      // Заменяем "Plazma" на "Plazma Water", но только если это не "Plazma Water" или "Plazma Bot"
      // Используем регулярное выражение для замены слова "Plazma", которое не является частью "Plazma Water" или "Plazma Bot"
      const plazmaRegex = /\bPlazma\b(?!\s+(?:Water|Bot|MM))/gi;
      
      if (newContent && plazmaRegex.test(newContent)) {
        newContent = newContent.replace(plazmaRegex, 'Plazma Water');
        updated = true;
      }
      
      if (newTitle && plazmaRegex.test(newTitle)) {
        newTitle = newTitle.replace(plazmaRegex, 'Plazma Water');
        updated = true;
      }
      
      if (newDescription && plazmaRegex.test(newDescription)) {
        newDescription = newDescription.replace(plazmaRegex, 'Plazma Water');
        updated = true;
      }
      
      if (updated) {
        await prisma.botContent.update({
          where: { id: content.id },
          data: {
            content: newContent,
            title: newTitle,
            description: newDescription
          }
        });
        
        console.log(`✅ Обновлена запись: ${content.key} (${content.id})`);
        updatedCount++;
      }
    }
    
    console.log(`\n✅ Всего обновлено записей: ${updatedCount}`);
    
  } catch (error) {
    console.error('❌ Ошибка обновления:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updatePlazmaToPlazmaWater();

