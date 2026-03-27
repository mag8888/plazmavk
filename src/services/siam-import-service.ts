/**
 * Siam Botanicals Import Service
 * Сервис для импорта продуктов с сайта Siam Botanicals
 */

import { PrismaClient } from '@prisma/client';
import { aiTranslationService } from './ai-translation-service.js';
import { uploadImage, isCloudinaryConfigured } from './cloudinary-service.js';

const prisma = new PrismaClient();

export interface SiamProduct {
  englishTitle: string;
  englishSummary: string;
  englishDescription: string;
  price: number; // В батах (THB)
  imageUrl: string;
  category: string;
  categorySlug: string;
}

// Данные продуктов с сайта Siam Botanicals
export const siamProducts: Partial<SiamProduct>[] = [
  {
    englishTitle: 'Organic Castor Oil With Vitamin E',
    englishSummary: 'Pure organic castor oil enriched with Vitamin E. Perfect for hair and skin care, promotes natural growth and nourishment.',
    englishDescription: 'Rich in ricinoleic acid, which has moisturizing and anti-inflammatory properties. Ideal for skin and hair care, promotes strengthening and nourishment.',
    price: 540, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Castor-Oil-With-Vitamin-E-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Organic Argan Oil',
    englishSummary: 'Known for its anti-aging properties. Deeply moisturizes the skin, increases its elasticity and gives healthy shine to hair.',
    englishDescription: 'Argan oil is known for its anti-aging properties. It deeply moisturizes the skin, increases its elasticity and gives healthy shine to hair.',
    price: 940, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Argan-Oil-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Rose Water 100% Pure Bulgarian',
    englishSummary: 'Refreshes and tones the skin, has soothing properties and helps relieve irritation. Suitable for all skin types.',
    englishDescription: 'Rose water refreshes and tones the skin, has soothing properties and helps relieve irritation. Suitable for all skin types.',
    price: 885, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Rose-Water-100-Pure-Bulgarian-1.jpg',
    category: 'Face Care',
    categorySlug: 'face-care'
  },
  {
    englishTitle: 'Rudis Oleum Botanical Repair Formula Face Serum',
    englishSummary: 'Contains a blend of natural oils and extracts that promote skin regeneration, reduce signs of aging and improve overall skin tone.',
    englishDescription: 'This serum contains a blend of natural oils and extracts that promote skin regeneration, reduce signs of aging and improve overall skin tone.',
    price: 1395, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Rudis-Oleum-Botanical-Repair-Formula-Face-Serum-1.jpg',
    category: 'Face Care',
    categorySlug: 'face-care'
  },
  {
    englishTitle: 'Lemongrass Salt Scrub Soap',
    englishSummary: 'Soap with natural sea salt and lemongrass essential oil gently exfoliates the skin, removing dead cells, and leaves a feeling of freshness and cleanliness.',
    englishDescription: 'Soap with natural sea salt and lemongrass essential oil gently exfoliates the skin, removing dead cells, and leaves a feeling of freshness and cleanliness.',
    price: 175, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Lemongrass-Salt-Scrub-Soap-1.jpg',
    category: 'Bath & Spa',
    categorySlug: 'bath-spa'
  },
  {
    englishTitle: 'Ginger Lily & Frankincense Moisturizing Facial Lotion',
    englishSummary: 'This lotion deeply moisturizes the skin, gives it softness and elasticity, and also has a pleasant aroma thanks to the combination of ginger lily and frankincense.',
    englishDescription: 'This lotion deeply moisturizes the skin, gives it softness and elasticity, and also has a pleasant aroma thanks to the combination of ginger lily and frankincense.',
    price: 660, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Ginger-Lily-Frankincense-Moisturizing-Facial-Lotion-1.jpg',
    category: 'Face Care',
    categorySlug: 'face-care'
  },
  {
    englishTitle: 'Organic Sweet Almond Oil With Vitamin E',
    englishSummary: 'Sweet almond oil is rich in vitamins and minerals that nourish and moisturize the skin, making it soft and smooth.',
    englishDescription: 'Sweet almond oil is rich in vitamins and minerals that nourish and moisturize the skin, making it soft and smooth.',
    price: 695, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Sweet-Almond-Oil-With-Vitamin-E-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Organic Rosehip & Jojoba Facial Oil',
    englishSummary: 'The combination of rosehip and jojoba oils helps restore the skin, reduce pigmentation and give it a healthy appearance.',
    englishDescription: 'The combination of rosehip and jojoba oils helps restore the skin, reduce pigmentation and give it a healthy appearance.',
    price: 1180, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Rosehip-Jojoba-Facial-Oil-1.jpg',
    category: 'Face Care',
    categorySlug: 'face-care'
  },
  {
    englishTitle: 'Organic Jojoba Oil',
    englishSummary: 'Lightweight oil that closely resembles the skin\'s natural sebum. Excellent for moisturizing without clogging pores, suitable for all skin types.',
    englishDescription: 'Jojoba oil is a lightweight, non-comedogenic oil that closely resembles the skin\'s natural sebum. It provides excellent moisturization without clogging pores, making it suitable for all skin types, including sensitive and acne-prone skin.',
    price: 790, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Jojoba-Oil-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Organic Coconut Oil',
    englishSummary: 'Versatile oil rich in lauric acid, excellent for skin and hair care. Provides deep moisturization and has natural antibacterial properties.',
    englishDescription: 'Organic coconut oil is rich in lauric acid and provides deep moisturization for both skin and hair. It has natural antibacterial properties and is excellent for dry skin and damaged hair.',
    price: 590, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Coconut-Oil-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Organic Avocado Oil',
    englishSummary: 'Rich, nourishing oil high in vitamins A, D, and E. Perfect for dry and mature skin, promotes healing and reduces inflammation.',
    englishDescription: 'Avocado oil is rich in vitamins A, D, and E, making it perfect for dry and mature skin. It promotes healing, reduces inflammation, and provides deep nourishment.',
    price: 690, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Avocado-Oil-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Organic Grapeseed Oil',
    englishSummary: 'Light, non-greasy oil packed with antioxidants. Excellent for oily skin, helps balance sebum production and tighten pores.',
    englishDescription: 'Grapeseed oil is a light, non-greasy oil packed with antioxidants. It\'s excellent for oily skin, helps balance sebum production, and has pore-tightening properties.',
    price: 640, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Grapeseed-Oil-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Organic Rosehip Oil',
    englishSummary: 'Powerful anti-aging oil rich in vitamin A and fatty acids. Helps reduce scars, fine lines, and improves skin texture.',
    englishDescription: 'Rosehip oil is a powerful anti-aging oil rich in vitamin A and essential fatty acids. It helps reduce scars, fine lines, and significantly improves skin texture and tone.',
    price: 890, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Rosehip-Oil-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Organic Sesame Oil',
    englishSummary: 'Nutrient-rich oil with natural SPF properties. Excellent for massage, skin protection, and hair conditioning.',
    englishDescription: 'Sesame oil is nutrient-rich with natural SPF properties. It\'s excellent for massage, provides skin protection from UV rays, and conditions hair beautifully.',
    price: 540, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Sesame-Oil-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Organic Evening Primrose Oil',
    englishSummary: 'Rich in gamma-linolenic acid (GLA), helps balance hormones and reduces inflammation. Beneficial for hormonal skin issues.',
    englishDescription: 'Evening primrose oil is rich in gamma-linolenic acid (GLA), which helps balance hormones and reduces inflammation. It\'s particularly beneficial for hormonal skin issues and eczema.',
    price: 990, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Evening-Primrose-Oil-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Organic Tamanu Oil',
    englishSummary: 'Healing oil known for its regenerative properties. Excellent for scars, burns, and skin irritations.',
    englishDescription: 'Tamanu oil is a healing oil known for its powerful regenerative properties. It\'s excellent for treating scars, burns, skin irritations, and promoting overall skin health.',
    price: 1190, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Tamanu-Oil-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Organic Marula Oil',
    englishSummary: 'Lightweight, fast-absorbing oil high in antioxidants. Perfect for all skin types, provides protection against environmental damage.',
    englishDescription: 'Marula oil is a lightweight, fast-absorbing oil high in antioxidants. Perfect for all skin types, it provides protection against environmental damage and premature aging.',
    price: 1290, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Organic-Marula-Oil-1.jpg',
    category: 'Pure Organic Oils',
    categorySlug: 'pure-organic-oils'
  },
  {
    englishTitle: 'Aloe Vera Gel 99% Pure',
    englishSummary: 'Soothing gel perfect for sunburns, irritated skin, and daily hydration. Calms inflammation and promotes healing.',
    englishDescription: 'Pure aloe vera gel is perfect for sunburns, irritated skin, and daily hydration. It calms inflammation, promotes healing, and provides instant relief for various skin conditions.',
    price: 450, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Aloe-Vera-Gel-99-Pure-1.jpg',
    category: 'Face Care',
    categorySlug: 'face-care'
  },
  {
    englishTitle: 'Natural Clay Mask',
    englishSummary: 'Deep cleansing mask that draws out impurities and excess oil. Helps minimize pores and improve skin clarity.',
    englishDescription: 'Natural clay mask provides deep cleansing by drawing out impurities and excess oil from pores. It helps minimize pores, improve skin clarity, and leave skin feeling refreshed.',
    price: 380, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Natural-Clay-Mask-1.jpg',
    category: 'Face Care',
    categorySlug: 'face-care'
  },
  {
    englishTitle: 'Rose & Chamomile Facial Toner',
    englishSummary: 'Gentle toner that refreshes and balances skin pH. Soothes irritation and prepares skin for better product absorption.',
    englishDescription: 'Rose and chamomile facial toner gently refreshes and balances skin pH. It soothes irritation, reduces redness, and prepares skin for better product absorption.',
    price: 550, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Rose-Chamomile-Facial-Toner-1.jpg',
    category: 'Face Care',
    categorySlug: 'face-care'
  },
  {
    englishTitle: 'Vitamin C Brightening Serum',
    englishSummary: 'Powerful antioxidant serum that brightens skin, reduces dark spots, and promotes collagen production for youthful skin.',
    englishDescription: 'Vitamin C brightening serum is a powerful antioxidant that brightens skin, reduces dark spots and hyperpigmentation, and promotes collagen production for more youthful-looking skin.',
    price: 1250, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Vitamin-C-Brightening-Serum-1.jpg',
    category: 'Face Care',
    categorySlug: 'face-care'
  },
  {
    englishTitle: 'Hyaluronic Acid Moisturizer',
    englishSummary: 'Intense hydration cream that holds up to 1000x its weight in water. Plumps skin and reduces fine lines.',
    englishDescription: 'Hyaluronic acid moisturizer provides intense hydration by holding up to 1000 times its weight in water. It plumps skin, reduces fine lines, and leaves skin feeling smooth and supple.',
    price: 980, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Hyaluronic-Acid-Moisturizer-1.jpg',
    category: 'Face Care',
    categorySlug: 'face-care'
  },
  {
    englishTitle: 'Tea Tree Oil',
    englishSummary: 'Natural antiseptic oil perfect for acne-prone skin. Reduces inflammation and prevents breakouts.',
    englishDescription: 'Tea tree oil is a natural antiseptic perfect for acne-prone skin. It reduces inflammation, prevents breakouts, and helps heal existing blemishes without over-drying skin.',
    price: 420, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Tea-Tree-Oil-1.jpg',
    category: 'Face Care',
    categorySlug: 'face-care'
  },
  {
    englishTitle: 'Lavender & Eucalyptus Body Lotion',
    englishSummary: 'Calming body lotion that moisturizes and soothes. The combination of lavender and eucalyptus provides aromatherapy benefits.',
    englishDescription: 'Lavender and eucalyptus body lotion provides deep moisturization while the calming scents offer aromatherapy benefits. It soothes both skin and mind after a long day.',
    price: 720, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Lavender-Eucalyptus-Body-Lotion-1.jpg',
    category: 'Bath & Spa',
    categorySlug: 'bath-spa'
  },
  {
    englishTitle: 'Dead Sea Salt Scrub',
    englishSummary: 'Exfoliating body scrub with mineral-rich Dead Sea salt. Removes dead cells and leaves skin smooth and glowing.',
    englishDescription: 'Dead Sea salt scrub exfoliates with mineral-rich salt from the Dead Sea. It removes dead cells, improves circulation, and leaves skin smooth, soft, and glowing.',
    price: 650, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Dead-Sea-Salt-Scrub-1.jpg',
    category: 'Bath & Spa',
    categorySlug: 'bath-spa'
  },
  {
    englishTitle: 'Coconut & Lime Body Wash',
    englishSummary: 'Refreshing body wash with natural coconut and lime extracts. Gently cleanses while maintaining skin\'s natural moisture.',
    englishDescription: 'Coconut and lime body wash provides a refreshing cleansing experience with natural extracts. It gently cleanses while maintaining skin\'s natural moisture balance.',
    price: 380, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Coconut-Lime-Body-Wash-1.jpg',
    category: 'Bath & Spa',
    categorySlug: 'bath-spa'
  },
  {
    englishTitle: 'Jasmine & Ylang-Ylang Bath Oil',
    englishSummary: 'Luxurious bath oil that softens skin and provides aromatherapy benefits. Creates a spa-like experience at home.',
    englishDescription: 'Jasmine and ylang-ylang bath oil creates a luxurious spa-like experience. It softens skin and provides calming aromatherapy benefits for relaxation and stress relief.',
    price: 580, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Jasmine-Ylang-Ylang-Bath-Oil-1.jpg',
    category: 'Bath & Spa',
    categorySlug: 'bath-spa'
  },
  {
    englishTitle: 'Peppermint & Eucalyptus Foot Cream',
    englishSummary: 'Cooling foot cream that relieves tired feet. Peppermint and eucalyptus provide a refreshing, invigorating sensation.',
    englishDescription: 'Peppermint and eucalyptus foot cream provides cooling relief for tired, achy feet. The refreshing sensation invigorates while the cream moisturizes and softens rough skin.',
    price: 480, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Peppermint-Eucalyptus-Foot-Cream-1.jpg',
    category: 'Bath & Spa',
    categorySlug: 'bath-spa'
  },
  {
    englishTitle: 'Argan Oil Hair Treatment',
    englishSummary: 'Intensive hair treatment that repairs damage and adds shine. Perfect for dry, damaged, or frizzy hair.',
    englishDescription: 'Argan oil hair treatment intensively repairs damaged hair and adds incredible shine. Perfect for dry, damaged, or frizzy hair, it restores health and manageability.',
    price: 890, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Argan-Oil-Hair-Treatment-1.jpg',
    category: 'Hair Care',
    categorySlug: 'hair-care'
  },
  {
    englishTitle: 'Coconut Oil Hair Mask',
    englishSummary: 'Deep conditioning mask that penetrates hair shaft. Restores moisture and prevents protein loss for stronger hair.',
    englishDescription: 'Coconut oil hair mask provides deep conditioning that penetrates the hair shaft. It restores moisture, prevents protein loss, and strengthens hair from within.',
    price: 550, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Coconut-Oil-Hair-Mask-1.jpg',
    category: 'Hair Care',
    categorySlug: 'hair-care'
  },
  {
    englishTitle: 'Rosemary & Peppermint Shampoo',
    englishSummary: 'Clarifying shampoo that cleanses without stripping. Stimulates scalp and promotes healthy hair growth.',
    englishDescription: 'Rosemary and peppermint shampoo provides deep cleansing without stripping natural oils. It stimulates the scalp and promotes healthy hair growth while refreshing the senses.',
    price: 450, // THB
    imageUrl: 'https://siambotanicals.com/wp-content/uploads/2021/06/Rosemary-Peppermint-Shampoo-1.jpg',
    category: 'Hair Care',
    categorySlug: 'hair-care'
  }
];

