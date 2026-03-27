/**
 * Refactored Server
 * Главный сервер с новой архитектурой
 */

// Ensure production mode for AdminJS
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

import express from 'express';
import session from 'express-session';
import { session as telegrafSession, Telegraf } from 'telegraf';
import { env } from './config/env.js';
import { Context, SessionData } from './bot/context.js';
import { applyBotModules } from './bot/setup-modules.js';
import { prisma } from './lib/prisma.js';
import { ensureInitialData } from './lib/bootstrap.js';
import { adminRouter } from './admin/web-refactored.js';
import { webappRouter } from './webapp/webapp.js';
import { webappV2Router } from './webapp/webapp-v2.js';
import { setBotInstance } from './lib/bot-instance.js';

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    
    await ensureInitialData();
    console.log('✅ Initial data ensured');

    const app = express();
    
    // Middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // CORS для веб-приложения
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Telegram-Init-Data');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Настройка сессий
    app.use(session({
      secret: process.env.SESSION_SECRET || 'vital-bot-secret-key-refactored',
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 часа
        httpOnly: true,
        sameSite: 'lax'
      }
    }));

    // Перенаправление с корня на веб-приложение
    app.get('/', (req, res) => {
      res.redirect('/webapp');
    });

    // Маршруты
    app.use('/admin', adminRouter);
    app.use('/webapp', webappRouter);
    app.use('/webapp-v2', webappV2Router);

    // API для бота
    app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '2.0.0-refactored'
      });
    });

    // Обработка ошибок
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Server Error:', err);
      
      if (req.accepts('json')) {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
        });
      } else {
        res.status(500).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Error - Vital Bot</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f7fa;
                margin: 0;
                padding: 50px;
                text-align: center;
              }
              .error-container {
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                max-width: 500px;
                margin: 0 auto;
              }
              .error-icon {
                font-size: 48px;
                margin-bottom: 20px;
              }
              .error-title {
                font-size: 24px;
                color: #e74c3c;
                margin-bottom: 15px;
              }
              .error-message {
                color: #666;
                margin-bottom: 30px;
                line-height: 1.5;
              }
              .back-btn {
                background: #667eea;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                transition: background 0.3s ease;
              }
              .back-btn:hover {
                background: #5a6fd8;
              }
            </style>
          </head>
          <body>
            <div class="error-container">
              <div class="error-icon">⚠️</div>
              <h1 class="error-title">Server Error</h1>
              <p class="error-message">
                ${process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong. Please try again later.'}
              </p>
              <a href="/" class="back-btn">Go Home</a>
            </div>
          </body>
          </html>
        `);
      }
    });

    // 404 обработчик
    app.use((req, res) => {
      if (req.accepts('json')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Route ${req.method} ${req.path} not found`
        });
      } else {
        res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>404 - Vital Bot</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f7fa;
                margin: 0;
                padding: 50px;
                text-align: center;
              }
              .error-container {
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                max-width: 500px;
                margin: 0 auto;
              }
              .error-icon {
                font-size: 48px;
                margin-bottom: 20px;
              }
              .error-title {
                font-size: 24px;
                color: #667eea;
                margin-bottom: 15px;
              }
              .error-message {
                color: #666;
                margin-bottom: 30px;
                line-height: 1.5;
              }
              .back-btn {
                background: #667eea;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                transition: background 0.3s ease;
              }
              .back-btn:hover {
                background: #5a6fd8;
              }
            </style>
          </head>
          <body>
            <div class="error-container">
              <div class="error-icon">🔍</div>
              <h1 class="error-title">Page Not Found</h1>
              <p class="error-message">
                The page you're looking for doesn't exist.
              </p>
              <a href="/" class="back-btn">Go Home</a>
            </div>
          </body>
          </html>
        `);
      }
    });

    // Инициализация бота
    const bot = new Telegraf<Context>(env.botToken);
    bot.use(telegrafSession());
    
    setBotInstance(bot);
    await applyBotModules(bot);
    
    // Запуск бота
    await bot.launch();
    
    console.log('✅ Bot modules applied');
    console.log('✅ Bot launched successfully');
    console.log('✅ Server ready');

    // Запуск сервера
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Webapp: http://localhost:${PORT}/webapp`);
      console.log(`🔧 Admin: http://localhost:${PORT}/admin`);
      console.log(`🤖 Bot: @${bot.botInfo?.username || 'vital-bot'}`);
    });

  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

// Обработка завершения процесса
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Запуск
bootstrap().catch(error => {
  console.error('❌ Application failed to start:', error);
  process.exit(1);
});
