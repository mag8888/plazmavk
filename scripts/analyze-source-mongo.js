#!/usr/bin/env node

/**
 * Анализ исходной MongoDB: список баз, коллекций и количество документов.
 *
 * Использование:
 *   SOURCE_MONGO_URL="mongodb://user:pass@host:port" node scripts/analyze-source-mongo.js
 *   SOURCE_MONGO_URL="mongodb://user:pass@host:port/railway" node scripts/analyze-source-mongo.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const PLAZMA_COLLECTIONS = [
  'Category',
  'Product',
  'User',
  'CartItem',
  'OrderRequest',
  'PartnerProfile',
  'PartnerReferral',
  'PartnerTransaction',
  'PartnerActivationHistory',
  'Review',
  'AudioFile',
  'BotContent',
  'Payment',
  'MediaFile',
  'UserHistory',
  'CertificateType',
  'GiftCertificate',
  'Specialist',
  'SpecialistCategory',
  'SpecialistSpecialty',
  'SpecialistService',
  'MessageTemplate',
  'Settings',
  'BalanceTopUpRequest',
];

async function main() {
  const sourceUrl =
    process.env.SOURCE_MONGO_URL ||
    process.argv[2] ||
    'mongodb://mongo:qhvgdpCniWwJzVzUoliPpzHEopBAZzOv@crossover.proxy.rlwy.net:50105';

  // Имя базы: часть после host:port в URL (mongodb://user:pass@host:port/DBNAME)
  const dbNameFromUrl = (() => {
    const afterHost = sourceUrl.split('@').pop() || '';
    const slash = afterHost.indexOf('/');
    if (slash < 0) return null;
    return afterHost.slice(slash + 1).split('?')[0] || null;
  })();

  console.log('🔗 Подключение к источнику:', sourceUrl.replace(/:[^:@]+@/, ':****@'));
  if (dbNameFromUrl) {
    console.log('   База из URL:', dbNameFromUrl);
  } else {
    console.log('   Имя базы в URL не указано — будет использована база по умолчанию (часто "test").');
  }
  console.log('');

  let conn;
  try {
    conn = await mongoose.createConnection(sourceUrl).asPromise();
  } catch (e) {
    console.error('❌ Не удалось подключиться:', e.message);
    process.exit(1);
  }

  const admin = conn.db.admin();
  let dbName = dbNameFromUrl || conn.db.databaseName;

  try {
    const { databases } = await admin.listDatabases();
    console.log('📂 Доступные базы данных:');
    for (const d of databases) {
      const marker = d.name === dbName ? ' ← текущая' : '';
      console.log(`   - ${d.name} (размер: ${(d.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)${marker}`);
    }
    console.log('');

    const collections = await conn.db.listCollections().toArray();
    console.log(`📋 Коллекции в базе "${dbName}" (всего ${collections.length}):`);
    const names = collections.map((c) => c.name).sort();

    for (const name of names) {
      try {
        const count = await conn.db.collection(name).countDocuments();
        const expected = PLAZMA_COLLECTIONS.includes(name) ? ' ✓ Plazma' : '';
        console.log(`   - ${name}: ${count} документов${expected}`);
      } catch (e) {
        console.log(`   - ${name}: (ошибка подсчёта: ${e.message})`);
      }
    }

    const missing = PLAZMA_COLLECTIONS.filter((n) => !names.includes(n));
    if (missing.length > 0) {
      console.log('\n⚠️ Коллекции Plazma, которых нет в источнике:', missing.join(', '));
    }

    console.log('\n✅ Анализ завершён.');
    console.log('\nДля переноса в Plazma задайте DATABASE_URL (куда писать) и выполните:');
    console.log('  SOURCE_MONGO_URL="' + sourceUrl.replace(/:[^:@]+@/, ':****@') + '" node scripts/sync-from-mongodb.js');
    if (!dbNameFromUrl) {
      console.log('\nЕсли данные лежат в другой базе (например railway), укажите её в URL:');
      console.log('  SOURCE_MONGO_URL="...@host:50105/railway" node scripts/sync-from-mongodb.js');
    }
  } finally {
    await conn.close();
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