/**
 * Конвертирует тайский бат в PZ (1 бат ≈ 2.5 руб, 1 PZ = 100 руб)
 */
function convertTHBToPZ(thbPrice: number): number {
  return Math.round((thbPrice * 2.5) / 100 * 100) / 100;
}

/**
 * Создает или получает категорию
 */
async function getOrCreateCategory(name: string, slug: string) {
  let category = await prisma.category.findUnique({
    where: { slug }
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        name,
        slug,
        description: `Категория ${name} от Siam Botanicals`,
        isActive: true
      }
    });
    console.log(`✅ Создана категория: ${name}`);
  }

  return category;
}

/**
 * Загружает изображение по URL и возвращает Cloudinary URL
 */
async function downloadAndUploadImage(imageUrl: string, productId: string): Promise<string | null> {
  if (!isCloudinaryConfigured()) {
    console.warn('⚠️  Cloudinary не настроен, пропускаю загрузку изображения');
    return null;
  }

  // Пробуем альтернативные варианты URL
  const alternativeUrls: string[] = [imageUrl];

  // Вариант без "-1" в конце
  if (imageUrl.includes('-1.jpg')) {
    alternativeUrls.push(imageUrl.replace('-1.jpg', '.jpg'));
  }

  // Вариант без расширения и снова с расширением
  const baseUrl = imageUrl.replace(/\.(jpg|jpeg|png)$/i, '');
  alternativeUrls.push(`${baseUrl}.jpg`);
  alternativeUrls.push(`${baseUrl}.jpeg`);
  alternativeUrls.push(`${baseUrl}.png`);

  // Убираем дубликаты
  const uniqueUrls = [...new Set(alternativeUrls)];

  for (const url of uniqueUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(10000) // 10 секунд таймаут
      });

      if (!response.ok) {
        // Если это не последний URL, пробуем следующий
        if (url !== uniqueUrls[uniqueUrls.length - 1]) {
          continue;
        }
        // Логируем только как предупреждение, не как ошибку
        const shortUrl = imageUrl.split('/').pop() || imageUrl;
        console.warn(`⚠️  Изображение недоступно (${response.status}): ${shortUrl}`);
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        // Если это не последний URL, пробуем следующий
        if (url !== uniqueUrls[uniqueUrls.length - 1]) {
          continue;
        }
        const shortUrl = imageUrl.split('/').pop() || imageUrl;
        console.warn(`⚠️  URL не является изображением: ${shortUrl}`);
        return null;
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      if (imageBuffer.length === 0) {
        // Если это не последний URL, пробуем следующий
        if (url !== uniqueUrls[uniqueUrls.length - 1]) {
          continue;
        }
        const shortUrl = imageUrl.split('/').pop() || imageUrl;
        console.warn(`⚠️  Изображение пустое: ${shortUrl}`);
        return null;
      }

      // Успешно загрузили изображение
      if (url !== imageUrl) {
        const shortUrl = url.split('/').pop() || url;
        console.log(`   ✅ Найдено альтернативное изображение: ${shortUrl}`);
      }

      const result = await uploadImage(imageBuffer, {
        folder: 'vital/products',
        publicId: `siam-${productId}`,
        resourceType: 'image'
      });

      console.log(`   ✅ Изображение загружено: ${result.secureUrl}`);
      return result.secureUrl;
    } catch (error: any) {
      // Если это не последний URL, пробуем следующий
      if (url !== uniqueUrls[uniqueUrls.length - 1]) {
        continue;
      }

      // Если это последний URL, логируем ошибку
      const shortUrl = imageUrl.split('/').pop() || imageUrl;
      const errorMessage = error.message || String(error);

      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        console.warn(`⚠️  Таймаут загрузки изображения: ${shortUrl}`);
      } else if (errorMessage.includes('Not Found') || errorMessage.includes('404') || errorMessage.includes('Failed to fetch')) {
        console.warn(`⚠️  Изображение не найдено: ${shortUrl}`);
      } else {
        // Берем только краткое сообщение об ошибке, без stack trace
        const cleanMessage = errorMessage.split('\n')[0].substring(0, 100);
        console.warn(`⚠️  Не удалось загрузить изображение ${shortUrl}: ${cleanMessage}`);
      }
      return null;
    }
  }

  // Если дошли до сюда, ни один URL не сработал
  return null;
}

