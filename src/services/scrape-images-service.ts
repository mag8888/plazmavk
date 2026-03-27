/**
 * Сервис для сбора недостающих фотографий продуктов
 * с сайта Siam Botanicals
 */

import { PrismaClient } from '@prisma/client';
import { uploadImage, isCloudinaryConfigured } from './cloudinary-service.js';

const prisma = new PrismaClient();

export interface ProductFromSite {
  title: string;
  slug: string;
  imageUrl: string | null;
  productUrl: string;
}

export interface ScrapeResult {
  updated: number;
  skipped: number;
  failed: number;
  notFound: number;
  total: number;
}

/**
 * Парсит страницу магазина и извлекает информацию о продуктах
 */
export async function scrapeShopPage(page: number = 1): Promise<{
  products: ProductFromSite[];
  hasNextPage: boolean;
}> {
  const url = `https://siambotanicals.com/shop/${page > 1 ? `page/${page}/` : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const products: ProductFromSite[] = [];
    const foundUrls = new Set<string>(); // Для избежания дубликатов

    // Ищем все ссылки на продукты в HTML
    // WooCommerce обычно использует структуру: <li class="product"> или <article class="product">
    // Ищем все ссылки, содержащие /product/ в href
    const allProductLinks = html.match(/<a[^>]*href="[^"]*\/product\/[^"]*"[^>]*>/gi) || [];

    if (allProductLinks.length === 0) {
      // Попробуем альтернативный паттерн
      const altPattern = /href="(https:\/\/siambotanicals\.com\/product\/[^"]+)"/gi;
      const altMatches = [...html.matchAll(altPattern)];
      if (altMatches.length > 0) {
        console.log(`   ℹ️  Найдено товаров альтернативным способом: ${altMatches.length}`);
      }
    }

    for (const linkTag of allProductLinks) {
      const urlMatch = linkTag.match(/href="([^"]+)"/i);
      if (!urlMatch) continue;

      let productUrl = urlMatch[1];
      if (!productUrl.includes('/product/')) continue;

      // Нормализуем URL
      if (!productUrl.startsWith('http')) {
        productUrl = productUrl.startsWith('/')
          ? `https://siambotanicals.com${productUrl}`
          : `https://siambotanicals.com/${productUrl}`;
      }

      // Убираем параметры из URL
      productUrl = productUrl.split('?')[0].split('#')[0];

      // Извлекаем slug
      const slugMatch = productUrl.match(/\/product\/([^\/]+)/);
      if (!slugMatch) continue;

      const slug = slugMatch[1];

      // Пропускаем дубликаты
      if (foundUrls.has(productUrl)) continue;
      foundUrls.add(productUrl);

      // Находим блок продукта вокруг этой ссылки
      const linkIndex = html.indexOf(linkTag);
      const productBlockStart = Math.max(0, linkIndex - 1000);
      const productBlockEnd = Math.min(html.length, linkIndex + 2000);
      const productHtml = html.substring(productBlockStart, productBlockEnd);

      // Извлекаем название
      let title = '';
      const titlePatterns = [
        /<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i,
        /<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i,
        /<a[^>]*class="[^"]*woocommerce-LoopProduct-link[^"]*"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i,
        /<a[^>]*class="[^"]*woocommerce-LoopProduct-link[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i,
        // Альтернативные паттерны для названия
        new RegExp(`<a[^>]*href="${productUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([^<]+)</a>`, 'i')
      ];

      for (const pattern of titlePatterns) {
        const match = productHtml.match(pattern);
        if (match && match[1]) {
          title = match[1].replace(/<[^>]+>/g, '').trim();
          if (title && title.length > 3) break;
        }
      }

      // Если название не найдено, извлекаем из slug
      if (!title || title.length < 3) {
        title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }

      // Извлекаем миниатюру (опционально, основное изображение будет со страницы продукта)
      let imageUrl: string | null = null;
      const imagePatterns = [
        /<img[^>]*src="([^"]+)"[^>]*class="[^"]*(?:attachment-woocommerce_thumbnail|wp-post-image)[^"]*"/i,
        /<img[^>]*class="[^"]*(?:attachment-woocommerce_thumbnail|wp-post-image)[^"]*"[^>]*src="([^"]+)"/i,
        /<img[^>]*data-src="([^"]+)"[^>]*>/i,
        /<img[^>]*src="([^"]*\/wp-content\/uploads\/[^"]+\.(jpg|jpeg|png|webp))"[^>]*>/i,
      ];

      for (const pattern of imagePatterns) {
        const match = productHtml.match(pattern);
        if (match && match[1]) {
          imageUrl = match[1];
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          } else if (imageUrl.startsWith('/')) {
            imageUrl = 'https://siambotanicals.com' + imageUrl;
          }
          imageUrl = imageUrl.replace(/-\d+x\d+\.(jpg|jpeg|png|webp)/i, '.$1');
          imageUrl = imageUrl.split('?')[0];
          break;
        }
      }

      if (title && slug) {
        products.push({
          title: title,
          slug: slug,
          imageUrl: imageUrl,
          productUrl: productUrl
        });
      }
    }

    // Определяем наличие следующей страницы более точно
    const hasNextPage = html.includes('next page-numbers') ||
      html.includes('next page') ||
      html.includes('→') ||
      html.match(/page-numbers.*next/) !== null ||
      (products.length >= 12); // Если на странице 12 или больше товаров, вероятно есть еще

    return { products, hasNextPage };
  } catch (error: any) {
    console.error(`❌ Ошибка парсинга страницы ${page}: ${error.message || error}`);
    return { products: [], hasNextPage: false };
  }
}

