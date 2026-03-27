#!/usr/bin/env node

/**
 * Полное восстановление: экспорт данных из исходной MongoDB и восстановление в текущую БД.
 *
 * Использование:
 *   SOURCE_MONGO_URL="mongodb://user:pass@host:port" node scripts/sync-from-mongodb.js
 *   # или с именем БД: mongodb://...@host:port/plazma
 *
 * Требования:
 *   - SOURCE_MONGO_URL — откуда брать свежие данные (обязательно).
 *     Если в URL нет имени базы после порта, укажите его: .../50105/plazma или .../50105/railway
 *   - DATABASE_URL или MONGO_URL — куда восстанавливать (текущая БД приложения)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function docToBackup(doc) {
  if (!doc) return null;
  const d = { ...doc };
  if (d._id) {
    d.id = d._id.toString();
    delete d._id;
  }
  // Все ссылки (id, *Id) — строками для Prisma
  for (const k of Object.keys(d)) {
    if ((k === 'id' || k.endsWith('Id')) && d[k] != null)
      if (typeof d[k] === 'object' && typeof d[k].toString === 'function') d[k] = d[k].toString();
      else if (typeof d[k] === 'object' && d[k].$oid) d[k] = d[k].$oid;
  }
  ['createdAt', 'updatedAt', 'activatedAt', 'expiresAt'].forEach((k) => {
    if (d[k] && d[k].toISOString) d[k] = d[k].toISOString();
  });
  return d;
}

function mapCollection(docs) {
  return (docs || []).map(docToBackup).filter(Boolean);
}

async function exportFromSource(connection) {
  const db = connection.db;
  const data = {};
  const coll = (name) => db.collection(name);

  const tryFind = async (name) => {
    try {
      const arr = await coll(name).find({}).toArray();
      return mapCollection(arr);
    } catch (e) {
      console.warn(`   ⚠️ Коллекция ${name}:`, e.message);
      return [];
    }
  };

  console.log('📥 Экспорт категорий...');
  data.categories = await tryFind('Category');
  console.log(`   ✓ ${data.categories.length}`);

  console.log('📥 Экспорт товаров...');
  data.products = await tryFind('Product');
  console.log(`   ✓ ${data.products.length}`);

  console.log('📥 Экспорт пользователей...');
  data.users = await tryFind('User');
  console.log(`   ✓ ${data.users.length}`);

  console.log('📥 Экспорт корзины...');
  data.cartItems = await tryFind('CartItem');
  console.log(`   ✓ ${data.cartItems.length}`);

  console.log('📥 Экспорт заказов...');
  data.orders = await tryFind('OrderRequest');
  console.log(`   ✓ ${data.orders.length}`);

  console.log('📥 Экспорт партнёрских профилей...');
  data.partnerProfiles = await tryFind('PartnerProfile');
  console.log(`   ✓ ${data.partnerProfiles.length}`);

  console.log('📥 Экспорт рефералов...');
  data.partnerReferrals = await tryFind('PartnerReferral');
  console.log(`   ✓ ${data.partnerReferrals?.length || 0}`);

  console.log('📥 Экспорт транзакций партнёров...');
  data.partnerTransactions = await tryFind('PartnerTransaction');
  console.log(`   ✓ ${data.partnerTransactions?.length || 0}`);

  console.log('📥 Экспорт отзывов...');
  data.reviews = await tryFind('Review');
  console.log(`   ✓ ${data.reviews.length}`);

  console.log('📥 Экспорт аудио...');
  data.audioFiles = await tryFind('AudioFile');
  console.log(`   ✓ ${data.audioFiles.length}`);

  console.log('📥 Экспорт контента бота...');
  data.botContent = await tryFind('BotContent');
  console.log(`   ✓ ${data.botContent.length}`);

  console.log('📥 Экспорт платежей...');
  data.payments = await tryFind('Payment');
  console.log(`   ✓ ${data.payments.length}`);

  console.log('📥 Экспорт медиа...');
  data.mediaFiles = await tryFind('MediaFile');
  console.log(`   ✓ ${data.mediaFiles?.length || 0}`);

  console.log('📥 Экспорт истории активации партнёров...');
  data.partnerActivationHistory = await tryFind('PartnerActivationHistory');
  console.log(`   ✓ ${data.partnerActivationHistory?.length || 0}`);

  console.log('📥 Экспорт истории пользователей...');
  const userHistories = await tryFind('UserHistory');
  console.log(`   ✓ ${userHistories?.length || 0}`);

  data.partnerReferrals = data.partnerReferrals || [];
  data.partnerTransactions = data.partnerTransactions || [];
  data.partnerProfiles = (data.partnerProfiles || []).map((p) => ({
    ...p,
    referrals: data.partnerReferrals.filter((r) => r.profileId === p.id),
    transactions: data.partnerTransactions.filter((t) => t.profileId === p.id),
  }));
  delete data.partnerReferrals;
  delete data.partnerTransactions;

  data.users = (data.users || []).map((u) => ({
    ...u,
    histories: (userHistories || []).filter((h) => h.userId === u.id),
  }));

  return data;
}

async function main() {
  const sourceUrl = process.env.SOURCE_MONGO_URL || process.argv[2];
  const targetUrl = process.env.DATABASE_URL || process.env.MONGO_URL;

  if (!sourceUrl) {
    console.error('❌ Задайте SOURCE_MONGO_URL или передайте URL первым аргументом.');
    console.log('Пример: SOURCE_MONGO_URL="mongodb://user:pass@host:port/plazma" node scripts/sync-from-mongodb.js');
    console.log('Или:   node scripts/sync-from-mongodb.js "mongodb://user:pass@host:port/plazma"');
    process.exit(1);
  }
  if (!targetUrl) {
    console.error('❌ Задайте DATABASE_URL или MONGO_URL (куда восстанавливать).');
    process.exit(1);
  }

  console.log('🔗 Источник (свежие данные):', sourceUrl.replace(/:[^:@]+@/, ':****@'));
  console.log('🔗 Приёмник (текущая БД):', targetUrl.replace(/:[^:@]+@/, ':****@'));
  console.log('');

  let conn;
  try {
    conn = await mongoose.createConnection(sourceUrl).asPromise();
    console.log('✅ Подключение к источнику успешно\n');
  } catch (e) {
    console.error('❌ Не удалось подключиться к источнику:', e.message);
    process.exit(1);
  }

  let exportData;
  try {
    exportData = await exportFromSource(conn);
    await conn.close();
  } catch (e) {
    console.error('❌ Ошибка экспорта:', e);
    await conn.close();
    process.exit(1);
  }

  const backup = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    statistics: {
      totalCategories: exportData.categories?.length || 0,
      totalProducts: exportData.products?.length || 0,
      totalUsers: exportData.users?.length || 0,
      totalOrders: exportData.orders?.length || 0,
      totalReviews: exportData.reviews?.length || 0,
      totalPartnerProfiles: exportData.partnerProfiles?.length || 0,
    },
    data: exportData,
  };

  const tmpDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp' : path.join(__dirname, '..');
  const filepath = path.join(tmpDir, `sync-from-source-${Date.now()}.json`);
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf8');
  console.log('\n💾 Экспорт сохранён:', filepath);

  // Восстановление в целевую БД через существующий скрипт
  console.log('\n📥 Восстановление в целевую БД...');
  process.env.DATABASE_URL = targetUrl;
  process.env.MONGO_URL = targetUrl;
  try {
    const { restoreDatabase } = await import('./restore-from-cloudinary.js');
    await restoreDatabase(filepath);
    try {
      fs.unlinkSync(filepath);
    } catch (_) {}
    console.log('\n✅ Полное восстановление завершено.');
  } catch (restoreErr) {
    console.error('\n⚠️ Восстановление в целевую БД не удалось (проверьте DATABASE_URL и доступ в сеть).');
    console.log('Экспорт сохранён. Чтобы восстановить позже, выполните:');
    console.log('  node scripts/restore-from-cloudinary.js "' + filepath + '"');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
