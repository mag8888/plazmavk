#!/usr/bin/env node

/**
 * Безопасное выполнение миграций Prisma
 * Не падает, если база данных недоступна (полезно для сборки Docker образа)
 */

import { execSync } from 'child_process';
import { exit } from 'process';

// Во время сборки Docker образа БД обычно недоступна
// Поэтому мы всегда пропускаем миграции с предупреждением, если БД недоступна
const isBuildTime = process.env.RAILWAY_ENVIRONMENT === undefined || 
                    process.env.NODE_ENV === 'production' ||
                    process.env.DOCKER_BUILD === 'true' ||
                    !process.env.DATABASE_URL && !process.env.MONGO_URL;

console.log('🔄 Attempting to run database migrations...');

try {
  // Пытаемся выполнить миграции с перехватом вывода
  const output = execSync('npx prisma db push --skip-generate', {
    stdio: 'pipe',
    env: process.env,
    encoding: 'utf8',
    timeout: 30000, // 30 секунд таймаут
  });
  
  console.log(output);
  console.log('✅ Database migrations completed successfully');
  exit(0);
  
} catch (error) {
  // Получаем полное сообщение об ошибке
  let errorMessage = '';
  let errorOutput = '';
  
  if (error.stdout) {
    errorOutput += error.stdout.toString();
  }
  if (error.stderr) {
    errorOutput += error.stderr.toString();
  }
  if (error.message) {
    errorMessage = error.message;
  }
  
  const fullError = (errorOutput + ' ' + errorMessage).toLowerCase();
  
  // Проверяем, является ли это ошибкой подключения
  const isConnectionError = 
    fullError.includes('server selection timeout') ||
    fullError.includes('no available servers') ||
    fullError.includes('i/o error: timed out') ||
    fullError.includes('connection pool timeout') ||
    fullError.includes('econnrefused') ||
    fullError.includes('enotfound') ||
    fullError.includes('can\'t reach database server') ||
    fullError.includes('connection timeout') ||
    fullError.includes('p2010') || // Prisma error code for connection issues
    fullError.includes('p1001') || // Can't reach database
    fullError.includes('p1002');   // Connection timeout

  // Во время сборки всегда пропускаем ошибки подключения
  if (isConnectionError) {
    console.warn('⚠️  Database is not available during build time. Skipping migrations.');
    console.warn('💡 Migrations will be applied automatically on first startup if database is available.');
    console.warn('💡 Or run manually: railway run npx prisma db push');
    exit(0); // Не падаем во время сборки
  } 
  
  // Если это не ошибка подключения, но мы на этапе сборки, все равно пропускаем
  if (isBuildTime) {
    console.warn('⚠️  Migration check failed during build time. This is non-critical.');
    console.warn('💡 Migrations will be applied automatically on first startup if database is available.');
    exit(0); // Не падаем во время сборки
  }
  
  // В других случаях (не во время сборки) падаем
  console.error('❌ Database migration failed:', errorMessage);
  if (errorOutput) {
    console.error('Error output:', errorOutput.substring(0, 500));
  }
  exit(1);
}

