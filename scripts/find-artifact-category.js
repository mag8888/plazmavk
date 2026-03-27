#!/usr/bin/env node

/**
 * Поиск категории "Артефакт" и всех товаров в этой категории
 * Использование: node scripts/find-artifact-category.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🔍 Поиск категории "Артефакт" и товаров в ней...\n');
console.log('═'.repeat(80));

// 1. Поиск в локальных бэкапах
console.log('\n📁 ПОИСК В ЛОКАЛЬНЫХ БЭКАПАХ:\n');

const localBackups = fs.readdirSync(projectRoot)
  .filter(file => file.startsWith('database-backup-') && file.endsWith('.json'))
  .sort()
  .reverse();

let foundCategory = false;

for (const backupFile of localBackups) {
  try {
    const filepath = path.join(projectRoot, backupFile);
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const categories = data.data?.categories || [];
    const products = data.data?.products || [];
    
    // Ищем категорию с "артефакт" в названии или slug
    const artifactCategory = categories.find(c => {
      const name = (c.name || '').toLowerCase();
      const slug = (c.slug || '').toLowerCase();
      return name.includes('артефакт') || slug.includes('artifact') || slug.includes('артефакт');
    });
    
    if (artifactCategory) {
      foundCategory = true;
      const categoryId = artifactCategory.id || artifactCategory._id;
      
      console.log(`✅ Найдено в ${backupFile}:`);
      console.log(`\n📂 КАТЕГОРИЯ:`);
      console.log(`   Название: ${artifactCategory.name}`);
      console.log(`   ID: ${categoryId}`);
      console.log(`   Slug: ${artifactCategory.slug || 'не указан'}`);
      console.log(`   Описание: ${artifactCategory.description || 'нет'}`);
      console.log(`   Активна: ${artifactCategory.isActive ? '✅' : '❌'}`);
      
      // Находим все товары в этой категории
      const categoryProducts = products.filter(p => {
        const pCategoryId = p.categoryId || p.category?.id || p.category?._id;
        return String(pCategoryId) === String(categoryId);
      });
      
      console.log(`\n📦 ТОВАРОВ В КАТЕГОРИИ: ${categoryProducts.length}\n`);
      
      if (categoryProducts.length > 0) {
        categoryProducts.forEach((product, index) => {
          console.log(`${index + 1}. ${product.title}`);
          console.log(`   ID: ${product.id || product._id}`);
          console.log(`   Цена: ${product.price} PZ`);
          console.log(`   Активен: ${product.isActive ? '✅' : '❌'}`);
          if (product.summary) {
            console.log(`   Описание: ${product.summary.substring(0, 100)}...`);
          }
          if (product.imageUrl) {
            console.log(`   Изображение: ${product.imageUrl}`);
          }
          console.log('');
        });
      } else {
        console.log('   ⚠️  В категории нет товаров');
      }
      
      console.log('─'.repeat(80));
    } else {
      console.log(`❌ В ${backupFile} категория "Артефакт" не найдена`);
      console.log(`   Доступные категории: ${categories.map(c => c.name).join(', ')}`);
    }
  } catch (error) {
    console.error(`❌ Ошибка чтения ${backupFile}:`, error.message);
  }
}

// 2. Поиск в текущей базе данных
console.log('\n' + '═'.repeat(80));
console.log('\n🔌 ПОИСК В ТЕКУЩЕЙ БАЗЕ ДАННЫХ:\n');

const databaseUrl = process.env.DATABASE_URL || process.env.MONGO_URL;

if (databaseUrl) {
  try {
    await mongoose.connect(databaseUrl);
    console.log('✅ Подключено к базе данных');
    
    const db = mongoose.connection.db;
    const categoriesCollection = db.collection('categories');
    const productsCollection = db.collection('products');
    
    // Ищем категорию с "артефакт"
    const artifactCategories = await categoriesCollection.find({
      $or: [
        { name: { $regex: 'артефакт', $options: 'i' } },
        { slug: { $regex: 'artifact|артефакт', $options: 'i' } }
      ]
    }).toArray();
    
    if (artifactCategories.length > 0) {
      for (const category of artifactCategories) {
        console.log(`\n📂 КАТЕГОРИЯ:`);
        console.log(`   Название: ${category.name}`);
        console.log(`   ID: ${category._id}`);
        console.log(`   Slug: ${category.slug || 'не указан'}`);
        console.log(`   Описание: ${category.description || 'нет'}`);
        console.log(`   Активна: ${category.isActive ? '✅' : '❌'}`);
        
        // Находим товары в этой категории
        const categoryProducts = await productsCollection.find({
          categoryId: category._id
        }).toArray();
        
        console.log(`\n📦 ТОВАРОВ В КАТЕГОРИИ: ${categoryProducts.length}\n`);
        
        if (categoryProducts.length > 0) {
          categoryProducts.forEach((product, index) => {
            console.log(`${index + 1}. ${product.title}`);
            console.log(`   ID: ${product._id}`);
            console.log(`   Цена: ${product.price} PZ`);
            console.log(`   Активен: ${product.isActive ? '✅' : '❌'}`);
            if (product.summary) {
              console.log(`   Описание: ${product.summary.substring(0, 100)}...`);
            }
            console.log('');
          });
        } else {
          console.log('   ⚠️  В категории нет товаров');
        }
      }
    } else {
      console.log('❌ Категория "Артефакт" не найдена в текущей базе данных');
      
      // Показываем все категории для справки
      const allCategories = await categoriesCollection.find({}).toArray();
      console.log(`\n📊 Всего категорий в базе: ${allCategories.length}`);
      if (allCategories.length > 0) {
        console.log('\n📋 Список всех категорий:');
        allCategories.forEach((c, i) => {
          console.log(`   ${i + 1}. ${c.name} (${c.slug || 'нет slug'}) ${c.isActive ? '✅' : '❌'}`);
        });
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    if (error.message.includes('ENOTFOUND') || error.message.includes('authentication')) {
      console.log('💡 Проверьте правильность DATABASE_URL или MONGO_URL');
    }
  }
} else {
  console.log('⚠️  DATABASE_URL или MONGO_URL не установлены');
  console.log('💡 Невозможно проверить текущую базу данных');
}

// 3. Итоговый вывод
console.log('\n' + '═'.repeat(80));
console.log('\n📋 ИТОГИ ПОИСКА:\n');

if (foundCategory) {
  console.log('✅ Категория "Артефакт" найдена в локальных бэкапах');
  console.log('💡 Вы можете восстановить её из соответствующего бэкапа');
  console.log('💡 Команда для восстановления:');
  console.log('   node scripts/restore-from-cloudinary.js "путь_к_бэкапу.json"');
} else {
  console.log('❌ Категория "Артефакт" не найдена ни в одном бэкапе');
  console.log('💡 Возможно, она была удалена или никогда не существовала');
  console.log('💡 Или она называется по-другому');
}

console.log('\n💡 Полезные команды:');
console.log('   • Просмотр всех категорий и товаров: node scripts/find-backup-with-artifacts.js');
console.log('   • Восстановление бэкапа: node scripts/restore-from-cloudinary.js');

console.log('\n✅ Поиск завершен!\n');
