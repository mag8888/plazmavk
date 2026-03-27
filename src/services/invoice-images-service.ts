/**
 * Сервис для импорта изображений с сайта Siam Botanicals
 * для товаров из инвойса
 */

import { PrismaClient } from '@prisma/client';
import { parseInvoiceFromDelimitedText, InvoiceItem } from './invoice-import-service.js';
import { uploadImage, uploadImageFromPath, isCloudinaryConfigured } from './cloudinary-service.js';
import { scrapeShopPage, extractImageFromProductPage } from './scrape-images-service.js';

const prisma = new PrismaClient();

interface ProductMatch {
  product: {
    id: string;
    title: string;
    sku: string | null;
    imageUrl: string | null;
  };
  invoiceItem: InvoiceItem;
  siteImageUrl: string | null;
  matched: boolean;
}

/**
 * Нормализует название для поиска
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Извлекает ключевые слова из названия для поиска
 */
function extractKeywords(title: string): string[] {
  const normalized = normalizeTitle(title);
  const words = normalized.split(/\s+/).filter(w => w.length > 3);

  // Убираем общие слова
  const stopWords = ['with', 'organic', 'natural', 'cosmos', 'g', 'ml', 'the', 'and', 'for', 'from'];
  return words.filter(w => !stopWords.includes(w));
}

/**
 * Поиск товара на сайте Siam Botanicals по названию
 * Использует существующий сервис скрапинга для более эффективного поиска
 */
// Кеш для товаров с сайта (чтобы не парсить повторно)
let siteProductsCache: Array<{ title: string; imageUrl: string | null; productUrl: string }> | null = null;

/**
 * Получает все товары с сайта (с кешированием)
 */
