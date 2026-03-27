#!/usr/bin/env node

/**
 * Поиск всех баз данных и бэкапов проекта
 * Использование: node scripts/find-databases.js
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

console.log('🔍 Поиск баз данных и бэкапов...\n');
console.log('═'.repeat(80));

// 1. Локальные файлы баз данных
console.log('\n📁 ЛОКАЛЬНЫЕ ФАЙЛЫ БАЗ ДАННЫХ:\n');

const dbFiles = [
  'game_rooms.db',
  'game_data.sqlite',
  'database-backup-*.json',
];

let foundLocal = false;

// Проверяем SQLite файлы
const sqliteFiles = ['game_rooms.db', 'game_data.sqlite'];
sqliteFiles.forEach(file => {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`✅ ${file}`);
    console.log(`   📍 Путь: ${filePath}`);
    console.log(`   📊 Размер: ${sizeMB} MB`);
    console.log(`   📅 Изменен: ${stats.mtime.toLocaleString('ru-RU')}`);
    foundLocal = true;
  }
});

// Проверяем JSON бэкапы
const jsonBackups = fs.readdirSync(projectRoot)
  .filter(file => file.startsWith('database-backup-') && file.endsWith('.json'));

if (jsonBackups.length > 0) {
  jsonBackups.forEach(file => {
    const filePath = path.join(projectRoot, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`✅ ${file}`);
    console.log(`   📍 Путь: ${filePath}`);
    console.log(`   📊 Размер: ${sizeMB} MB`);
    console.log(`   📅 Изменен: ${stats.mtime.toLocaleString('ru-RU')}`);
    foundLocal = true;
  });
}

if (!foundLocal) {
  console.log('⚠️  Локальные файлы баз данных не найдены');
}

// 2. Текущее подключение к базе данных
console.log('\n' + '═'.repeat(80));
console.log('\n🔌 ТЕКУЩЕЕ ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ:\n');

const databaseUrl = process.env.DATABASE_URL || process.env.MONGO_URL;

if (databaseUrl) {
  // Маскируем пароль в URL
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`✅ DATABASE_URL установлен`);
  console.log(`   🔗 ${maskedUrl}`);
  
  // Определяем тип базы данных
  if (databaseUrl.includes('mongodb+srv://')) {
    console.log(`   📊 Тип: MongoDB Atlas`);
  } else if (databaseUrl.includes('mongodb://')) {
    if (databaseUrl.includes('mongo')) {
      console.log(`   📊 Тип: Railway MongoDB`);
    } else {
      console.log(`   📊 Тип: MongoDB (локальная или другая)`);
    }
  } else {
    console.log(`   📊 Тип: Неизвестный формат`);
  }
  
  // Извлекаем имя базы данных
  try {
    const url = new URL(databaseUrl.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
    const dbName = url.pathname.split('/')[1] || 'не указано';
    console.log(`   📂 База данных: ${dbName}`);
  } catch (e) {
    console.log(`   📂 База данных: не удалось определить`);
  }
} else {
  console.log('⚠️  DATABASE_URL или MONGO_URL не установлены');
  console.log('   💡 Установите переменные окружения для подключения к базе данных');
}

// 3. Бэкапы в Cloudinary
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
    console.log(`📁 Папка: plazma-bot/backups\n`);
    
    // Используем api.resources вместо search для совместимости
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'raw',
      prefix: 'plazma-bot/backups',
      max_results: 50,
      direction: -1, // Сначала новые
    });
    
    const backups = result.resources || [];
    
    if (backups.length > 0) {
      console.log(`✅ Найдено бэкапов: ${backups.length}\n`);
      
      backups.slice(0, 10).forEach((backup, index) => {
        const date = new Date(backup.created_at);
        const sizeMB = (backup.bytes / 1024 / 1024).toFixed(2);
        
        console.log(`📦 Бэкап #${index + 1}`);
        console.log(`   📄 Имя: ${backup.filename || backup.public_id}`);
        console.log(`   📅 Дата: ${date.toLocaleString('ru-RU')}`);
        console.log(`   📊 Размер: ${sizeMB} MB`);
        console.log(`   🔗 URL: ${backup.secure_url}`);
      });
      
      if (backups.length > 10) {
        console.log(`\n   ... и еще ${backups.length - 10} бэкап(ов)`);
      }
      
      const latest = backups[0];
      const latestDate = new Date(latest.created_at);
      console.log(`\n🕐 Самый свежий бэкап:`);
      console.log(`   📄 ${latest.filename || latest.public_id}`);
      console.log(`   📅 ${latestDate.toLocaleString('ru-RU')}`);
      console.log(`   🔗 ${latest.secure_url}`);
    } else {
      console.log('⚠️  Бэкапы не найдены в Cloudinary');
      console.log('   💡 Возможно, бэкапы еще не были созданы');
    }
  } catch (error) {
    console.error('❌ Ошибка при получении бэкапов из Cloudinary:', error.message);
    if (error.message.includes('Invalid API Key')) {
      console.log('   💡 Проверьте правильность CLOUDINARY_API_KEY');
    } else if (error.message.includes('Invalid API Secret')) {
      console.log('   💡 Проверьте правильность CLOUDINARY_API_SECRET');
    }
  }
} else {
  console.log('⚠️  Учетные данные Cloudinary не установлены');
  console.log('   💡 Установите переменные окружения:');
  console.log('      CLOUDINARY_CLOUD_NAME=dt4r1tigf');
  console.log('      CLOUDINARY_API_KEY=your_api_key');
  console.log('      CLOUDINARY_API_SECRET=your_api_secret');
}

// 4. Итоговая информация
console.log('\n' + '═'.repeat(80));
console.log('\n📋 ИТОГОВАЯ ИНФОРМАЦИЯ:\n');

console.log('📍 Где находятся базы данных:');
console.log('   1. Локальные файлы: корень проекта (/Users/ADMIN/PLAZMA)');
console.log('   2. Railway MongoDB: через переменную DATABASE_URL');
console.log('   3. Cloudinary бэкапы: папка plazma-bot/backups');

console.log('\n🔧 Полезные команды:');
console.log('   • Просмотр бэкапов: node scripts/list-cloudinary-backups.js');
console.log('   • Восстановление: node scripts/restore-from-cloudinary.js');
console.log('   • Создание бэкапа: node scripts/backup-database-railway.js');

console.log('\n📚 Документация:');
console.log('   • FIND_BACKUPS_IN_CLOUDINARY.md - поиск бэкапов');
console.log('   • RESTORE_FROM_BACKUP.md - восстановление из бэкапа');
console.log('   • BACKUP_SETUP.md - настройка автоматических бэкапов');

console.log('\n✅ Поиск завершен!\n');