/**
 * Извлекает изображение со страницы продукта
 */
export async function extractImageFromProductPage(productUrl: string): Promise<string | null> {
  try {
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Ищем основное изображение продукта (высокого качества)
    const patterns = [
      // WooCommerce галерея - главное изображение
      /<img[^>]*class="[^"]*woocommerce-product-gallery__image[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]*class="[^"]*attachment-woocommerce_single[^"]*"[^>]*src="([^"]+)"/i,
      // Data атрибуты для большого изображения
      /<img[^>]*data-large_image="([^"]+)"/i,
      /<img[^>]*data-src-full="([^"]+)"/i,
      /<img[^>]*data-large_image_url="([^"]+)"/i,
      // Обычные изображения из wp-content/uploads
      /<img[^>]*src="([^"]*\/wp-content\/uploads\/[^"]+\.(jpg|jpeg|png|webp))"[^>]*>/i,
      /<img[^>]*data-src="([^"]*\/wp-content\/uploads\/[^"]+\.(jpg|jpeg|png|webp))"[^>]*>/i,
      // Альтернативные паттерны
      /<img[^>]*srcset="([^"]+)"[^>]*>/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let imageUrl = match[1];

        // Обработка srcset (выбираем самое большое изображение)
        if (pattern.toString().includes('srcset')) {
          const srcsetParts = imageUrl.split(',').map(p => p.trim());
          if (srcsetParts.length > 0) {
            // Берем последний элемент (обычно самый большой)
            imageUrl = srcsetParts[srcsetParts.length - 1].split(' ')[0];
          }
        }

        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          imageUrl = 'https://siambotanicals.com' + imageUrl;
        }

        // Убираем размерные параметры для получения оригинала
        imageUrl = imageUrl.replace(/-\d+x\d+\.(jpg|jpeg|png|webp)/i, '.$1');
        imageUrl = imageUrl.split('?')[0];
        imageUrl = imageUrl.split('#')[0];

        // Проверяем, что это действительно изображение
        if (imageUrl.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)) {
          return imageUrl;
        }
      }
    }

    return null;
  } catch (error: any) {
    return null;
  }
}

/**
 * Загружает изображение на Cloudinary или возвращает прямой URL
 */
export async function downloadAndUploadImage(imageUrl: string, productId: string, productTitle: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(15000),
      method: 'HEAD'
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      return null;
    }
  } catch (error: any) {
    return null;
  }

  if (isCloudinaryConfigured()) {
    try {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        return imageUrl;
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      if (imageBuffer.length === 0) {
        return imageUrl;
      }

      const safeTitle = productTitle.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);

      const result = await uploadImage(imageBuffer, {
        folder: 'vital/products',
        publicId: `siam-${safeTitle}-${Date.now()}`,
        resourceType: 'image'
      });

      return result.secureUrl;
    } catch (error: any) {
      return imageUrl;
    }
  } else {
    return imageUrl;
  }
}

/**
 * Находит продукт в базе данных по названию
 */
