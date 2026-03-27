#!/usr/bin/env node

/**
 * Поиск аудио/файлов в Cloudinary (для «Звуковые матрицы»)
 * Использование: node scripts/list-cloudinary-audio.js [префикс папки]
 *
 * Примеры:
 *   node scripts/list-cloudinary-audio.js
 *   node scripts/list-cloudinary-audio.js plazma
 *   node scripts/list-cloudinary-audio.js plazma/audio
 */

import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dt4r1tigf',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prefixesToTry = [
  'plazma/audio',
  'plazma',
  'audio',
  'vital/audio',
  'gift',
  'plazma-bot/audio',
];

async function listResources(prefix, resourceType, maxResults = 100) {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: prefix || undefined,
      resource_type: resourceType,
      max_results: maxResults,
    });
    return result.resources || [];
  } catch (e) {
    return [];
  }
}

async function main() {
  const customPrefix = process.argv[2];
  const prefixes = customPrefix ? [customPrefix] : prefixesToTry;

  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Задайте CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET в .env');
    process.exit(1);
  }

  console.log('🔍 Поиск аудио/файлов в Cloudinary...\n');

  for (const prefix of prefixes) {
    console.log(`📁 Папка: ${prefix || '(корень)'}`);
    for (const resourceType of ['raw', 'video']) {
      const resources = await listResources(prefix, resourceType);
      if (resources.length > 0) {
        console.log(`   [${resourceType}] найдено: ${resources.length}`);
        resources.slice(0, 15).forEach((r, i) => {
          const url = r.secure_url || r.url;
          const size = r.bytes ? ` ${(r.bytes / 1024).toFixed(1)} KB` : '';
          console.log(`      ${i + 1}. ${r.public_id}${size}`);
          console.log(`         ${url}`);
        });
        if (resources.length > 15) {
          console.log(`      ... и ещё ${resources.length - 15}`);
        }
        console.log('');
      }
    }
  }

  console.log('💡 Чтобы использовать папку в боте, задайте в .env: CLOUDINARY_AUDIO_FOLDER=plazma/audio');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
