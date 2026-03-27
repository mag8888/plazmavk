#!/usr/bin/env node

/**
 * Поиск бэкапа с наибольшим количеством товаров (артефактов)
 * Использование: node scripts/find-backup-with-artifacts.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🔍 Поиск бэкапа с артефактами (товарами)...\n');
console.log('═'.repeat(80));

// 1. Проверяем локальные бэкапы
console.log('\n📁 ЛОКАЛЬНЫЕ БЭКАПЫ:\n');

const localBackups = fs.readdirSync(projectRoot)
  .filter(file => file.startsWith('database-backup-') && file.endsWith('.json'))
  .map(file => ({
    filename: file,
    filepath: path.join(projectRoot, file),
    stats: fs.statSync(path.join(projectRoot, file))
  }))
  .sort((a, b) => b.stats.mtime - a.stats.mtime); // Сначала новые

const backupResults = [];

for (const backup of localBackups) {
  try {
    const data = JSON.parse(fs.readFileSync(backup.filepath, 'utf8'));
    const products = data.data?.products || [];
    const categories = data.data?.categories || [];
    const users = data.data?.users || [];
    const reviews = data.data?.reviews || [];
    const audioFiles = data.data?.audioFiles || [];
    const botContent = data.data?.botContent || [];
    
    const exportDate = data.exportDate || backup.stats.mtime.toISOString();
    const statistics = data.statistics || {};
    
    backupResults.push({
      source: 'local',
      filename: backup.filename,
      filepath: backup.filepath,
      exportDate,
      size: (backup.stats.size / 1024 / 1024).toFixed(2) + ' MB',
      products: products.length,
      categories: categories.length,
      users: users.length,
      reviews: reviews.length,
      audioFiles: audioFiles.length,
      botContent: botContent.length,
      statistics,
      data: {
        products: products.map(p => ({
          id: p.id || p._id,
          title: p.title,
          price: p.price,
          isActive: p.isActive,
          category: p.category?.name || categories.find(c => (c.id || c._id) === (p.categoryId || p.category?.id || p.category?._id))?.name || 'Неизвестно'
        })),
        categories: categories.map(c => ({
          id: c.id || c._id,
          name: c.name,
          slug: c.slug,
          productCount: c.products?.length || 0
        }))
      }
    });
    
    console.log(`✅ ${backup.filename}`);
    console.log(`   📅 Дата экспорта: ${new Date(exportDate).toLocaleString('ru-RU')}`);
    console.log(`   📊 Размер: ${backup.stats.size / 1024 / 1024} MB`);
    console.log(`   🛍️  Товаров: ${products.length}`);
    console.log(`   📂 Категорий: ${categories.length}`);
    console.log(`   👥 Пользователей: ${users.length}`);
    console.log(`   ⭐ Отзывов: ${reviews.length}`);
    console.log(`   🎵 Аудио файлов: ${audioFiles.length}`);
    console.log(`   📝 Элементов контента: ${botContent.length}`);
    
  } catch (error) {
    console.error(`❌ Ошибка чтения ${backup.filename}:`, error.message);
  }
}

// 2. Проверяем бэкапы в Cloudinary
console.log('\n' + '═'.repeat(80));
console.log('\n☁️  БЭКАПЫ В CLOUDINARY:\n');

const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dt4r1tigf',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

if (cloudinaryConfig.api_key && cloudinaryConfig.api_secret) {
  try {
    cloudinary.config(cloudinaryConfig);
    
    console.log('🔍 Поиск бэкапов в Cloudinary...');
    
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'raw',
      prefix: 'plazma-bot/backups',
      max_results: 20,
      direction: -1,
    });
    
    const cloudinaryBackups = result.resources || [];
    
    if (cloudinaryBackups.length > 0) {
      console.log(`✅ Найдено бэкапов: ${cloudinaryBackups.length}\n`);
      
      for (const backup of cloudinaryBackups.slice(0, 5)) {
        const date = new Date(backup.created_at);
        const sizeMB = (backup.bytes / 1024 / 1024).toFixed(2);
        
        console.log(`📦 ${backup.filename || backup.public_id}`);
        console.log(`   📅 Дата: ${date.toLocaleString('ru-RU')}`);
        console.log(`   📊 Размер: ${sizeMB} MB`);
        console.log(`   🔗 URL: ${backup.secure_url}`);
        console.log(`   ⚠️  Для детального анализа нужно скачать файл`);
        
        backupResults.push({
          source: 'cloudinary',
          filename: backup.filename || backup.public_id,
          url: backup.secure_url,
          exportDate: backup.created_at,
          size: sizeMB + ' MB',
          products: 'неизвестно (нужно скачать)',
          categories: 'неизвестно (нужно скачать)',
        });
      }
    } else {
      console.log('⚠️  Бэкапы не найдены в Cloudinary');
    }
  } catch (error) {
    console.error('❌ Ошибка при получении бэкапов из Cloudinary:', error.message);
  }
} else {
  console.log('⚠️  Учетные данные Cloudinary не установлены');
  console.log('   💡 Для просмотра бэкапов в Cloudinary установите переменные окружения');
}

// 3. Анализ и вывод результатов
console.log('\n' + '═'.repeat(80));
console.log('\n📊 АНАЛИЗ РЕЗУЛЬТАТОВ:\n');

const localBackupsWithData = backupResults.filter(b => b.source === 'local' && typeof b.products === 'number');

if (localBackupsWithData.length > 0) {
  // Находим бэкап с наибольшим количеством товаров
  const bestBackup = localBackupsWithData.reduce((best, current) => {
    return current.products > best.products ? current : best;
  });
  
  console.log('🏆 БЭКАП С НАИБОЛЬШИМ КОЛИЧЕСТВОМ ТОВАРОВ:\n');
  console.log(`   📄 Файл: ${bestBackup.filename}`);
  console.log(`   📅 Дата: ${new Date(bestBackup.exportDate).toLocaleString('ru-RU')}`);
  console.log(`   📊 Размер: ${bestBackup.size}`);
  console.log(`   🛍️  Товаров: ${bestBackup.products}`);
  console.log(`   📂 Категорий: ${bestBackup.categories}`);
  console.log(`   👥 Пользователей: ${bestBackup.users}`);
  console.log(`   ⭐ Отзывов: ${bestBackup.reviews}`);
  console.log(`   🎵 Аудио файлов: ${bestBackup.audioFiles}`);
  console.log(`   📝 Элементов контента: ${bestBackup.botContent}`);
  
  console.log('\n📋 СПИСОК ТОВАРОВ В ЭТОМ БЭКАПЕ:\n');
  bestBackup.data.products.forEach((product, index) => {
    console.log(`${index + 1}. ${product.title}`);
    console.log(`   💰 Цена: ${product.price} PZ`);
    console.log(`   📂 Категория: ${product.category}`);
    console.log(`   ${product.isActive ? '✅' : '❌'} Активен: ${product.isActive}`);
    console.log('');
  });
  
  console.log('\n📂 КАТЕГОРИИ:\n');
  bestBackup.data.categories.forEach((category, index) => {
    console.log(`${index + 1}. ${category.name} (${category.slug})`);
    console.log(`   Товаров в категории: ${category.productCount}`);
    console.log('');
  });
  
  console.log('\n💾 ВОССТАНОВЛЕНИЕ ИЗ ЭТОГО БЭКАПА:\n');
  console.log(`   node scripts/restore-from-cloudinary.js "${bestBackup.filepath}"`);
  console.log(`   или`);
  console.log(`   npm run restore "${bestBackup.filepath}"`);
  
} else {
  console.log('⚠️  Не найдено локальных бэкапов с данными');
}

// 4. Сравнение всех бэкапов
if (localBackupsWithData.length > 1) {
  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 СРАВНЕНИЕ ВСЕХ БЭКАПОВ:\n');
  
  console.log('Файл'.padEnd(40) + 'Товары'.padEnd(10) + 'Категории'.padEnd(12) + 'Пользователи');
  console.log('-'.repeat(80));
  
  localBackupsWithData.forEach(backup => {
    const filename = backup.filename.substring(0, 38).padEnd(40);
    const products = String(backup.products).padEnd(10);
    const categories = String(backup.categories).padEnd(12);
    const users = String(backup.users);
    console.log(`${filename}${products}${categories}${users}`);
  });
}

console.log('\n' + '═'.repeat(80));
console.log('\n✅ Поиск завершен!\n');