/**
 * Импортирует один продукт
 */
async function importProduct(product: SiamProduct): Promise<any> {
  console.log(`\n📦 Импортирую: ${product.englishTitle}`);

  // Проверяем, не существует ли уже продукт с таким названием
  const existingProduct = await prisma.product.findFirst({
    where: {
      title: {
        contains: product.englishTitle.split(' ')[0] // Проверяем по первому слову
      }
    }
  });

  if (existingProduct) {
    console.log(`⏭️  Продукт "${product.englishTitle}" уже существует`);

    // ВСЕГДА обновляем изображение, если оно есть в источнике
    // Это гарантирует, что даже если изображение было загружено, но не отображается, оно обновится
    if (product.imageUrl) {
      console.log('  📷 Загрузка/обновление изображения для существующего товара...');
      const tempId = `update-${existingProduct.id}`;
      const imageUrl = await downloadAndUploadImage(product.imageUrl, tempId);
      if (imageUrl) {
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: { imageUrl }
        });
        console.log('  ✅ Изображение обновлено:', imageUrl);
      } else {
        console.warn('  ⚠️  Изображение недоступно, продукт будет без фото');
      }
    }
    return existingProduct;
  }

  // Получаем или создаем категорию
  const category = await getOrCreateCategory(product.category, product.categorySlug);

  // Переводим через AI или используем английские версии
  const aiEnabled = aiTranslationService.isEnabled();
  let translatedTitle: string;
  let translatedSummary: string;
  let translatedDescription: string;

  if (aiEnabled) {
    console.log('  🔄 Перевод названия...');
    translatedTitle = await aiTranslationService.translateTitle(product.englishTitle);

    console.log('  🔄 Перевод краткого описания...');
    translatedSummary = await aiTranslationService.translateSummary(
      product.englishSummary,
      translatedTitle
    );

    console.log('  🔄 Перевод полного описания...');
    translatedDescription = await aiTranslationService.translateProductDescription(
      product.englishDescription,
      'cosmetic',
      {
        preserveStyle: true,
        targetAudience: 'natural',
        enhanceDescription: true
      }
    );
  } else {
    console.log('  ⚠️  AI Translation не доступен, используем английские названия');
    translatedTitle = product.englishTitle;
    translatedSummary = product.englishSummary;
    translatedDescription = product.englishDescription;
  }

  // Конвертируем цену
  const priceInPZ = convertTHBToPZ(product.price);

  // Загружаем изображение
  let imageUrl: string | null = null;
  if (product.imageUrl) {
    console.log('  📷 Загрузка изображения...');
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    imageUrl = await downloadAndUploadImage(product.imageUrl, tempId);
  }

  // Создаем продукт
  const createdProduct = await prisma.product.create({
    data: {
      title: translatedTitle,
      summary: translatedSummary.substring(0, 200),
      description: translatedDescription,
      price: priceInPZ,
      categoryId: category.id,
      imageUrl: imageUrl || undefined,
      stock: 999,
      isActive: true,
      availableInRussia: true,
      availableInBali: true
    }
  });

  console.log(`✅ Продукт создан: ${translatedTitle} (${priceInPZ} PZ)`);
  return createdProduct;
}

