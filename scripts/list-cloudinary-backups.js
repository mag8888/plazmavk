#!/usr/bin/env node

/**
 * Список всех бэкапов в Cloudinary
 * Использование: node scripts/list-cloudinary-backups.js
 */

import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dt4r1tigf',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Получает список всех бэкапов из Cloudinary
 */
async function listAllBackups() {
  try {
    console.log('🔍 Поиск бэкапов в Cloudinary...');
    console.log(`📁 Папка: plazma-bot/backups\n`);

    if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('❌ Ошибка: CLOUDINARY_API_KEY и CLOUDINARY_API_SECRET должны быть установлены в .env');
      console.log('\n💡 Добавьте в .env файл:');
      console.log('   CLOUDINARY_CLOUD_NAME=dt4r1tigf');
      console.log('   CLOUDINARY_API_KEY=your_api_key');
      console.log('   CLOUDINARY_API_SECRET=your_api_secret');
      process.exit(1);
    }

    // Ищем любые JSON файлы во всех папках
    const result = await cloudinary.search
      .expression('resource_type:raw AND format:json')
      .sort_by('created_at', 'desc')
      .max_results(500)
      .execute();

    const backups = result.resources || [];

    if (backups.length === 0) {
      console.log('⚠️  Бэкапы не найдены в Cloudinary');
      console.log('\n💡 Возможные причины:');
      console.log('   - Бэкапы еще не были созданы');
      console.log('   - Неправильные учетные данные Cloudinary');
      console.log('   - Бэкапы находятся в другой папке');
      return;
    }

    console.log(`✅ Найдено бэкапов: ${backups.length}\n`);
    console.log('═'.repeat(100));

    backups.forEach((backup, index) => {
      const date = new Date(backup.created_at);
      const sizeMB = (backup.bytes / 1024 / 1024).toFixed(2);
      const sizeKB = (backup.bytes / 1024).toFixed(2);
      const size = backup.bytes > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

      console.log(`\n📦 Бэкап #${index + 1}`);
      console.log(`   📄 Имя файла: ${backup.filename || backup.public_id}`);
      console.log(`   📅 Дата создания: ${date.toLocaleString('ru-RU')}`);
      console.log(`   📊 Размер: ${size}`);
      console.log(`   🔗 URL: ${backup.secure_url}`);
      console.log(`   🆔 Public ID: ${backup.public_id}`);
    });

    console.log('\n' + '═'.repeat(100));
    console.log(`\n📊 Итого: ${backups.length} бэкап(ов)`);

    if (backups.length > 0) {
      const latest = backups[0];
      const latestDate = new Date(latest.created_at);
      console.log(`\n🕐 Самый свежий бэкап: ${latest.filename || latest.public_id}`);
      console.log(`   Дата: ${latestDate.toLocaleString('ru-RU')}`);
      console.log(`   URL: ${latest.secure_url}`);
    }

    return backups;

  } catch (error) {
    console.error('❌ Ошибка получения списка бэкапов:', error);

    const errorMessage = error.error ? error.error.message : String(error);

    if (errorMessage.includes('Invalid API Key')) {
      console.log('\n💡 Проверьте правильность CLOUDINARY_API_KEY в .env');
    } else if (errorMessage.includes('Invalid API Secret') || errorMessage.includes('api_secret mismatch')) {
      console.log('\n💡 Проверьте правильность CLOUDINARY_API_SECRET в .env');
    }

    process.exit(1);
  }
}

// Запуск
listAllBackups()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });

