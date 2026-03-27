#!/usr/bin/env node

/**
 * Поиск товара "Артефакт" во всех бэкапах и текущей базе данных
 * Использование: node scripts/search-artifact.js
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

console.log('🔍 Поиск товара "Артефакт" во всех источниках...\n');
console.log('═'.repeat(80));

// 1. Поиск в локальных бэкапах
console.log('\n📁 ПОИСК В ЛОКАЛЬНЫХ БЭКАПАХ:\n');

const localBackups = fs.readdirSync(projectRoot)
  .filter(file => file.startsWith('database-backup-') && file.endsWith('.json'))
  .sort()
  .reverse();

let foundInBackups = false;

for (const backupFile of localBackups) {
  try {
    const filepath = path.join(projectRoot, backupFile);
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const products = data.data?.products || [];
    
    // Ищем товары с "артефакт" в названии, описании или summary
    const artifacts = products.filter(p => {
      const title = (p.title || '').toLowerCase();
      const description = (p.description || '').toLowerCase();
      const summary = (p.summary || '').toLowerCase();
      const searchTerm = 'артефакт';
      
      return title.includes(searchTerm) || 
             description.includes(searchTerm) || 
             summary.includes(searchTerm);
    });
    
    if (artifacts.length > 0) {
      foundInBackups = true;
      console.log(`✅ Найдено в ${backupFile}:`);
      artifacts.forEach((product, index) => {
        console.log(`\n   ${index + 1}. ${product.title}`);
        console.log(`      ID: ${product.id || product._id}`);
        console.log(`      Цена: ${product.price} PZ`);
        console.log(`      Активен: ${product.isActive ? '✅' : '❌'}`);
        console.log(`      Категория: ${product.category?.name || 'Неизвестно'}`);
        if (product.summary) {
          console.log(`      Описание: ${product.summary.substring(0, 150)}...`);
        }
      });
    } else {
      console.log(`❌ В ${backupFile} не найдено`);
    }
  } catch (error) {
    console.error(`❌ Ошибка чтения ${backupFile}:`, error.message);
  }
}

if (!foundInBackups) {
  console.log('⚠️  Товар "Артефакт" не найден ни в одном локальном бэкапе');
}

// 2. Поиск в текущей базе данных
console.log('\n' + '═'.repeat(80));
console.log('\n🔌 ПОИСК В ТЕКУЩЕЙ БАЗЕ ДАННЫХ:\n');

const databaseUrl = process.env.DATABASE_URL || process.env.MONGO_URL;

if (databaseUrl) {
  try {
    // Подключаемся к базе данных
    await mongoose.connect(databaseUrl);
    console.log('✅ Подключено к базе данных');
    
    // Ищем товары с "артефакт" напрямую через mongoose
    const db = mongoose.connection.db;
    const productsCollection = db.collection('products');
    
    const artifacts = await productsCollection.find({
      $or: [
        { title: { $regex: 'артефакт', $options: 'i' } },
        { description: { $regex: 'артефакт', $options: 'i' } },
        { summary: { $regex: 'артефакт', $options: 'i' } }
      ]
    }).toArray();
    
    if (artifacts.length > 0) {
      console.log(`✅ Найдено товаров: ${artifacts.length}\n`);
      artifacts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title}`);
        console.log(`   ID: ${product._id}`);
        console.log(`   Цена: ${product.price} PZ`);
        console.log(`   Активен: ${product.isActive ? '✅' : '❌'}`);
        if (product.summary) {
          console.log(`   Описание: ${product.summary.substring(0, 150)}...`);
        }
      });
    } else {
      console.log('❌ Товар "Артефакт" не найден в текущей базе данных');
    }
    
    // Также показываем все товары для справки
    const allProducts = await productsCollection.find({}).project({ title: 1, price: 1, isActive: 1 }).toArray();
    console.log(`\n📊 Всего товаров в базе: ${allProducts.length}`);
    if (allProducts.length > 0) {
      console.log('\n📋 Список всех товаров:');
      allProducts.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.title} (${p.price} PZ) ${p.isActive ? '✅' : '❌'}`);
      });
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    console.log('💡 Проверьте переменную DATABASE_URL или MONGO_URL');
  }
} else {
  console.log('⚠️  DATABASE_URL или MONGO_URL не установлены');
  console.log('💡 Невозможно проверить текущую базу данных');
}

// 3. Итоговый вывод
console.log('\n' + '═'.repeat(80));
console.log('\n📋 ИТОГИ ПОИСКА:\n');

if (foundInBackups) {
  console.log('✅ Товар "Артефакт" найден в локальных бэкапах');
  console.log('💡 Вы можете восстановить его из соответствующего бэкапа');
} else {
  console.log('❌ Товар "Артефакт" не найден ни в одном бэкапе');
  console.log('💡 Возможно, он был удален или никогда не существовал');
  console.log('💡 Или он называется по-другому');
}

console.log('\n💡 Полезные команды:');
console.log('   • Просмотр всех товаров: node scripts/find-backup-with-artifacts.js');
console.log('   • Восстановление бэкапа: node scripts/restore-from-cloudinary.js');

console.log('\n✅ Поиск завершен!\n');
