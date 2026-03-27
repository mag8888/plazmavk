#!/usr/bin/env node

/**
 * Скрипт для настройки Telegram Web App
 * Настраивает кнопку меню в боте и проверяет доступность веб-приложения
 */

import { config } from 'dotenv';
import https from 'https';
import http from 'http';

// Загружаем переменные окружения
config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://plazma-production.up.railway.app';
const WEBAPP_URL = process.env.WEBAPP_URL || PUBLIC_BASE_URL + '/webapp';

async function setupWebApp() {
  console.log('🚀 Настройка Telegram Web App...\n');

  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN не найден в переменных окружения');
    process.exit(1);
  }

  if (!PUBLIC_BASE_URL) {
    console.error('❌ PUBLIC_BASE_URL не найден в переменных окружения');
    process.exit(1);
  }

  const webappUrl = WEBAPP_URL || `${PUBLIC_BASE_URL}/webapp`;
  
  console.log(`📱 URL веб-приложения: ${webappUrl}`);
  console.log(`🤖 Токен бота: ${BOT_TOKEN.substring(0, 10)}...\n`);

  // Проверяем доступность веб-приложения
  await checkWebAppAvailability(webappUrl);

  // Настраиваем кнопку меню
  await setupMenuButton(webappUrl);

  // Настраиваем команды бота
  await setupBotCommands();

  console.log('\n✅ Настройка завершена!');
  console.log('\n📋 Следующие шаги:');
  console.log('1. Убедитесь, что сервер запущен');
  console.log('2. Проверьте доступность веб-приложения в браузере');
  console.log('3. Протестируйте кнопку меню в боте');
  console.log('4. Настройте SSL сертификат для HTTPS');
}

async function checkWebAppAvailability(url) {
  console.log('🔍 Проверка доступности веб-приложения...');
  
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
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
      console.log('💡 Убедитесь, что сервер запущен на правильном порту');
      resolve(); // Не прерываем выполнение
    });

    req.setTimeout(5000, () => {
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

// Запускаем настройку
setupWebApp().catch((error) => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
