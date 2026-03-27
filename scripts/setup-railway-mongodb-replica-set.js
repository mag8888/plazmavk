#!/usr/bin/env node

/**
 * Скрипт для настройки Railway MongoDB как replica set
 * 
 * Использование:
 *   railway run node scripts/setup-railway-mongodb-replica-set.js
 * 
 * Или через Railway CLI:
 *   railway link
 *   railway run node scripts/setup-railway-mongodb-replica-set.js
 */

const { MongoClient } = require('mongodb');

async function setupReplicaSet() {
  const mongoUrl = process.env.MONGO_URL || process.env.DATABASE_URL;
  
  if (!mongoUrl) {
    console.error('❌ MONGO_URL or DATABASE_URL not found in environment variables');
    console.error('💡 Make sure you are running this script in Railway environment');
    process.exit(1);
  }

  console.log('🔗 Connecting to MongoDB...');
  console.log('📍 URL:', mongoUrl.replace(/:[^:@]+@/, ':****@')); // Скрываем пароль

  let client;
  try {
    client = new MongoClient(mongoUrl);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const adminDb = client.db().admin();
    
    // Проверяем текущий статус replica set
    console.log('🔍 Checking replica set status...');
    try {
      const status = await adminDb.command({ replSetGetStatus: 1 });
      console.log('✅ Replica set already configured:', status.set);
      console.log('📊 Status:', JSON.stringify(status, null, 2));
      return;
    } catch (error) {
      if (error.message.includes('not yet initialized') || error.message.includes('no replset config')) {
        console.log('⚠️  Replica set not initialized, initializing...');
      } else {
        throw error;
      }
    }

    // Получаем hostname для replica set
    const serverStatus = await adminDb.command({ serverStatus: 1 });
    const hostname = serverStatus.host || 'localhost';
    const port = mongoUrl.match(/:(\d+)/)?.[1] || '27017';
    const host = `${hostname}:${port}`;

    console.log('🔧 Initializing replica set with host:', host);

    // Инициализируем replica set
    try {
      const result = await adminDb.command({
        replSetInitiate: {
          _id: 'rs0',
          members: [
            { _id: 0, host: host }
          ]
        }
      });
      
      console.log('✅ Replica set initialized:', JSON.stringify(result, null, 2));
      console.log('⏳ Waiting for replica set to be ready...');
      
      // Ждем, пока replica set станет готовым
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const status = await adminDb.command({ replSetGetStatus: 1 });
          if (status.members && status.members.length > 0) {
            const primary = status.members.find(m => m.stateStr === 'PRIMARY');
            if (primary) {
              console.log('✅ Replica set is ready!');
              console.log('📊 Primary:', primary.name);
              break;
            }
          }
        } catch (error) {
          // Продолжаем ждать
        }
        attempts++;
        if (attempts % 5 === 0) {
          console.log(`⏳ Still waiting... (${attempts}/${maxAttempts})`);
        }
      }

      if (attempts >= maxAttempts) {
        console.warn('⚠️  Replica set initialization may not be complete. Please check manually.');
      }

      console.log('\n✅ Replica set setup complete!');
      console.log('💡 Update DATABASE_URL to include replicaSet=rs0:');
      console.log(`   ${mongoUrl.split('?')[0]}?${mongoUrl.includes('?') ? mongoUrl.split('?')[1] + '&' : ''}replicaSet=rs0`);
      
    } catch (error) {
      if (error.message.includes('already initialized')) {
        console.log('✅ Replica set already initialized');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Error setting up replica set:', error.message);
    console.error('💡 Make sure you have admin privileges on MongoDB');
    console.error('💡 If this doesn\'t work, consider using MongoDB Atlas instead');
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Запускаем скрипт
setupReplicaSet().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