async function getAllSiteProducts(): Promise<Array<{ title: string; imageUrl: string | null; productUrl: string }>> {
  if (siteProductsCache) {
    return siteProductsCache;
  }

  console.log('📥 Загрузка всех товаров с сайта Siam Botanicals...');
  const allProducts: Array<{ title: string; imageUrl: string | null; productUrl: string }> = [];

  for (let page = 1; page <= 10; page++) {
    try {
      const { products, hasNextPage } = await scrapeShopPage(page);
      allProducts.push(...products);

      if (!hasNextPage || products.length === 0) {
        break;
      }

      // Небольшая пауза между страницами
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Ошибка на странице ${page}:`, error);
      break;
    }
  }

  console.log(`✅ Загружено ${allProducts.length} товаров с сайта\n`);
  siteProductsCache = allProducts;
  return allProducts;
}

/**
 * Поиск товара на сайте по названию
 */
async function searchProductOnSite(invoiceItem: InvoiceItem): Promise<string | null> {
  try {
    const allSiteProducts = await getAllSiteProducts();
    const normalizedInvoiceTitle = normalizeTitle(invoiceItem.description);
    const keywords = extractKeywords(invoiceItem.description);

    // Ищем товар по названию
    for (const siteProduct of allSiteProducts) {
      const normalizedSiteTitle = normalizeTitle(siteProduct.title);

      // Точное совпадение
      if (normalizedSiteTitle === normalizedInvoiceTitle) {
        console.log(`   ✅ Найден точный match: "${siteProduct.title}"`);
        const imageUrl = await extractImageFromProductPage(siteProduct.productUrl);
        return imageUrl || siteProduct.imageUrl;
      }

      // Частичное совпадение (ключевые слова)
      const siteKeywords = extractKeywords(siteProduct.title);
      const matchingKeywords = keywords.filter(k => siteKeywords.includes(k));

      if (matchingKeywords.length >= 2 && matchingKeywords.length >= keywords.length * 0.6) {
        console.log(`   ✅ Найден частичный match: "${siteProduct.title}" (совпадений: ${matchingKeywords.length})`);
        const imageUrl = await extractImageFromProductPage(siteProduct.productUrl);
        return imageUrl || siteProduct.imageUrl;
      }

      // Проверяем, содержит ли название сайта ключевые слова из инвойса
      if (keywords.length > 0 && keywords.some(k => normalizedSiteTitle.includes(k))) {
        console.log(`   ✅ Найден по ключевым словам: "${siteProduct.title}"`);
        const imageUrl = await extractImageFromProductPage(siteProduct.productUrl);
        return imageUrl || siteProduct.imageUrl;
      }
    }
  } catch (error) {
    console.error(`Ошибка поиска товара "${invoiceItem.description}":`, error);
  }

  return null;
}

/**
 * Сопоставляет товары из инвойса с товарами в базе данных
 */
async function matchInvoiceItemsWithProducts(invoiceItems: InvoiceItem[]): Promise<ProductMatch[]> {
  const matches: ProductMatch[] = [];

  // Получаем все товары из базы данных
  const dbProducts = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      sku: true,
      imageUrl: true
    }
  });

  for (const invoiceItem of invoiceItems) {
    // Сначала ищем по SKU
    let dbProduct = dbProducts.find(p => p.sku === invoiceItem.sku);

    // Если не нашли по SKU, ищем по названию
    if (!dbProduct) {
      const normalizedInvoiceTitle = normalizeTitle(invoiceItem.description);
      dbProduct = dbProducts.find(p => {
        const normalizedDbTitle = normalizeTitle(p.title);
        return normalizedDbTitle === normalizedInvoiceTitle ||
          normalizedDbTitle.includes(normalizedInvoiceTitle) ||
          normalizedInvoiceTitle.includes(normalizedDbTitle);
      });
    }

    if (dbProduct) {
      // Ищем изображение на сайте
      const siteImageUrl = await searchProductOnSite(invoiceItem);

      matches.push({
        product: dbProduct,
        invoiceItem,
        siteImageUrl,
        matched: !!siteImageUrl
      });
    } else {
      matches.push({
        product: null as any,
        invoiceItem,
        siteImageUrl: null,
        matched: false
      });
    }
  }

  return matches;
}

/**
 * Загружает изображение на Cloudinary или возвращает прямой URL
 */
async function downloadAndUploadImage(imageUrl: string, productId: string, productTitle: string): Promise<string | null> {
  try {
    if (isCloudinaryConfigured()) {
      // Загружаем на Cloudinary
      // Uses uploadImageFromPath which supports URLs via cloudinary.uploader.upload
      const result = await uploadImageFromPath(imageUrl, {
        folder: 'vital/products',
        publicId: `product-${productId}`
      });

      return result.secureUrl || result.url || imageUrl;
    } else {
      // Возвращаем прямой URL
      return imageUrl;
    }
  } catch (error) {
    console.error(`Ошибка загрузки изображения для ${productTitle}:`, error);
    return imageUrl; // Возвращаем исходный URL в случае ошибки
  }
}

/**
 * Основная функция импорта изображений для товаров из инвойса
 */
export async function importImagesForInvoiceItems(invoiceText: string): Promise<{
  matched: number;
  updated: number;
  failed: number;
  notFound: number;
  total: number;
  errors: string[];
}> {
  console.log('🚀 Запуск импорта изображений для товаров из инвойса...\n');

  // Парсим инвойс
  const invoiceItems = parseInvoiceFromDelimitedText(invoiceText);
  console.log(`📦 Найдено ${invoiceItems.length} уникальных товаров в инвойсе\n`);

  // Сопоставляем с товарами в базе данных
  console.log('🔍 Сопоставление товаров с базой данных...');
  const matches = await matchInvoiceItemsWithProducts(invoiceItems);

  let matched = 0;
  let updated = 0;
  let failed = 0;
  let notFound = 0;
  const errors: string[] = [];

  // Обрабатываем каждый товар
  for (const match of matches) {
    if (!match.product) {
      console.log(`⏭️  Товар не найден в БД: ${match.invoiceItem.sku} - ${match.invoiceItem.description}`);
      notFound++;
      continue;
    }

    if (!match.siteImageUrl) {
      console.log(`⚠️  Изображение не найдено на сайте: ${match.invoiceItem.sku} - ${match.invoiceItem.description}`);
      failed++;
      errors.push(`${match.invoiceItem.sku}: изображение не найдено на сайте`);
      continue;
    }

    matched++;

    try {
      console.log(`\n📦 Обработка: ${match.product.title}`);
      console.log(`   SKU: ${match.invoiceItem.sku}`);
      console.log(`   Найдено изображение: ${match.siteImageUrl.substring(0, 60)}...`);

      // Загружаем и обновляем изображение
      const finalImageUrl = await downloadAndUploadImage(
        match.siteImageUrl,
        match.product.id,
        match.product.title
      );

      if (!finalImageUrl) {
        console.log(`   ⚠️  Не удалось обработать изображение`);
        failed++;
        errors.push(`${match.invoiceItem.sku}: ошибка обработки изображения`);
        continue;
      }

      // Обновляем в базе данных
      await prisma.product.update({
        where: { id: match.product.id },
        data: { imageUrl: finalImageUrl }
      });

      console.log(`   ✅ Изображение обновлено!`);
      updated++;

      // Небольшая пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.error(`   ❌ Ошибка: ${error.message}`);
      failed++;
      errors.push(`${match.invoiceItem.sku}: ${error.message}`);
    }
  }

  return {
    matched,
    updated,
    failed,
    notFound,
    total: invoiceItems.length,
    errors
  };
}

