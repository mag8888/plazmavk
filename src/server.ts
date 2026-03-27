// Ensure production mode for AdminJS
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
// Force deploy trigger

import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { session as telegrafSession, Telegraf } from 'telegraf';
import { env } from './config/env.js';
import { Context, SessionData } from './bot/context.js';
import { applyBotModules } from './bot/setup-modules.js';
import { prisma } from './lib/prisma.js';
import { ensureInitialData } from './lib/bootstrap.js';
import { adminWebRouter } from './admin/web.js';
import { webappRouter } from './webapp/webapp.js';
import { webappV2Router } from './webapp/webapp-v2.js';
import { broadcastRouter } from './admin/broadcast-router.js';
import lavaWebhook from './webhooks/lava.js';
import { externalApiRouter } from './api/external.js';
// YooKassa intentionally not used (delivery flow работает без онлайн-оплаты)
import { setBotInstance } from './lib/bot-instance.js';

async function bootstrap() {
  try {
    const app = express();

    // Security headers
    app.use(helmet({
      contentSecurityPolicy: false, // CSP managed by individual pages
      crossOriginEmbedderPolicy: false, // Needed for Telegram WebApp
      crossOriginOpenerPolicy: false, // CRITICAL FOR VK Bridge: prevents severing postMessage to window.parent
      crossOriginResourcePolicy: false, // Allows cross-origin resources
      xFrameOptions: false, // CRITICAL FOR VK MINI APPS (helmet v8+)
    }));

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 login attempts per 15 min
      message: { error: 'Too many login attempts. Try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    const apiLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Serve static files from uploads directory
    app.use('/uploads', express.static('uploads'));

    const port = Number(process.env.PORT ?? 3000);

    // Health check endpoints (Early init for Railway)
    app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
    app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok', bot: 'active' }));
    app.get('/', (req, res) => {
      if (req.headers['user-agent']?.includes('Railway') || req.query.healthcheck) {
        res.status(200).json({ status: 'ok', service: 'plazma-bot' });
      } else {
        res.redirect('/webapp');
      }
    });

    // Start server IMMEDIATELY
    app.listen(port, '0.0.0.0', () => {
      console.log(`🌐 Server is running on port ${port}`);
    });

    // Try to connect to database with timeout
    let dbConnected = false;
    try {
      await Promise.race([
        prisma.$connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database connection timeout')), 15000)
        )
      ]);
      dbConnected = true;
      console.log('✅ Database connected successfully');
    } catch (dbError: any) {
      console.warn('⚠️  Database connection failed:', dbError?.message || 'Unknown error');

      // Check for specific error types
      if (dbError?.message?.includes('Server selection timeout')) {
        console.error('❌ MongoDB connection issue:');
        console.error('   1. Check DATABASE_URL in Railway variables (Railway MongoDB or external)');
        console.error('   2. Ensure host is reachable and port is correct');
      } else if (dbError?.message?.includes('Authentication failed')) {
        console.error('❌ MongoDB authentication failed:');
        console.error('   1. Check username and password in DATABASE_URL');
        console.error('   2. For Railway MongoDB add ?authSource=admin to the URL');
      } else if (dbError?.message?.includes('fatal alert')) {
        console.error('❌ SSL/TLS connection error: check DATABASE_URL and network');
      }

      console.warn('⚠️  Server will start, but database operations may fail');
      console.warn('⚠️  Connection will be retried on first database query');
    }

    // Run initial data setup in background (non-blocking)
    if (dbConnected) {
      ensureInitialData().catch((err: any) => {
        console.warn('⚠️  Failed to initialize data:', err?.message || err);
      });
    } else {
      console.warn('⚠️  Skipping initial data setup - database not connected');
    }


    // App initialized at top
    // Trust proxy (required for secure cookies behind Railway load balancer)
    app.set('trust proxy', 1);


    // CORS for webapp — restrict to known origins
    const allowedOrigins = [
      process.env.PUBLIC_BASE_URL,
      process.env.WEBAPP_BASE_URL,
      'http://localhost:3000',
      'http://localhost:8080',
    ].filter(Boolean) as string[];

    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.some(o => origin.startsWith(o))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Telegram-Init-Data, X-Telegram-User');
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Configure session middleware (PostgreSQL)
    // Dynamic import to avoid issues if module is missing during build
    const pgSession = (await import('connect-pg-simple')).default(session);
    const pgPool = new (await import('pg')).Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 2 // Limit session connections to 2 to prevent exhaustion
    });

    // Handle pool errors to prevent unhandled crashes
    pgPool.on('error', (err: any) => {
      console.error('⚠️ Session pool error (non-fatal):', err?.message || err);
    });

    const sessionStore = new pgSession({
      pool: pgPool as any,
      tableName: 'session',
      createTableIfMissing: true,
      errorLog: (err: any) => {
        console.error('⚠️ Session store error:', err?.message || err);
      }
    });

    app.use(session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || (() => { console.error('⚠️  SESSION_SECRET not set! Using random secret (sessions will not persist across restarts)'); return require('crypto').randomBytes(32).toString('hex'); })(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      }
    }));

    // Catch session errors that slip through middleware
    app.use((err: any, req: any, res: any, next: any) => {
      if (err?.code === 'EBADCSRF' || err?.message?.includes('session')) {
        console.error('⚠️ Session middleware error, clearing cookie:', err?.message);
        res.clearCookie('connect.sid');
        return res.redirect(req.originalUrl);
      }
      next(err);
    });
    // Health checks moved to top


    // Alias /products for frontend (which expects it at root)
    app.get('/products', async (req, res) => {
      try {
        const { getProductsByCategory, getAllActiveProducts } = await import('./services/shop-service.js');
        const categoryId = req.query.categoryId as string;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

        console.log('🛍️ GET /products (root alias) params:', { categoryId, limit, offset });

        let products;
        if (categoryId) {
          products = await getProductsByCategory(categoryId);
        } else {
          products = await getAllActiveProducts();
        }

        // Apply pagination if needed
        if (limit) {
          const start = offset || 0;
          products = products.slice(start, start + limit);
        }

        res.json(products);
      } catch (error) {
        console.error('❌ Error in root /products alias:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Web admin panel
    app.use('/admin/login', loginLimiter);
    app.use('/admin/broadcasts', broadcastRouter);
    app.use('/admin', adminWebRouter);

    // Initialize bot separately (Moved up for Webhook support)
    const bot = new Telegraf<Context>(env.botToken, {
      handlerTimeout: 30_000,
    });

    // bot.use(
    //   telegrafSession<SessionData, Context>({
    //     defaultSession: (): SessionData => ({ uiMode: 'classic' }),
    //   })
    // );
    const { prismaSession } = await import('./bot/middleware/session.js');
    bot.use(prismaSession);

    // GLOBAL MIDDLEWARE: Ensure user data is always saved/updated on every interaction
    bot.use(async (ctx, next) => {
      try {
        if (ctx.from) {
          const { ensureUser } = await import('./services/user-history.js');
          await ensureUser(ctx);
        }
      } catch (err) {
        console.error('⚠️ Global ensureUser failed:', err);
      }
      return next();
    });

    await applyBotModules(bot);

    // Register cart actions
    const { registerCartActions } = await import('./modules/cart/index.js');
    registerCartActions(bot);

    // Initialize Scheduler
    const { schedulerService } = await import('./services/scheduler-service.js');
    schedulerService.initialize();

    // Set global bot instance for admin panel
    setBotInstance(bot);

    // Register bot commands
    try {
      await bot.telegram.setMyCommands([
        { command: 'start', description: 'Запустить бота и открыть главное меню' },
        { command: 'help', description: 'Показать справку по использованию бота' },
        { command: 'shop', description: 'Открыть магазин товаров' },
        { command: 'partner', description: 'Партнерская программа' },
        { command: 'audio', description: 'Звуковые матрицы' },
        { command: 'reviews', description: 'Отзывы клиентов' },
        { command: 'about', description: 'О PLASMA Water' },
        { command: 'add_balance', description: 'Пополнить баланс через Lava' },
        { command: 'support', description: 'Поддержка 24/7' },
        { command: 'app', description: 'Открыть веб-приложение' }
      ]);
      console.log('Bot commands registered successfully');
    } catch (error: any) {
      if (error.code === 'ETIMEDOUT' || error.errno === 'ETIMEDOUT') {
        console.warn('⚠️  Telegram API timeout when registering commands - continuing anyway');
      } else {
        console.error('Failed to register bot commands:', error.message || error);
      }
    }

    // Set single blue menu button to open WebApp
    try {
      const baseUrl = env.webappUrl || env.publicBaseUrl || 'https://vital-production-82b0.up.railway.app';
      const webappUrl = baseUrl.includes('/webapp') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/webapp`;
      await bot.telegram.setChatMenuButton({
        menuButton: {
          type: 'web_app',
          text: 'Магазин',
          web_app: { url: webappUrl }
        }
      });
      console.log('Bot menu button set to WebApp');
    } catch (error: any) {
      if (error.code === 'ETIMEDOUT' || error.errno === 'ETIMEDOUT') {
        console.warn('⚠️  Telegram API timeout when setting menu button');
      } else {
        console.warn('Failed to set menu button:', error?.message || error);
      }
    }

    // WEBHOOK CONFIGURATION (Production / 3 Replicas)
    // We use a fixed path for webhook
    const webhookPath = '/api/telegram-webhook';

    // Determine public domain (must be HTTPS)
    const tempDomain = env.webappUrl || env.publicBaseUrl || 'https://plazma.up.railway.app';
    // Clean domain: remove /webapp if present, remove trailing slash
    const domain = tempDomain.replace(/\/webapp\/?$/, '').replace(/\/$/, '');
    const webhookUrl = `${domain}${webhookPath}`;

    console.log(`🌍 Configured Webhook URL: ${webhookUrl}`);

    // Set webhook (background, don't await/block startup significantly)
    // Clear any pending updates? No, just set.
    bot.telegram.setWebhook(webhookUrl)
      .then(() => console.log(`✅ Webhook set successfully to ${webhookUrl}`))
      .catch(err => {
        console.error('❌ Failed to set webhook:', err?.message || err);
      });

    // Mount webhook middleware BEFORE 404 handler
    app.use(bot.webhookCallback(webhookPath));
    console.log(`✅ Bot webhook middleware mounted at ${webhookPath}`);

    // Webapp routes
    app.use('/webapp/api', apiLimiter);
    app.use('/webapp', webappRouter);
    app.use('/webapp-v2', webappV2Router);
    app.use('/api/external', externalApiRouter);

    // Public API routes
    const { promotionsApiRouter } = await import('./api/promotions.js');
    app.use('/api/promotions', promotionsApiRouter);


    // Log route registration
    console.log('✅ Routes registered:');
    console.log('   - GET / → redirects to /webapp');
    console.log('   - GET /health → health check');
    console.log('   - GET /api/health → API health check');
    console.log('   - /admin → admin panel');
    console.log('   - /webapp → web application');

    // Lava webhook routes (only if Lava is enabled)
    const { lavaService } = await import('./services/lava-service.js');
    if (lavaService.isEnabled()) {
      app.use('/webhook', lavaWebhook);
      console.log('✅ Lava webhook routes enabled');
    } else {
      console.log('ℹ️  Lava webhook routes disabled (Lava service not configured)');
    }

    // Favicon handler (silence 404s)
    app.get('/favicon.ico', (req, res) => res.status(204).end());

    // 404 handler for unknown routes
    app.use((req, res) => {
      console.log(`⚠️  404: ${req.method} ${req.path}`);
      if (req.path.startsWith('/api')) {
        res.status(404).json({ error: 'Not found', path: req.path });
      } else {
        // For non-API routes, redirect to webapp
        res.redirect('/webapp');
      }
    });

    // app.listen moved to top




    // Graceful shutdown handlers
    process.once('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      try {
        bot.stop('SIGINT');
      } catch (error) {
        console.warn('⚠️  Error stopping bot:', error);
      }
      process.exit(0);
    });

    process.once('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      try {
        bot.stop('SIGTERM');
      } catch (error) {
        console.warn('⚠️  Error stopping bot:', error);
      }
      process.exit(0);
    });

    // Handle unhandled errors - don't crash server
    process.on('unhandledRejection', (reason, promise) => {
      console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit - log and continue (server should keep running)
    });

    process.on('uncaughtException', (error) => {
      console.error('⚠️  Uncaught Exception:', error);
      // Only exit on critical errors, not on bot errors
      if (error.message?.includes('Database') || error.message?.includes('Prisma')) {
        console.error('❌ Critical database error - exiting');
        process.exit(1);
      }
      // Don't exit for other errors - log and continue
    });

  } catch (error: any) {
    console.error('❌ Bootstrap error:', error?.message || error);
    // Only exit if it's a critical database connection error before server starts
    if (error instanceof Error && (error.message.includes('Database') || error.message.includes('connect'))) {
      console.error('❌ Critical database error during bootstrap - exiting');
      process.exit(1);
    }
    // For other errors (like bot conflicts), server might still be partially functional
    console.warn('⚠️  Server may be partially functional despite bootstrap errors');
    console.warn('⚠️  Web server and admin panel should still work');
  }
}

bootstrap().catch((error) => {
  console.error('Fatal error during bootstrap', error);
  process.exit(1);
});
