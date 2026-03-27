#!/usr/bin/env node

/**
 * Восстановление базы данных из бэкапа в Cloudinary
 * Использование: node scripts/restore-from-cloudinary.js [backup-url]
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import https from 'https';
import http from 'http';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dt4r1tigf',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Скачивает файл по URL
 */
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        return downloadFile(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filepath);
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(filepath);
      reject(err);
    });
  });
}

/**
 * Получает список бэкапов из Cloudinary
 * Используем admin.resources, т.к. search API может падать с 400 на некоторых версиях SDK
 */
async function listBackups() {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'raw',
      prefix: 'plazma-bot/backups',
      max_results: 100,
      direction: -1,
      context: true,
    });

    // Сортируем по created_at по убыванию
    const resources = (result.resources || []).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return resources;
  } catch (error) {
    console.error('❌ Ошибка получения списка бэкапов:', error);
    return [];
  }
}

/**
 * Восстанавливает данные из JSON файла
 */
async function restoreFromFile(filepath) {
  try {
    console.log('📖 Чтение файла бэкапа...');
    const fileContent = fs.readFileSync(filepath, 'utf8');
    const backupData = JSON.parse(fileContent);
    
    if (!backupData.data) {
      throw new Error('Неверный формат бэкапа: отсутствует поле data');
    }
    
    console.log('📅 Дата бэкапа:', backupData.exportDate);
    console.log('📊 Статистика бэкапа:', backupData.statistics);
    
    const data = backupData.data;
    
    // Подключение к базе данных
    console.log('🔄 Подключение к базе данных...');
    await prisma.$connect();
    console.log('✅ Подключено успешно!');
    
    // Восстановление в правильном порядке (с учетом зависимостей)
    
    // 1. Категории (без зависимостей)
    if (data.categories && data.categories.length > 0) {
      console.log(`\n📥 Восстановление категорий (${data.categories.length})...`);
      for (const category of data.categories) {
        try {
          await prisma.category.upsert({
            where: { id: category.id },
            update: {
              name: category.name,
              slug: category.slug,
              description: category.description,
              isActive: category.isActive,
            },
            create: {
              id: category.id,
              name: category.name,
              slug: category.slug,
              description: category.description,
              isActive: category.isActive,
              createdAt: category.createdAt ? new Date(category.createdAt) : new Date(),
              updatedAt: category.updatedAt ? new Date(category.updatedAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления категории ${category.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено категорий: ${data.categories.length}`);
    }
    
    // 2. Товары (зависят от категорий)
    if (data.products && data.products.length > 0) {
      console.log(`\n📥 Восстановление товаров (${data.products.length})...`);
      for (const product of data.products) {
        try {
          await prisma.product.upsert({
            where: { id: product.id },
            update: {
              title: product.title,
              summary: product.summary,
              description: product.description,
              instruction: product.instruction,
              imageUrl: product.imageUrl,
              price: product.price,
              stock: product.stock,
              isActive: product.isActive,
              availableInRussia: product.availableInRussia,
              availableInBali: product.availableInBali,
              categoryId: product.categoryId,
            },
            create: {
              id: product.id,
              title: product.title,
              summary: product.summary,
              description: product.description,
              instruction: product.instruction,
              imageUrl: product.imageUrl,
              price: product.price,
              stock: product.stock,
              isActive: product.isActive,
              availableInRussia: product.availableInRussia,
              availableInBali: product.availableInBali,
              categoryId: product.categoryId,
              createdAt: product.createdAt ? new Date(product.createdAt) : new Date(),
              updatedAt: product.updatedAt ? new Date(product.updatedAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления товара ${product.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено товаров: ${data.products.length}`);
    }
    
    // 3. Пользователи
    if (data.users && data.users.length > 0) {
      console.log(`\n📥 Восстановление пользователей (${data.users.length})...`);
      for (const user of data.users) {
        try {
          await prisma.user.upsert({
            where: { id: user.id },
            update: {
              telegramId: user.telegramId,
              firstName: user.firstName,
              lastName: user.lastName,
              username: user.username,
              languageCode: user.languageCode,
              phone: user.phone,
              selectedRegion: user.selectedRegion,
              deliveryAddress: user.deliveryAddress,
              balance: user.balance || 0,
            },
            create: {
              id: user.id,
              telegramId: user.telegramId,
              firstName: user.firstName,
              lastName: user.lastName,
              username: user.username,
              languageCode: user.languageCode,
              phone: user.phone,
              selectedRegion: user.selectedRegion,
              deliveryAddress: user.deliveryAddress,
              balance: user.balance || 0,
              createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
              updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления пользователя ${user.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено пользователей: ${data.users.length}`);
    }
    
    // 4. Элементы корзины
    if (data.cartItems && data.cartItems.length > 0) {
      console.log(`\n📥 Восстановление корзины (${data.cartItems.length})...`);
      for (const item of data.cartItems) {
        try {
          await prisma.cartItem.upsert({
            where: {
              userId_productId: {
                userId: item.userId,
                productId: item.productId,
              },
            },
            update: {
              quantity: item.quantity,
            },
            create: {
              id: item.id,
              userId: item.userId,
              productId: item.productId,
              quantity: item.quantity,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления элемента корзины ${item.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено элементов корзины: ${data.cartItems.length}`);
    }
    
    // 5. Заказы
    if (data.orders && data.orders.length > 0) {
      console.log(`\n📥 Восстановление заказов (${data.orders.length})...`);
      for (const order of data.orders) {
        try {
          await prisma.orderRequest.upsert({
            where: { id: order.id },
            update: {
              userId: order.userId,
              contact: order.contact,
              message: order.message,
              itemsJson: order.itemsJson,
              status: order.status,
            },
            create: {
              id: order.id,
              userId: order.userId,
              contact: order.contact,
              message: order.message,
              itemsJson: order.itemsJson,
              status: order.status,
              createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления заказа ${order.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено заказов: ${data.orders.length}`);
    }
    
    // 6. Партнерские профили
    if (data.partnerProfiles && data.partnerProfiles.length > 0) {
      console.log(`\n📥 Восстановление партнерских профилей (${data.partnerProfiles.length})...`);
      for (const profile of data.partnerProfiles) {
        try {
          await prisma.partnerProfile.upsert({
            where: { id: profile.id },
            update: {
              userId: profile.userId,
              isActive: profile.isActive,
              activatedAt: profile.activatedAt ? new Date(profile.activatedAt) : null,
              expiresAt: profile.expiresAt ? new Date(profile.expiresAt) : null,
              activationType: profile.activationType,
              programType: profile.programType,
              referralCode: profile.referralCode,
              balance: profile.balance || 0,
              bonus: profile.bonus || 0,
              totalPartners: profile.totalPartners || 0,
              directPartners: profile.directPartners || 0,
              multiPartners: profile.multiPartners || 0,
            },
            create: {
              id: profile.id,
              userId: profile.userId,
              isActive: profile.isActive,
              activatedAt: profile.activatedAt ? new Date(profile.activatedAt) : null,
              expiresAt: profile.expiresAt ? new Date(profile.expiresAt) : null,
              activationType: profile.activationType,
              programType: profile.programType,
              referralCode: profile.referralCode,
              balance: profile.balance || 0,
              bonus: profile.bonus || 0,
              totalPartners: profile.totalPartners || 0,
              directPartners: profile.directPartners || 0,
              multiPartners: profile.multiPartners || 0,
              createdAt: profile.createdAt ? new Date(profile.createdAt) : new Date(),
              updatedAt: profile.updatedAt ? new Date(profile.updatedAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления партнерского профиля ${profile.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено партнерских профилей: ${data.partnerProfiles.length}`);
    }
    
    // 7. Рефералы партнеров
    if (data.partnerProfiles) {
      let totalReferrals = 0;
      for (const profile of data.partnerProfiles) {
        if (profile.referrals && profile.referrals.length > 0) {
          for (const referral of profile.referrals) {
            try {
              await prisma.partnerReferral.upsert({
                where: { id: referral.id },
                update: {
                  profileId: referral.profileId,
                  referredId: referral.referredId,
                  contact: referral.contact,
                  level: referral.level,
                  referralType: referral.referralType,
                },
                create: {
                  id: referral.id,
                  profileId: referral.profileId,
                  referredId: referral.referredId,
                  contact: referral.contact,
                  level: referral.level,
                  referralType: referral.referralType,
                  createdAt: referral.createdAt ? new Date(referral.createdAt) : new Date(),
                },
              });
              totalReferrals++;
            } catch (error) {
              console.warn(`   ⚠️ Ошибка восстановления реферала ${referral.id}:`, error.message);
            }
          }
        }
      }
      if (totalReferrals > 0) {
        console.log(`   ✓ Восстановлено рефералов: ${totalReferrals}`);
      }
    }
    
    // 8. Транзакции партнеров
    if (data.partnerProfiles) {
      let totalTransactions = 0;
      for (const profile of data.partnerProfiles) {
        if (profile.transactions && profile.transactions.length > 0) {
          for (const transaction of profile.transactions) {
            try {
              await prisma.partnerTransaction.upsert({
                where: { id: transaction.id },
                update: {
                  profileId: transaction.profileId,
                  amount: transaction.amount,
                  type: transaction.type,
                  description: transaction.description,
                },
                create: {
                  id: transaction.id,
                  profileId: transaction.profileId,
                  amount: transaction.amount,
                  type: transaction.type,
                  description: transaction.description,
                  createdAt: transaction.createdAt ? new Date(transaction.createdAt) : new Date(),
                },
              });
              totalTransactions++;
            } catch (error) {
              console.warn(`   ⚠️ Ошибка восстановления транзакции ${transaction.id}:`, error.message);
            }
          }
        }
      }
      if (totalTransactions > 0) {
        console.log(`   ✓ Восстановлено транзакций: ${totalTransactions}`);
      }
    }
    
    // 9. История активации партнеров
    if (data.partnerActivationHistory && data.partnerActivationHistory.length > 0) {
      console.log(`\n📥 Восстановление истории активации (${data.partnerActivationHistory.length})...`);
      for (const history of data.partnerActivationHistory) {
        try {
          await prisma.partnerActivationHistory.upsert({
            where: { id: history.id },
            update: {
              profileId: history.profileId,
              action: history.action,
              activationType: history.activationType,
              reason: history.reason,
              expiresAt: history.expiresAt ? new Date(history.expiresAt) : null,
              adminId: history.adminId,
            },
            create: {
              id: history.id,
              profileId: history.profileId,
              action: history.action,
              activationType: history.activationType,
              reason: history.reason,
              expiresAt: history.expiresAt ? new Date(history.expiresAt) : null,
              adminId: history.adminId,
              createdAt: history.createdAt ? new Date(history.createdAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления истории ${history.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено записей истории: ${data.partnerActivationHistory.length}`);
    }
    
    // 10. Отзывы
    if (data.reviews && data.reviews.length > 0) {
      console.log(`\n📥 Восстановление отзывов (${data.reviews.length})...`);
      for (const review of data.reviews) {
        try {
          await prisma.review.upsert({
            where: { id: review.id },
            update: {
              name: review.name,
              photoUrl: review.photoUrl,
              content: review.content,
              link: review.link,
              isPinned: review.isPinned,
              isActive: review.isActive,
            },
            create: {
              id: review.id,
              name: review.name,
              photoUrl: review.photoUrl,
              content: review.content,
              link: review.link,
              isPinned: review.isPinned,
              isActive: review.isActive,
              createdAt: review.createdAt ? new Date(review.createdAt) : new Date(),
              updatedAt: review.updatedAt ? new Date(review.updatedAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления отзыва ${review.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено отзывов: ${data.reviews.length}`);
    }
    
    // 11. Аудио файлы
    if (data.audioFiles && data.audioFiles.length > 0) {
      console.log(`\n📥 Восстановление аудио файлов (${data.audioFiles.length})...`);
      for (const audio of data.audioFiles) {
        try {
          await prisma.audioFile.upsert({
            where: { id: audio.id },
            update: {
              title: audio.title,
              description: audio.description,
              fileId: audio.fileId,
              duration: audio.duration,
              fileSize: audio.fileSize,
              mimeType: audio.mimeType,
              isActive: audio.isActive,
              category: audio.category,
            },
            create: {
              id: audio.id,
              title: audio.title,
              description: audio.description,
              fileId: audio.fileId,
              duration: audio.duration,
              fileSize: audio.fileSize,
              mimeType: audio.mimeType,
              isActive: audio.isActive,
              category: audio.category,
              createdAt: audio.createdAt ? new Date(audio.createdAt) : new Date(),
              updatedAt: audio.updatedAt ? new Date(audio.updatedAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления аудио файла ${audio.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено аудио файлов: ${data.audioFiles.length}`);
    }
    
    // 12. Контент бота
    if (data.botContent && data.botContent.length > 0) {
      console.log(`\n📥 Восстановление контента бота (${data.botContent.length})...`);
      for (const content of data.botContent) {
        try {
          await prisma.botContent.upsert({
            where: { id: content.id },
            update: {
              key: content.key,
              title: content.title,
              content: content.content,
              description: content.description,
              category: content.category,
              isActive: content.isActive,
              language: content.language,
            },
            create: {
              id: content.id,
              key: content.key,
              title: content.title,
              content: content.content,
              description: content.description,
              category: content.category,
              isActive: content.isActive,
              language: content.language,
              createdAt: content.createdAt ? new Date(content.createdAt) : new Date(),
              updatedAt: content.updatedAt ? new Date(content.updatedAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления контента ${content.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено элементов контента: ${data.botContent.length}`);
    }
    
    // 13. Платежи
    if (data.payments && data.payments.length > 0) {
      console.log(`\n📥 Восстановление платежей (${data.payments.length})...`);
      for (const payment of data.payments) {
        try {
          await prisma.payment.upsert({
            where: { id: payment.id },
            update: {
              userId: payment.userId,
              orderId: payment.orderId,
              invoiceId: payment.invoiceId,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              paymentUrl: payment.paymentUrl,
            },
            create: {
              id: payment.id,
              userId: payment.userId,
              orderId: payment.orderId,
              invoiceId: payment.invoiceId,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              paymentUrl: payment.paymentUrl,
              createdAt: payment.createdAt ? new Date(payment.createdAt) : new Date(),
              updatedAt: payment.updatedAt ? new Date(payment.updatedAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления платежа ${payment.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено платежей: ${data.payments.length}`);
    }
    
    // 14. Медиа файлы
    if (data.mediaFiles && data.mediaFiles.length > 0) {
      console.log(`\n📥 Восстановление медиа файлов (${data.mediaFiles.length})...`);
      for (const media of data.mediaFiles) {
        try {
          await prisma.mediaFile.upsert({
            where: { id: media.id },
            update: {
              title: media.title,
              description: media.description,
              url: media.url,
              type: media.type,
              fileSize: media.fileSize,
              mimeType: media.mimeType,
              isActive: media.isActive,
              category: media.category,
            },
            create: {
              id: media.id,
              title: media.title,
              description: media.description,
              url: media.url,
              type: media.type,
              fileSize: media.fileSize,
              mimeType: media.mimeType,
              isActive: media.isActive,
              category: media.category,
              createdAt: media.createdAt ? new Date(media.createdAt) : new Date(),
              updatedAt: media.updatedAt ? new Date(media.updatedAt) : new Date(),
            },
          });
        } catch (error) {
          console.warn(`   ⚠️ Ошибка восстановления медиа файла ${media.id}:`, error.message);
        }
      }
      console.log(`   ✓ Восстановлено медиа файлов: ${data.mediaFiles.length}`);
    }
    
    // 15. История пользователей
    if (data.users) {
      let totalHistories = 0;
      for (const user of data.users) {
        if (user.histories && user.histories.length > 0) {
          for (const history of user.histories) {
            try {
              await prisma.userHistory.upsert({
                where: { id: history.id },
                update: {
                  userId: history.userId,
                  action: history.action,
                  payload: history.payload,
                },
                create: {
                  id: history.id,
                  userId: history.userId,
                  action: history.action,
                  payload: history.payload,
                  createdAt: history.createdAt ? new Date(history.createdAt) : new Date(),
                },
              });
              totalHistories++;
            } catch (error) {
              console.warn(`   ⚠️ Ошибка восстановления истории пользователя ${history.id}:`, error.message);
            }
          }
        }
      }
      if (totalHistories > 0) {
        console.log(`   ✓ Восстановлено записей истории пользователей: ${totalHistories}`);
      }
    }
    
    console.log('\n✅ Восстановление завершено успешно!');
    
    return {
      success: true,
      statistics: backupData.statistics,
    };
    
  } catch (error) {
    console.error('❌ Ошибка при восстановлении:', error);
    throw error;
  }
}

/**
 * Основная функция восстановления
 */
async function restoreDatabase(backupUrlOrPath = null) {
  let filepath = null;
  const isLocalFile = backupUrlOrPath && !backupUrlOrPath.startsWith('http://') && !backupUrlOrPath.startsWith('https://');

  try {
    if (isLocalFile) {
      // Восстановление из локального файла
      filepath = path.isAbsolute(backupUrlOrPath) ? backupUrlOrPath : path.join(process.cwd(), backupUrlOrPath);
      if (!fs.existsSync(filepath)) {
        throw new Error(`Файл не найден: ${filepath}`);
      }
      console.log(`📂 Восстановление из локального бэкапа: ${filepath}`);
      return await restoreFromFile(filepath);
    }

    // Если URL не указан, ищем последний бэкап в Cloudinary
    if (!backupUrlOrPath) {
      console.log('🔍 Поиск последнего бэкапа в Cloudinary...');
      const backups = await listBackups();
      
      if (backups.length === 0) {
        throw new Error('Бэкапы не найдены в Cloudinary. Убедитесь, что переменные CLOUDINARY_* установлены правильно.');
      }
      
      const latestBackup = backups[0];
      backupUrlOrPath = latestBackup.secure_url;
      console.log(`✅ Найден бэкап: ${latestBackup.filename}`);
      console.log(`📅 Дата создания: ${new Date(latestBackup.created_at).toLocaleString()}`);
      console.log(`📊 Размер: ${(latestBackup.bytes / 1024 / 1024).toFixed(2)} MB`);
    }
    
    const tmpDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp' : path.join(__dirname, '..');
    const filename = `restore-${Date.now()}.json`;
    filepath = path.join(tmpDir, filename);
    
    console.log(`\n📥 Скачивание бэкапа...`);
    console.log(`   URL: ${backupUrlOrPath}`);
    await downloadFile(backupUrlOrPath, filepath);
    console.log(`✅ Бэкап скачан: ${filepath}`);
    
    const result = await restoreFromFile(filepath);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log('🗑️ Временный файл удален');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Ошибка при восстановлении:', error);
    if (filepath && fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Соединение с базой данных закрыто');
  }
}

// Запуск восстановления
if (import.meta.url === `file://${process.argv[1]}`) {
  const backupUrl = process.argv[2] || null;
  
  restoreDatabase(backupUrl)
    .then((result) => {
      console.log('\n✨ Восстановление успешно завершено!');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Критическая ошибка:', error);
      process.exit(1);
    });
}

export { restoreDatabase };

