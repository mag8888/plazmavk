import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Используем тот же PrismaClient из lib/prisma.ts, который поддерживает DATABASE_URL || MONGO_URL
// Импортируем через относительный путь
const prismaModule = await import('../dist/lib/prisma.js');
const prisma = prismaModule.prisma;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dt4r1tigf',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadToCloudinary(filePath) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'raw',
      folder: 'plazma-bot/backups',
      use_filename: true,
      unique_filename: false,
    });
    return result.secure_url;
  } catch (error) {
    console.error('❌ Ошибка загрузки в Cloudinary:', error);
    return null;
  }
}

async function exportDatabase() {
  let filepath = null;
  try {
    // Проверяем доступность БД перед подключением
    const dbUrl = process.env.DATABASE_URL || process.env.MONGO_URL;
    if (!dbUrl) {
      console.warn('⚠️  DATABASE_URL or MONGO_URL not found. Skipping backup.');
      return {
        success: false,
        error: 'Database URL not configured',
        filename: null,
        filepath: null,
        fileSize: '0 MB',
        statistics: {}
      };
    }
    
    console.log('🔄 Подключение к базе данных...');
    await prisma.$connect();
    console.log('✅ Подключено успешно!');

    console.log('📦 Начало экспорта данных...');
    
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: {}
    };

    // Экспорт всех моделей
    console.log('📥 Экспорт пользователей...');
    exportData.data.users = await prisma.user.findMany({
      include: {
        cartItems: true,
        histories: true,
        orders: true,
        referrals: true,
        payments: true,
        partner: {
          include: {
            referrals: true,
            transactions: true,
            activationHistory: true
          }
        }
      }
    });
    console.log(`   ✓ Экспортировано пользователей: ${exportData.data.users.length}`);

    console.log('📥 Экспорт категорий...');
    exportData.data.categories = await prisma.category.findMany({
      include: {
        products: true
      }
    });
    console.log(`   ✓ Экспортировано категорий: ${exportData.data.categories.length}`);

    console.log('📥 Экспорт товаров...');
    exportData.data.products = await prisma.product.findMany({
      include: {
        category: true,
        cartItems: true
      }
    });
    console.log(`   ✓ Экспортировано товаров: ${exportData.data.products.length}`);

    console.log('📥 Экспорт корзины...');
    exportData.data.cartItems = await prisma.cartItem.findMany({
      include: {
        user: true,
        product: true
      }
    });
    console.log(`   ✓ Экспортировано элементов корзины: ${exportData.data.cartItems.length}`);

    console.log('📥 Экспорт заказов...');
    exportData.data.orders = await prisma.orderRequest.findMany({
      include: {
        user: true
      }
    });
    console.log(`   ✓ Экспортировано заказов: ${exportData.data.orders.length}`);

    console.log('📥 Экспорт партнерских профилей...');
    exportData.data.partnerProfiles = await prisma.partnerProfile.findMany({
      include: {
        user: true,
        referrals: {
          include: {
            referred: true
          }
        },
        transactions: true,
        activationHistory: true
      }
    });
    console.log(`   ✓ Экспортировано партнерских профилей: ${exportData.data.partnerProfiles.length}`);

    console.log('📥 Экспорт отзывов...');
    exportData.data.reviews = await prisma.review.findMany();
    console.log(`   ✓ Экспортировано отзывов: ${exportData.data.reviews.length}`);

    console.log('📥 Экспорт аудио файлов...');
    exportData.data.audioFiles = await prisma.audioFile.findMany();
    console.log(`   ✓ Экспортировано аудио файлов: ${exportData.data.audioFiles.length}`);

    console.log('📥 Экспорт контента бота...');
    exportData.data.botContent = await prisma.botContent.findMany();
    console.log(`   ✓ Экспортировано элементов контента: ${exportData.data.botContent.length}`);

    console.log('📥 Экспорт платежей...');
    exportData.data.payments = await prisma.payment.findMany({
      include: {
        user: true
      }
    });
    console.log(`   ✓ Экспортировано платежей: ${exportData.data.payments.length}`);

    console.log('📥 Экспорт медиафайлов...');
    exportData.data.mediaFiles = await prisma.mediaFile.findMany();
    console.log(`   ✓ Экспортировано медиафайлов: ${exportData.data.mediaFiles.length}`);

    console.log('📥 Экспорт истории активации партнеров...');
    exportData.data.partnerActivationHistory = await prisma.partnerActivationHistory.findMany({
      include: {
        profile: true
      }
    });
    console.log(`   ✓ Экспортировано записей истории: ${exportData.data.partnerActivationHistory.length}`);

    // Статистика
    exportData.statistics = {
      totalUsers: exportData.data.users.length,
      totalProducts: exportData.data.products.length,
      totalCategories: exportData.data.categories.length,
      totalOrders: exportData.data.orders.length,
      totalReviews: exportData.data.reviews.length,
      totalPayments: exportData.data.payments.length,
      totalPartnerProfiles: exportData.data.partnerProfiles.length,
      totalMediaFiles: exportData.data.mediaFiles?.length || 0,
      totalPartnerActivationHistory: exportData.data.partnerActivationHistory?.length || 0
    };

    // Сохранение в файл
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `database-backup-${timestamp}.json`;
    
    // На Railway используем /tmp для временных файлов
    const tmpDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp' : path.join(__dirname, '..');
    filepath = path.join(tmpDir, filename);

    console.log('💾 Сохранение в файл...');
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2), 'utf8');
    
    const fileSize = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
    console.log(`✅ Экспорт завершен!`);
    console.log(`📄 Файл: ${filename}`);
    console.log(`📊 Размер: ${fileSize} MB`);

    // Загрузка в Cloudinary
    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      console.log('☁️ Загрузка в Cloudinary...');
      const cloudinaryUrl = await uploadToCloudinary(filepath);
      if (cloudinaryUrl) {
        console.log(`✅ Загружено в Cloudinary: ${cloudinaryUrl}`);
        exportData.cloudinaryUrl = cloudinaryUrl;
        
        // Обновляем файл с URL
        fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2), 'utf8');
      }
    }

    // Удаляем локальный файл на Railway (оставляем только в Cloudinary)
    if (process.env.RAILWAY_ENVIRONMENT && filepath.startsWith('/tmp')) {
      fs.unlinkSync(filepath);
      console.log('🗑️ Локальный файл удален (сохранен в Cloudinary)');
    }

    console.log(`📈 Статистика:`);
    console.log(`   - Пользователей: ${exportData.statistics.totalUsers}`);
    console.log(`   - Товаров: ${exportData.statistics.totalProducts}`);
    console.log(`   - Категорий: ${exportData.statistics.totalCategories}`);
    console.log(`   - Заказов: ${exportData.statistics.totalOrders}`);
    console.log(`   - Отзывов: ${exportData.statistics.totalReviews}`);
    console.log(`   - Платежей: ${exportData.statistics.totalPayments}`);
    console.log(`   - Партнерских профилей: ${exportData.statistics.totalPartnerProfiles}`);
    console.log(`   - Медиафайлов: ${exportData.statistics.totalMediaFiles}`);
    console.log(`   - История активации партнеров: ${exportData.statistics.totalPartnerActivationHistory}`);

    return {
      success: true,
      filename,
      filepath: exportData.cloudinaryUrl || filepath,
      fileSize: `${fileSize} MB`,
      statistics: exportData.statistics
    };

  } catch (error: any) {
    // Проверяем, является ли это ошибкой подключения/аутентификации
    const errorMessage = error.message || error.meta?.message || '';
    const errorCode = error.code;
    const errorKind = (error as any).kind || '';
    
    if (errorCode === 'P1012' || errorMessage.includes('Environment variable not found')) {
      console.warn('⚠️  DATABASE_URL or MONGO_URL not found. Skipping backup.');
      return {
        success: false,
        error: 'Database URL not configured',
        filename: null,
        filepath: null,
        fileSize: '0 MB',
        statistics: {}
      };
    }
    
    if (errorMessage.includes('Authentication failed') || 
        errorMessage.includes('SCRAM failure') ||
        errorKind.includes('AuthenticationFailed') ||
        errorCode === 'P1013') {
      console.warn('⚠️  Database authentication failed. Skipping backup.');
      console.warn('💡 Please fix MongoDB connection string. See FIX_MONGODB_AUTH.md');
      return {
        success: false,
        error: 'Database authentication failed',
        filename: null,
        filepath: null,
        fileSize: '0 MB',
        statistics: {}
      };
    }
    
    // Для других ошибок логируем и пробрасываем
    console.error('❌ Ошибка при экспорте:', error.message?.substring(0, 200));
    throw error;
  } finally {
    try {
      await prisma.$disconnect();
      console.log('🔌 Соединение с базой данных закрыто');
    } catch (disconnectError) {
      // Игнорируем ошибки при отключении
    }
  }
}

// Запуск экспорта
if (import.meta.url === `file://${process.argv[1]}`) {
  exportDatabase()
    .then((result) => {
      console.log('✨ Экспорт успешно завершен!');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Критическая ошибка:', error);
      process.exit(1);
    });
}

export { exportDatabase };

