/**
 * External API Router
 * API для дружественных сервисов
 * 
 * Аутентификация: X-API-Key header
 * 
 * Эндпоинты:
 * - GET /api/external/catalog - Полный каталог (категории + товары)
 * - GET /api/external/categories - Список категорий
 * - GET /api/external/products - Список товаров (с фильтрацией)
 * - GET /api/external/products/:id - Конкретный товар
 * - POST /api/external/orders - Создать заказ
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { createOrderRequest } from '../services/order-service.js';
import { getActiveCategories, getProductsByCategory, getProductById } from '../services/shop-service.js';
import { ApiResponse, ProductApiResponse, CategoryApiResponse } from '../types/api.js';

const router = Router();

// Middleware для проверки API ключа
function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  const validApiKey = process.env.EXTERNAL_API_KEY;

  if (!validApiKey) {
    console.warn('⚠️ EXTERNAL_API_KEY не установлен в переменных окружения');
    return res.status(500).json({
      success: false,
      error: 'API не настроен на сервере'
    });
  }

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      error: 'Неверный или отсутствующий API ключ'
    });
  }

  next();
}

// Применяем аутентификацию ко всем маршрутам
router.use(authenticateApiKey);

/**
 * GET /api/external/catalog
 * Получить полный каталог (категории с товарами)
 */
router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const region = (req.query.region as string)?.toUpperCase() || 'RUSSIA';
    const isBali = region === 'BALI';

    // Получаем активные категории
    const categories = await getActiveCategories();

    // Для каждой категории получаем товары
    const catalog = await Promise.all(
      categories.map(async (category: any) => {
        const categoryId = category.id;
        const products = await prisma.product.findMany({
          where: {
            categoryId: categoryId,
            isActive: true,
            ...(isBali ? { availableInBali: true } : { availableInRussia: true })
          },
          orderBy: { title: 'asc' },
          select: {
            id: true,
            title: true,
            summary: true,
            description: true,
            imageUrl: true,
            price: true,
            stock: true,
            availableInRussia: true,
            availableInBali: true,
            createdAt: true,
            updatedAt: true
          }
        });

        return {
          id: categoryId,
          name: category.name,
          slug: category.slug,
          description: category.description,
          isActive: category.isActive,
          products: products.map((p) => ({
            id: p.id,
            title: p.title,
            summary: p.summary,
            description: p.description,
            imageUrl: p.imageUrl,
            price: Number(p.price),
            priceRub: Number(p.price) * 100, // Конвертация PZ в RUB
            stock: p.stock,
            availableInRussia: p.availableInRussia,
            availableInBali: p.availableInBali,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt
          })),
          createdAt: category.createdAt,
          updatedAt: category.updatedAt
        };
      })
    );

    const response: ApiResponse<typeof catalog> = {
      success: true,
      data: catalog
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching catalog:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении каталога'
    });
  }
});

/**
 * GET /api/external/categories
 * Получить список категорий
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await getActiveCategories();

    const response: ApiResponse<CategoryApiResponse[]> = {
      success: true,
      data: categories.map((cat: any) => ({
        id: cat._id?.toString() || cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        isActive: cat.isActive,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении категорий'
    });
  }
});

/**
 * GET /api/external/products
 * Получить список товаров с фильтрацией
 * 
 * Query параметры:
 * - categoryId - фильтр по категории
 * - region - RUSSIA или BALI (по умолчанию RUSSIA)
 * - search - поиск по названию/описанию
 * - limit - лимит результатов (по умолчанию 100)
 * - offset - смещение для пагинации (по умолчанию 0)
 */
