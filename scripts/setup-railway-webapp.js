#!/usr/bin/env node

/**
 * Скрипт для настройки Telegram Web App на Railway
 * Специально для домена plazma-production.up.railway.app
 */

import { config } from 'dotenv';
import https from 'https';

// Загружаем переменные окружения
config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const RAILWAY_URL = 'https://plazma-production.up.railway.app';
const WEBAPP_URL = `${RAILWAY_URL}/webapp`;

async function setupRailwayWebApp() {
  console.log('🚀 Настройка Telegram Web App для Railway...\n');
  console.log(`🌐 Railway URL: ${RAILWAY_URL}`);
  console.log(`📱 Web App URL: ${WEBAPP_URL}\n`);

  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN не найден в переменных окружения');
    console.log('💡 Добавьте BOT_TOKEN в Railway Variables');
    process.exit(1);
  }

  console.log(`🤖 Токен бота: ${BOT_TOKEN.substring(0, 10)}...\n`);

  // Проверяем доступность веб-приложения
  await checkWebAppAvailability(WEBAPP_URL);

  // Настраиваем кнопку меню
  await setupMenuButton(WEBAPP_URL);

  // Настраиваем команды бота
  await setupBotCommands();

  console.log('\n✅ Настройка завершена!');
  console.log('\n📋 Следующие шаги:');
  console.log('1. Проверьте доступность веб-приложения в браузере');
  console.log('2. Протестируйте кнопку меню в боте');
  console.log('3. Проверьте все разделы веб-приложения');
  console.log('\n🌐 Ваше веб-приложение:');
  console.log(`   ${WEBAPP_URL}`);
}

async function checkWebAppAvailability(url) {
  console.log('🔍 Проверка доступности веб-приложения...');
  
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Веб-приложение доступно');
        resolve();
      } else {
        console.log(`⚠️  Веб-приложение отвечает с кодом ${res.statusCode}`);
        resolve();
      }
    });

    req.on('error', (err) => {
      console.log('❌ Веб-приложение недоступно:', err.message);
      console.log('💡 Убедитесь, что приложение развернуто на Railway');
      resolve(); // Не прерываем выполнение
    });

    req.setTimeout(10000, () => {
      console.log('⏰ Таймаут проверки доступности');
      req.destroy();
      resolve();
    });
  });
}

async function setupMenuButton(webappUrl) {
  console.log('🔧 Настройка кнопки меню...');

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`;
  
  const menuButton = {
    menu_button: {
      type: 'web_app',
      text: '🌐 Веб-приложение',
      web_app: {
        url: webappUrl
      }
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(menuButton)
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Кнопка меню настроена успешно');
      console.log(`   URL: ${webappUrl}`);
    } else {
      console.log('❌ Ошибка настройки кнопки меню:', result.description);
    }
  } catch (error) {
    console.log('❌ Ошибка запроса к Telegram API:', error.message);
  }
}

async function setupBotCommands() {
  console.log('🔧 Настройка команд бота...');

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`;
  
  const commands = [
    { command: 'start', description: '🚀 Запустить бота' },
    { command: 'menu', description: '📋 Главное меню' },
    { command: 'shop', description: '🛒 Открыть магазин' },
    { command: 'partner', description: '🤝 Партнёрская программа' },
    { command: 'reviews', description: '⭐ Отзывы клиентов' },
    { command: 'about', description: 'ℹ️ О PLASMA Water' },
    { command: 'support', description: '💬 Служба поддержки' }
  ];

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands })
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Команды бота настроены успешно');
    } else {
      console.log('❌ Ошибка настройки команд:', result.description);
    }
  } catch (error) {
    console.log('❌ Ошибка запроса к Telegram API:', error.message);
  }
}

// Проверяем Railway переменные
function checkRailwayVariables() {
  console.log('🔧 Проверка Railway переменных...\n');
  
  const requiredVars = [
    'BOT_TOKEN',
    'DATABASE_URL',
    'SESSION_SECRET'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log('⚠️  Отсутствуют переменные окружения:');
    missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n💡 Добавьте их в Railway Variables');
    console.log('   Railway Dashboard → Settings → Variables');
  } else {
    console.log('✅ Все необходимые переменные настроены');
  }
  
  console.log('\n🌐 Railway URL будет автоматически установлен как:');
  console.log(`   PUBLIC_BASE_URL=https://plazma-production.up.railway.app`);
  console.log(`   WEBAPP_URL=https://plazma-production.up.railway.app/webapp`);
}

// Запускаем настройку
console.log('🚂 Railway Web App Setup\n');
checkRailwayVariables();
console.log('\n' + '='.repeat(50) + '\n');

setupRailwayWebApp().catch((error) => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