export async function findProductInDB(title: string, slug: string): Promise<{ id: string; title: string; imageUrl: string | null } | null> {
  const exactMatch = await prisma.product.findFirst({
    where: {
      title: {
        equals: title
      }
    },
    select: {
      id: true,
      title: true,
      imageUrl: true
    }
  });

  if (exactMatch) {
    return exactMatch;
  }

  const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (words.length > 0) {
    const partialMatch = await prisma.product.findFirst({
      where: {
        OR: words.map(word => ({
          title: {
            contains: word
          }
        }))
      },
      select: {
        id: true,
        title: true,
        imageUrl: true
      }
    });

    if (partialMatch) {
      return partialMatch;
    }
  }

  return null;
}

/**
 * Основная функция сбора всех фотографий (обновляет даже существующие для лучшего качества)
 */
export async function scrapeAllMissingImages(): Promise<ScrapeResult> {
  console.log('🚀 Начало сбора всех фотографий продуктов\n');

  const result: ScrapeResult = {
    updated: 0,
    skipped: 0,
    failed: 0,
    notFound: 0,
    total: 0
  };

  // Собираем все продукты со страниц магазина
  const allProductsFromSite: ProductFromSite[] = [];
  let currentPage = 1;
  let hasMorePages = true;
  const maxPages = 20; // 148 товаров / 12 на странице = ~13 страниц

  console.log('📄 Начинаю сбор всех товаров со страниц магазина...\n');

  while (hasMorePages && currentPage <= maxPages) {
    console.log(`\n📄 Страница ${currentPage}:`);
    const { products, hasNextPage } = await scrapeShopPage(currentPage);

    if (products.length === 0 && currentPage > 1) {
      console.log(`   ✅ Больше товаров нет, завершаю сбор`);
      hasMorePages = false;
      break;
    }

    allProductsFromSite.push(...products);
    console.log(`   ✅ Найдено товаров: ${products.length}, всего: ${allProductsFromSite.length}`);

    hasMorePages = hasNextPage && products.length > 0;
    currentPage++;

    // Задержка между страницами
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  result.total = allProductsFromSite.length;

  // Обрабатываем каждый продукт
  for (const siteProduct of allProductsFromSite) {
    try {
      console.log(`\n📦 Обработка продукта: ${siteProduct.title}`);

      const dbProduct = await findProductInDB(siteProduct.title, siteProduct.slug);

      if (!dbProduct) {
        console.log(`   ⏭️  Не найден в базе данных`);
        result.notFound++;
        continue;
      }

      // Всегда заходим на страницу продукта для получения изображения высокого качества
      console.log(`   🔍 Захожу на страницу продукта: ${siteProduct.productUrl}`);
      let imageUrl = await extractImageFromProductPage(siteProduct.productUrl);

      // Если не получилось со страницы, пробуем из списка
      if (!imageUrl && siteProduct.imageUrl) {
        console.log(`   🔄 Используем изображение из списка`);
        imageUrl = siteProduct.imageUrl;
      }

      if (!imageUrl) {
        console.log(`   ⚠️  Изображение не найдено`);
        result.failed++;
        continue;
      }

      console.log(`   📥 Найдено изображение: ${imageUrl.substring(0, 60)}...`);

      // Загружаем на Cloudinary или используем прямой URL
      const finalImageUrl = await downloadAndUploadImage(imageUrl, dbProduct.id, dbProduct.title);

      if (!finalImageUrl) {
        console.log(`   ⚠️  Не удалось обработать изображение`);
        result.failed++;
        continue;
      }

      // Проверяем, что изображение действительно отличается от текущего
      const needsUpdate = !dbProduct.imageUrl || dbProduct.imageUrl !== finalImageUrl;

      if (needsUpdate) {
        // Обновляем в базе данных (даже если изображение уже было, обновляем на более качественное)
        await prisma.product.update({
          where: { id: dbProduct.id },
          data: { imageUrl: finalImageUrl }
        });

        console.log(`   ✅ Успешно добавлено/обновлено! URL: ${finalImageUrl.substring(0, 60)}...`);
        result.updated++;
      } else {
        console.log(`   ⏭️  Изображение уже актуальное, пропускаю`);
        result.skipped++;
      }

      // Задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`   ❌ Ошибка: ${error.message || error}`);
      result.failed++;
    }
  }

  return result;
}

