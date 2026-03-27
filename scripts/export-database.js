import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function exportDatabase() {
  try {
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
            transactions: true
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
        transactions: true
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
    const filepath = path.join(__dirname, '..', filename);

    console.log('💾 Сохранение в файл...');
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2), 'utf8');
    
    const fileSize = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
    console.log(`✅ Экспорт завершен!`);
    console.log(`📄 Файл: ${filename}`);
    console.log(`📊 Размер: ${fileSize} MB`);
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

  } catch (error) {
    console.error('❌ Ошибка при экспорте:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Соединение с базой данных закрыто');
  }
}

// Запуск экспорта
exportDatabase()
  .then(() => {
    console.log('✨ Экспорт успешно завершен!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });

