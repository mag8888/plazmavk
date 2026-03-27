#!/usr/bin/env node

/**
 * Генератор секретного ключа для Lava.top webhook
 * 
 * Использование:
 * node scripts/generate-webhook-secret.js
 */

import crypto from 'crypto';

console.log('🔐 Генерация LAVA_WEBHOOK_SECRET...\n');

// Генерируем случайный ключ
const webhookSecret = crypto.randomBytes(32).toString('hex');

console.log('✅ Сгенерированный ключ:');
console.log(`LAVA_WEBHOOK_SECRET=${webhookSecret}\n`);

console.log('📋 Добавьте эту строку в ваш .env файл:');
console.log(`LAVA_WEBHOOK_SECRET=${webhookSecret}\n`);

console.log('⚠️  ВАЖНО:');
console.log('- Сохраните этот ключ в безопасном месте');
console.log('- Никогда не коммитьте его в Git');
console.log('- Используйте одинаковый ключ для всех окружений');

console.log('\n🚀 Готово! Теперь настройте webhook в Lava.top с этим секретом.');
