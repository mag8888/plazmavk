#!/usr/bin/env node

import fetch from 'node-fetch';
import { env } from '../dist/config/env.js';

const BOT_TOKEN = env.botToken;
const WEBAPP_URL = 'https://plazma-production.up.railway.app/webapp';

async function setupTelegramWebApp() {
  console.log('🤖 Настройка Telegram Web App...');
  console.log(`📱 Bot Token: ${BOT_TOKEN.substring(0, 10)}...`);
  console.log(`🌐 WebApp URL: ${WEBAPP_URL}`);

  try {
    // 1. Получаем информацию о боте
    console.log('\n1️⃣ Получение информации о боте...');
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const botInfo = await botInfoResponse.json();
    
    if (!botInfo.ok) {
      throw new Error(`Ошибка получения информации о боте: ${botInfo.description}`);
    }
    
    console.log(`✅ Бот найден: @${botInfo.result.username}`);
    console.log(`📛 Имя: ${botInfo.result.first_name}`);

    // 2. Информация о настройке Web App
    console.log('\n2️⃣ Настройка Web App URL...');
    console.log('ℹ️ Web App URL настраивается через BotFather вручную:');
    console.log('   1. Откройте @BotFather в Telegram');
    console.log('   2. Отправьте /newapp или /editapp');
    console.log('   3. Выберите вашего бота');
    console.log('   4. Введите URL:', WEBAPP_URL);
    console.log('   5. Добавьте описание и загрузите иконку');
    console.log('✅ Инструкции по настройке Web App предоставлены!');

    // 3. Получаем текущие настройки
    console.log('\n3️⃣ Проверка текущих настроек...');
    const getCommandsResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMyCommands`);
    const getCommandsResult = await getCommandsResponse.json();
    
    if (getCommandsResult.ok) {
      console.log('📋 Текущие команды бота:');
      getCommandsResult.result.forEach((command, index) => {
        console.log(`   ${index + 1}. /${command.command} - ${command.description}`);
      });
    }

    // 4. Устанавливаем команды для Web App
    console.log('\n4️⃣ Установка команд для Web App...');
    const commands = [
      { command: 'start', description: 'Запустить бота и открыть главное меню' },
      { command: 'help', description: 'Показать справку по использованию бота' },
      { command: 'shop', description: 'Открыть магазин товаров' },
      { command: 'partner', description: 'Партнерская программа' },
      { command: 'audio', description: 'Звуковые матрицы' },
      { command: 'reviews', description: 'Отзывы клиентов' },
      { command: 'about', description: 'О PLASMA Water' },
      { command: 'support', description: 'Поддержка 24/7' }
    ];

    const setCommandsResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commands: commands
      })
    });
    
    const setCommandsResult = await setCommandsResponse.json();
    
    if (!setCommandsResult.ok) {
      throw new Error(`Ошибка установки команд: ${setCommandsResult.description}`);
    }
    
    console.log('✅ Команды бота установлены успешно!');

    // 5. Проверяем Web App
    console.log('\n5️⃣ Проверка Web App...');
    try {
      const webAppTestResponse = await fetch(WEBAPP_URL);
      if (webAppTestResponse.ok) {
        console.log('✅ Web App доступен по URL');
      } else {
        console.log(`⚠️ Web App недоступен: ${webAppTestResponse.status}`);
      }
    } catch (error) {
      console.log(`⚠️ Ошибка проверки Web App: ${error.message}`);
    }

    console.log('\n🎉 Настройка завершена!');
    console.log('\n📱 Для тестирования:');
    console.log(`   1. Откройте бота: @${botInfo.result.username}`);
    console.log(`   2. Отправьте команду /start`);
    console.log(`   3. Нажмите кнопку "Открыть Web App" или используйте меню`);
    console.log(`   4. Или перейдите напрямую: ${WEBAPP_URL}`);

  } catch (error) {
    console.error('❌ Ошибка настройки:', error.message);
    process.exit(1);
  }
}

setupTelegramWebApp();