router.get('/products', async (req: Request, res: Response) => {
  try {
    const categoryId = req.query.categoryId as string | undefined;
    const region = (req.query.region as string)?.toUpperCase() || 'RUSSIA';
    const search = req.query.search as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const isBali = region === 'BALI';

    const whereClause: any = {
      isActive: true,
      ...(isBali ? { availableInBali: true } : { availableInRussia: true })
    };

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        orderBy: { title: 'asc' },
        skip: offset,
        take: limit,
        include: {
          category: {
            select: {
              name: true,
              slug: true
            }
          }
        }
      }),
      prisma.product.count({ where: whereClause })
    ]);

    const response: ApiResponse<Array<ProductApiResponse & { priceRub: number; category?: { id: string; name: string; slug: string } }>> = {
      success: true,
      data: products.map((p) => {
        return {
          id: p.id,
          title: p.title,
          description: p.description || null,
          price: Number(p.price),
          priceRub: Number(p.price) * 100, // Конвертация PZ в RUB
          isActive: true,
          categoryId: p.categoryId || '',
          imageUrl: p.imageUrl,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          category: p.category ? {
            id: p.categoryId || '',
            name: p.category.name,
            slug: p.category.slug,
            description: null,
            isActive: true,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt
          } : undefined,
          // Дополнительные поля
          summary: p.summary,
          stock: p.stock,
          availableInRussia: p.availableInRussia,
          availableInBali: p.availableInBali
        } as any;
      })
    };

    // Добавляем информацию о пагинации в заголовки
    res.setHeader('X-Total-Count', total.toString());
    res.setHeader('X-Limit', limit.toString());
    res.setHeader('X-Offset', offset.toString());

    res.json(response);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении товаров'
    });
  }
});

/**
 * GET /api/external/products/:id
 * Получить конкретный товар по ID
 */
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const productId = req.params.id;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Товар не найден'
      });
    }

    if (!product.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Товар неактивен'
      });
    }

    const { category } = product;
    
    const response: ApiResponse<ProductApiResponse & { priceRub: number; summary: string; stock: number; availableInRussia: boolean; availableInBali: boolean }> = {
      success: true,
      data: {
        id: product.id,
        title: product.title,
        description: product.description || null,
        price: Number(product.price),
        priceRub: Number(product.price) * 100, // Конвертация PZ в RUB
        isActive: product.isActive,
        categoryId: product.categoryId || '',
        imageUrl: product.imageUrl,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        category: category ? {
          id: product.categoryId || '',
          name: category.name,
          slug: category.slug,
          description: category.description,
          isActive: category.isActive,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt
        } : undefined,
        // Дополнительные поля
        summary: product.summary,
        stock: product.stock,
        availableInRussia: product.availableInRussia,
        availableInBali: product.availableInBali
      } as any
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении товара'
    });
  }
});

/**
 * POST /api/external/orders
 * Создать заказ
 * 
 * Body:
 * {
 *   "contact": "телефон или другой контакт",
 *   "items": [
 *     {
 *       "productId": "string",
 *       "quantity": number,
 *       "price": number (опционально, если не указан - берется из БД)
 *     }
 *   ],
 *   "message": "дополнительная информация" (опционально)
 * }
 */
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const { contact, items, message } = req.body;

    // Валидация
    if (!contact) {
      return res.status(400).json({
        success: false,
        error: 'Поле contact обязательно'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Поле items должно быть непустым массивом'
      });
    }

    // Валидация и получение данных о товарах
    const orderItems = await Promise.all(
      items.map(async (item: any) => {
        if (!item.productId || !item.quantity) {
          throw new Error('Каждый товар должен содержать productId и quantity');
        }

        if (item.quantity <= 0) {
          throw new Error('Количество должно быть больше 0');
        }

        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });
        
        if (!product) {
          throw new Error(`Товар с ID ${item.productId} не найден`);
        }

        if (!product.isActive) {
          throw new Error(`Товар ${product.title} неактивен`);
        }

        // Используем переданную цену или цену из БД
        const productPrice = Number(product.price);
        const price = item.price !== undefined ? Number(item.price) : productPrice;

        return {
          productId: product.id,
          title: product.title,
          price: price,
          quantity: Number(item.quantity),
          originalPrice: productPrice,
          discountApplied: item.price !== undefined && item.price < productPrice
        };
      })
    );

    // Формируем сообщение для заказа
    const orderMessage = message || `Заказ через внешний API. Контакт: ${contact}`;

    // Создаем заказ
    const order = await createOrderRequest({
      contact,
      message: orderMessage,
      items: orderItems
    });

    const response: ApiResponse<{
      orderId: string;
      status: string;
      createdAt: Date;
      items: typeof orderItems;
      total: number;
    }> = {
      success: true,
      data: {
        orderId: order.id,
        status: order.status,
        createdAt: order.createdAt,
        items: orderItems,
        total: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating order:', error);
    
    if (error instanceof Error && (error.message.includes('обязательно') || error.message.includes('должно быть'))) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Ошибка при создании заказа';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

export { router as externalApiRouter };