/**
 * Основная функция импорта
 */
export async function importSiamProducts(): Promise<{ success: number; errors: number; total: number }> {
  console.log('🚀 Начало импорта продуктов из Siam Botanicals\n');

  const aiEnabled = aiTranslationService.isEnabled();
  if (!aiEnabled) {
    console.warn('⚠️  AI Translation Service не настроен (нет OPENAI_API_KEY).');
    console.warn('⚠️  Импорт продолжится, но продукты будут с английскими названиями.');
  } else {
    console.log('✅ AI Translation Service включен');
  }

  if (siamProducts.length === 0) {
    throw new Error('Список продуктов пуст.');
  }

  console.log(`📋 Найдено продуктов: ${siamProducts.length}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const product of siamProducts) {
    if (!product.englishTitle || !product.englishSummary || !product.englishDescription || !product.price) {
      console.warn(`⚠️  Пропущен продукт из-за неполных данных: ${product.englishTitle || 'Unknown'}`);
      errorCount++;
      continue;
    }

    try {
      await importProduct(product as SiamProduct);
      successCount++;

      // Пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      errorCount++;
      console.error(`❌ Не удалось импортировать продукт:`, error);
    }
  }

  console.log(`\n✅ Импорт завершен!`);
  console.log(`   Успешно: ${successCount}`);
  console.log(`   Ошибок: ${errorCount}`);

  return {
    success: successCount,
    errors: errorCount,
    total: siamProducts.length
  };
}

/**
 * Извлекает URL изображения товара со страницы Siam Botanicals
 */
async function extractImageFromProductPage(slug: string): Promise<string | null> {
  try {
    const productUrl = `https://siambotanicals.com/product/${slug}/`;

    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`   ⚠️  Страница товара не найдена (404): ${slug}`);
      } else {
        console.log(`   ⚠️  Ошибка при загрузке страницы (${response.status}): ${slug}`);
      }
      return null;
    }

    const html = await response.text();

    // Проверяем, не является ли страница 404 страницей
    if (html.includes('Page not found') || html.includes('404') || html.includes('Not Found')) {
      console.log(`   ⚠️  Страница товара не найдена (404 в HTML): ${slug}`);
      return null;
    }

    // Ищем изображение товара в HTML - расширенный набор паттернов
    const patterns = [
      // WooCommerce галерея - приоритетные паттерны
      /<img[^>]*class="[^"]*woocommerce-product-gallery__image[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]*class="[^"]*woocommerce-product-gallery__image[^"]*"[^>]*data-src="([^"]+)"/i,
      /<img[^>]*data-large_image="([^"]+)"/i,
      /<img[^>]*data-full_image="([^"]+)"/i,
      // WooCommerce single product image
      /<div[^>]*class="[^"]*woocommerce-product-gallery[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i,
      // WordPress изображения
      /<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]*class="[^"]*attachment-woocommerce_single[^"]*"[^>]*src="([^"]+)"/i,
      // Общие паттерны для изображений из wp-content (более специфичные)
      /<img[^>]*src="([^"]*\/wp-content\/uploads\/[^"]+\.(jpg|jpeg|png|webp))"[^>]*>/i,
      // Изображения в figure или div
      /<figure[^>]*>[\s\S]*?<img[^>]*src="([^"]*\/wp-content\/uploads\/[^"]+\.(jpg|jpeg|png|webp))"[^>]*>/i,
      // Изображения в background-image
      /background-image:\s*url\(['"]?([^'")]+\/(wp-content\/uploads\/[^'")]+\.(jpg|jpeg|png|webp))[^'")]*)['"]?\)/i,
      // Общий паттерн для любых изображений из uploads
      /https?:\/\/[^"'\s]+\/wp-content\/uploads\/[^"'\s]+\.(jpg|jpeg|png|webp)/i,
    ];

    console.log(`   🔍 Ищу изображение в HTML (длина HTML: ${html.length} символов)...`);

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = html.match(pattern);
      if (match && match[1]) {
        let imageUrl = match[1];

        // Преобразуем относительный URL в абсолютный
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          imageUrl = 'https://siambotanicals.com' + imageUrl;
        }

        // Убираем параметры размера для получения оригинала (например, -300x300.jpg -> .jpg)
        imageUrl = imageUrl.replace(/-\d+x\d+\.(jpg|jpeg|png|webp)/i, '.$1');

        // Убираем параметры запроса
        imageUrl = imageUrl.split('?')[0];

        // Убираем лишние символы в конце (скобки, кавычки)
        imageUrl = imageUrl.replace(/[)'"]+$/, '');

        console.log(`   ✅ Найдено изображение (паттерн ${i + 1}/${patterns.length}): ${imageUrl.split('/').pop()}`);
        return imageUrl;
      }
    }

    // Если не нашли, попробуем найти любую ссылку на изображение в HTML
    const fallbackMatch = html.match(/https?:\/\/[^"'\s]+\/wp-content\/uploads\/[^"'\s]+\.(jpg|jpeg|png|webp)/i);
    if (fallbackMatch && fallbackMatch[0]) {
      let imageUrl = fallbackMatch[0];
      imageUrl = imageUrl.replace(/-\d+x\d+\.(jpg|jpeg|png|webp)/i, '.$1');
      imageUrl = imageUrl.split('?')[0];
      console.log(`   ✅ Найдено изображение (fallback): ${imageUrl.split('/').pop()}`);
      return imageUrl;
    }

    console.log(`   ⚠️  Изображение не найдено. Проверьте HTML вручную: ${productUrl}`);
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Обновляет изображения для всех существующих товаров (старая версия с прямыми URL)
 */
export async function updateProductImages(): Promise<{ updated: number; failed: number; total: number }> {
  console.log('🖼️  Начало обновления изображений товаров\n');

  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary не настроен. Установите переменные окружения CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  }

  // Получаем все активные товары
  const allProducts = await prisma.product.findMany({
    where: { isActive: true }
  });

  console.log(`📋 Найдено товаров: ${allProducts.length}\n`);

  let updatedCount = 0;
  let failedCount = 0;

  // Создаем мапу для быстрого поиска исходных данных по названию
  // Ключевые слова для более точного сопоставления
  const keywordMap = new Map<string, string>([
    ['кастор', 'castor'],
    ['арган', 'argan'],
    ['розов', 'rose'],
    ['рудис', 'rudis'],
    ['лемонграсс', 'lemongrass'],
    ['имбир', 'ginger'],
    ['миндаль', 'almond'],
    ['шиповник', 'rosehip'],
    ['жожоба', 'jojoba'],
    ['авокадо', 'avocado'],
    ['виноград', 'grapeseed'],
    ['кунжут', 'sesame'],
    ['примула', 'primrose'],
    ['таману', 'tamanu'],
    ['марула', 'marula'],
    ['алоэ', 'aloe'],
    ['глина', 'clay'],
    ['ромашк', 'chamomile'],
    ['витамин', 'vitamin'],
    ['гиалуронов', 'hyaluronic'],
    ['чайное', 'tea tree'],
    ['лаванд', 'lavender'],
    ['эвкалипт', 'eucalyptus'],
    ['мёртвое', 'dead sea'],
    ['кокос', 'coconut'],
    ['лайм', 'lime'],
    ['жасмин', 'jasmine'],
    ['мят', 'peppermint'],
    ['розмарин', 'rosemary'],
  ]);

  // Создаем индексы для быстрого поиска
  const productMapByKeyword = new Map<string, SiamProduct[]>();
  for (const siamProduct of siamProducts) {
    if (!siamProduct.englishTitle || !siamProduct.imageUrl) {
      continue;
    }
    const titleLower = siamProduct.englishTitle.toLowerCase();

    // Добавляем по ключевым словам из английского названия
    for (const [ruKeyword, enKeyword] of keywordMap.entries()) {
      if (titleLower.includes(enKeyword)) {
        if (!productMapByKeyword.has(ruKeyword)) {
          productMapByKeyword.set(ruKeyword, []);
        }
        productMapByKeyword.get(ruKeyword)!.push(siamProduct as SiamProduct);
      }
    }
  }

  for (const product of allProducts) {
    try {
      let siamProduct: SiamProduct | null = null;
      const productTitleLower = product.title.toLowerCase();

      // Ищем по ключевым словам в русском названии
      for (const [ruKeyword, enKeyword] of keywordMap.entries()) {
        if (productTitleLower.includes(ruKeyword)) {
          const candidates = productMapByKeyword.get(ruKeyword);
          if (candidates && candidates.length > 0) {
            // Берем первый подходящий (обычно один)
            siamProduct = candidates[0];
            console.log(`✅ Найден товар по ключевому слову "${ruKeyword}": ${product.title} → ${siamProduct.englishTitle}`);
            break;
          }
        }
      }

      // Если не нашли по ключевым словам, пробуем поиск по части названия
      if (!siamProduct) {
        for (const siamProd of siamProducts) {
          if (!siamProd.englishTitle || !siamProd.imageUrl) continue;

          // Проверяем совпадение ключевых слов
          const siamTitleLower = siamProd.englishTitle.toLowerCase();
          for (const [ruKeyword, enKeyword] of keywordMap.entries()) {
            if (productTitleLower.includes(ruKeyword) && siamTitleLower.includes(enKeyword)) {
              siamProduct = siamProd as SiamProduct;
              console.log(`✅ Найден товар по частичному совпадению: ${product.title} → ${siamProduct.englishTitle}`);
              break;
            }
          }
          if (siamProduct) break;
        }
      }

      if (!siamProduct || !siamProduct.imageUrl || !siamProduct.englishTitle) {
        console.log(`⚠️  Не найдено изображение для товара: "${product.title}" (текущий imageUrl: ${product.imageUrl || 'отсутствует'})`);
        failedCount++;
        continue;
      }

      console.log(`🔍 Обрабатываю: "${product.title}" → "${siamProduct.englishTitle}"`);
      console.log(`   Текущее изображение: ${product.imageUrl || 'отсутствует'}`);
      console.log(`   Источник изображения: ${siamProduct.imageUrl}`);

      // Проверяем, нужно ли обновлять изображение
      // Обновляем, если изображения нет, если это старый URL с siambotanicals.com, или если не Cloudinary
      const needsUpdate = !product.imageUrl ||
        product.imageUrl.includes('siambotanicals.com') ||
        !product.imageUrl.includes('cloudinary') ||
        product.imageUrl.includes('placeholder');

      if (needsUpdate) {
        console.log(`\n📦 Обновляю изображение для: ${product.title}`);
        const tempId = `update-${product.id}-${Date.now()}`;
        const newImageUrl = await downloadAndUploadImage(siamProduct.imageUrl, tempId);

        if (newImageUrl) {
          await prisma.product.update({
            where: { id: product.id },
            data: { imageUrl: newImageUrl }
          });
          console.log(`✅ Изображение обновлено: ${newImageUrl}`);
          updatedCount++;
        } else {
          console.warn(`⚠️  Не удалось загрузить изображение для: ${product.title}`);
          failedCount++;
        }
      } else {
        console.log(`⏭️  Изображение актуально для: ${product.title}`);
      }

      // Небольшая пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Ошибка обновления изображения для товара "${product.title}": ${errorMsg}`);
      failedCount++;
    }
  }

  console.log(`\n📊 Итоговая статистика:`);
  console.log(`   ✅ Обновлено изображений: ${updatedCount}`);
  console.log(`   ❌ Не удалось обновить: ${failedCount}`);
  console.log(`   📦 Всего товаров обработано: ${allProducts.length}`);

  if (updatedCount === 0 && failedCount > 0) {
    console.log(`\n💡 Совет: Проверьте логи выше. Возможные причины:`);
    console.log(`   - Товары в базе не совпадают с товарами Siam Botanicals`);
    console.log(`   - Изображения на сайте Siam Botanicals недоступны`);
    console.log(`   - Проблемы с подключением к Cloudinary`);
  }

  console.log(`\n✅ Обновление изображений завершено!`);
  console.log(`   Обновлено: ${updatedCount}`);
  console.log(`   Ошибок: ${failedCount}`);
  console.log(`   Всего: ${allProducts.length}`);

  return {
    updated: updatedCount,
    failed: failedCount,
    total: allProducts.length
  };
}

// Маппинг английских названий к slug'ам на сайте Siam Botanicals
const productSlugs: Record<string, string> = {
  'Organic Castor Oil With Vitamin E': 'organic-castor-oil-with-vitamin-e',
  'Organic Argan Oil': 'organic-argan-oil',
  'Rose Water 100% Pure Bulgarian': 'rose-water-100-pure-bulgarian',
  'Rudis Oleum Botanical Repair Formula Face Serum': 'rudis-oleum-botanical-repair-formula-face-serum',
  'Lemongrass Salt Scrub Soap': 'lemongrass-salt-scrub-soap',
  'Ginger Lily & Frankincense Moisturizing Facial Lotion': 'ginger-lily-frankincense-moisturizing-facial-lotion',
  'Organic Sweet Almond Oil With Vitamin E': 'organic-sweet-almond-oil-with-vitamin-e',
  'Organic Rosehip & Jojoba Facial Oil': 'organic-rosehip-jojoba-facial-oil',
  'Organic Jojoba Oil': 'organic-jojoba-oil',
  'Organic Coconut Oil': 'organic-coconut-oil',
  'Organic Avocado Oil': 'organic-avocado-oil',
  'Organic Grapeseed Oil': 'organic-grapeseed-oil',
  'Organic Rosehip Oil': 'organic-rosehip-oil',
  'Organic Sesame Oil': 'organic-sesame-oil',
  'Organic Evening Primrose Oil': 'organic-evening-primrose-oil',
  'Organic Tamanu Oil': 'organic-tamanu-oil',
  'Organic Marula Oil': 'organic-marula-oil',
  'Aloe Vera Gel 99% Pure': 'aloe-vera-gel-99-pure',
  'Natural Clay Mask': 'natural-clay-mask',
  'Rose & Chamomile Facial Toner': 'rose-chamomile-facial-toner',
  'Vitamin C Brightening Serum': 'vitamin-c-brightening-serum',
  'Hyaluronic Acid Moisturizer': 'hyaluronic-acid-moisturizer',
  'Tea Tree Oil': 'tea-tree-oil',
  'Lavender & Eucalyptus Body Lotion': 'lavender-eucalyptus-body-lotion',
  'Dead Sea Salt Scrub': 'dead-sea-salt-scrub',
  'Coconut & Lime Body Wash': 'coconut-lime-body-wash',
  'Jasmine & Ylang-Ylang Bath Oil': 'jasmine-ylang-ylang-bath-oil',
  'Peppermint & Eucalyptus Foot Cream': 'peppermint-eucalyptus-foot-cream',
  'Argan Oil Hair Treatment': 'argan-oil-hair-treatment',
  'Coconut Oil Hair Mask': 'coconut-oil-hair-mask',
  'Rosemary & Peppermint Shampoo': 'rosemary-peppermint-shampoo',
};

/**
 * Находит товар в базе данных по английскому названию
 * Использует ключевые слова для сопоставления русских и английских названий
 * (использует ту же логику, что и updateProductImages)
 */
function findProductByEnglishTitle(products: any[], englishTitle: string): any | null {
  const englishTitleLower = englishTitle.toLowerCase();

  // Ключевые слова для сопоставления (та же карта, что в updateProductImages)
  const keywordMap = new Map<string, string>([
    ['кастор', 'castor'],
    ['арган', 'argan'],
    ['розов', 'rose'],
    ['рудис', 'rudis'],
    ['лемонграсс', 'lemongrass'],
    ['имбир', 'ginger'],
    ['миндаль', 'almond'],
    ['шиповник', 'rosehip'],
    ['жожоба', 'jojoba'],
    ['авокадо', 'avocado'],
    ['виноград', 'grapeseed'],
    ['кунжут', 'sesame'],
    ['примула', 'primrose'],
    ['таману', 'tamanu'],
    ['марула', 'marula'],
    ['алоэ', 'aloe'],
    ['глина', 'clay'],
    ['ромашк', 'chamomile'],
    ['витамин', 'vitamin'],
    ['гиалуронов', 'hyaluronic'],
    ['чайное', 'tea tree'],
    ['лаванд', 'lavender'],
    ['эвкалипт', 'eucalyptus'],
    ['мёртвое', 'dead sea'],
    ['кокос', 'coconut'],
    ['лайм', 'lime'],
    ['жасмин', 'jasmine'],
    ['мят', 'peppermint'],
    ['розмарин', 'rosemary'],
  ]);

  // Ищем товар по ключевым словам (как в updateProductImages)
  for (const product of products) {
    const productTitleLower = product.title.toLowerCase();

    // Проверяем совпадение по ключевым словам из английского названия
    for (const [ruKeyword, enKeyword] of keywordMap.entries()) {
      if (englishTitleLower.includes(enKeyword) && productTitleLower.includes(ruKeyword)) {
        return product;
      }
    }

    // Дополнительная проверка: первое слово английского названия
    const firstEnglishWord = englishTitleLower.split(' ')[0];
    if (firstEnglishWord.length > 3) {
      // Проверяем, есть ли это слово в русском названии или в ключевых словах
      if (productTitleLower.includes(firstEnglishWord)) {
        return product;
      }

      // Проверяем обратное: русское ключевое слово соответствует английскому
      for (const [ruKeyword, enKeyword] of keywordMap.entries()) {
        if (productTitleLower.includes(ruKeyword) && englishTitleLower.includes(enKeyword)) {
          return product;
        }
      }
    }
  }

  return null;
}

/**
 * Загружает изображения для всех товаров, парся страницы Siam Botanicals
 * Использует парсинг HTML страниц товаров для получения актуальных URL изображений
 */
export async function uploadAllProductImagesFromPages(): Promise<{ updated: number; failed: number; skipped: number; total: number }> {
  console.log('🚀 Начало загрузки изображений для всех товаров (парсинг страниц)\n');

  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary не настроен. Установите переменные окружения CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  }

  // Получаем все товары из базы данных
  const allProducts = await prisma.product.findMany({
    where: { isActive: true }
  });

  console.log(`📦 Найдено товаров в базе: ${allProducts.length}`);
  console.log(`📋 Будет обработано товаров из списка: ${siamProducts.length}\n`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const siamProduct of siamProducts) {
    if (!siamProduct.englishTitle) {
      skipped++;
      continue;
    }

    try {
      const slug = productSlugs[siamProduct.englishTitle];
      if (!slug) {
        console.log(`⏭️  Пропущен: ${siamProduct.englishTitle} (slug не найден)`);
        skipped++;
        continue;
      }

      // Находим товар в базе данных
      const dbProduct = findProductByEnglishTitle(allProducts, siamProduct.englishTitle);

      if (!dbProduct) {
        // Логируем детали для отладки
        console.log(`⏭️  Пропущен: ${siamProduct.englishTitle} (не найден в базе)`);
        console.log(`   💡 Доступные товары в базе:`);
        allProducts.slice(0, 5).forEach(p => console.log(`      - ${p.title}`));
        skipped++;
        continue;
      }

      console.log(`   ✅ Сопоставлен с товаром в базе: "${dbProduct.title}"`);

      console.log(`\n📦 Товар: ${dbProduct.title}`);
      console.log(`   Английское название: ${siamProduct.englishTitle}`);

      // Проверяем, нужно ли обновлять изображение
      // Пропускаем, если уже есть изображение на Cloudinary
      if (dbProduct.imageUrl && dbProduct.imageUrl.includes('cloudinary') && !dbProduct.imageUrl.includes('siambotanicals.com')) {
        console.log(`   ⏭️  Пропускаю: товар уже имеет изображение на Cloudinary`);
        skipped++;
        continue;
      }

      // Извлекаем URL изображения со страницы товара
      const productUrl = `https://siambotanicals.com/product/${slug}/`;
      console.log(`   📄 Загружаю страницу: ${productUrl}`);

      const imageUrl = await extractImageFromProductPage(slug);

      if (!imageUrl) {
        console.log(`   ⚠️  Не удалось получить URL изображения со страницы`);
        console.log(`   💡 Возможные причины:`);
        console.log(`      - Страница товара не существует (404)`);
        console.log(`      - Структура HTML страницы изменилась`);
        console.log(`      - Товар был удален или переименован`);
        console.log(`   💡 Попробуйте проверить страницу вручную: ${productUrl}`);
        failed++;
        continue;
      }

      console.log(`   ✅ Найдено изображение: ${imageUrl.split('/').pop()}`);

      // Скачиваем изображение
      console.log(`   📥 Скачиваю изображение...`);
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        console.log(`   ⚠️  Изображение недоступно: ${response.status}`);
        failed++;
        continue;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        console.log(`   ⚠️  URL не является изображением: ${contentType}`);
        failed++;
        continue;
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      if (imageBuffer.length === 0) {
        console.log(`   ⚠️  Изображение пустое`);
        failed++;
        continue;
      }

      console.log(`   ✅ Изображение скачано (${(imageBuffer.length / 1024).toFixed(2)} KB)`);

      // Загружаем на Cloudinary
      console.log(`   ☁️  Загружаю на Cloudinary...`);
      const uploadResult = await uploadImage(imageBuffer, {
        folder: 'vital/products',
        publicId: `siam-${dbProduct.id}`,
        resourceType: 'image'
      });

      console.log(`   ✅ Изображение загружено на Cloudinary`);

      // Обновляем товар в базе данных
      await prisma.product.update({
        where: { id: dbProduct.id },
        data: { imageUrl: uploadResult.secureUrl }
      });

      console.log(`   ✅ Товар обновлен в базе данных!`);
      updated++;

      // Задержка между запросами, чтобы не перегружать сервер
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`   ❌ Ошибка: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log(`\n\n✅ Обработка завершена!`);
  console.log(`   ✅ Обновлено: ${updated}`);
  console.log(`   ❌ Не удалось: ${failed}`);
  console.log(`   ⏭️  Пропущено: ${skipped}`);
  console.log(`   📦 Всего обработано: ${siamProducts.length}`);

  return {
    updated,
    failed,
    skipped,
    total: siamProducts.length
  };
}



