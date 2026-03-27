/**
 * Сервисы для работы с товарами
 */

import { PrismaClient } from '@prisma/client';
import { uploadImage, isCloudinaryConfigured } from '../../services/cloudinary-service.js';
import { validateProduct } from './utils.js';

const prisma = new PrismaClient();

export interface CreateProductData {
  title: string;
  summary: string;
  description: string;
  instruction?: string | null;
  price: number;
  categoryId: string;
  imageUrl?: string;
  stock?: number;
  isActive?: boolean;
  availableInRussia?: boolean;
  availableInBali?: boolean;
}

export interface UpdateProductData {
  title?: string;
  summary?: string;
  description?: string;
  instruction?: string | null;
  price?: number;
  categoryId?: string;
  imageUrl?: string;
  stock?: number;
  isActive?: boolean;
  availableInRussia?: boolean;
  availableInBali?: boolean;
}

/**
 * Получить все товары с категориями
 */
export async function getAllProductsWithCategories() {
  const categories = await prisma.category.findMany({
    include: {
      products: {
        include: { category: true },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      },
    },
    orderBy: { name: 'asc' },
  });

  const allProducts = categories.flatMap((category) =>
    category.products.map((product) => ({
      ...product,
      categoryName: category.name,
    }))
  );

  return { categories, allProducts };
}

/**
 * Создать товар
 */
export async function createProduct(data: CreateProductData, imageBuffer?: Buffer) {
  const validation = validateProduct(data);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  // Проверка категории
  const category = await prisma.category.findUnique({
    where: { id: data.categoryId }
  });
  if (!category) {
    throw new Error('Категория не найдена');
  }

  // Загрузка изображения
  let imageUrl = data.imageUrl || '';
  if (imageBuffer) {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary не настроен');
    }

    const result = await uploadImage(imageBuffer, {
      folder: 'vital/products',
      resourceType: 'image',
    });

    imageUrl = result.secureUrl;
  }

  // Создание товара
  const product = await prisma.product.create({
    data: {
      title: data.title.trim(),
      summary: data.summary.trim(),
      description: data.description.trim(),
      instruction: data.instruction?.trim() || null,
      price: data.price,
      categoryId: data.categoryId,
      imageUrl,
      stock: data.stock ?? 999,
      isActive: data.isActive ?? true,
      availableInRussia: data.availableInRussia ?? false,
      availableInBali: data.availableInBali ?? false,
    },
  });

  return product;
}

/**
 * Обновить товар
 */
export async function updateProduct(
  productId: string,
  data: UpdateProductData,
  imageBuffer?: Buffer
) {
  // Проверка существования товара
  const existingProduct = await prisma.product.findUnique({
    where: { id: productId }
  });
  if (!existingProduct) {
    throw new Error('Товар не найден');
  }

  // Загрузка изображения, если предоставлено
  let imageUrl: string | undefined = undefined;
  if (imageBuffer) {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary не настроен');
    }

    const result = await uploadImage(imageBuffer, {
      folder: 'vital/products',
      publicId: `product-${productId}`,
      resourceType: 'image',
    });

    imageUrl = result.secureUrl;
  }

  // Подготовка данных для обновления
  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.price !== undefined) updateData.price = data.price;
  if (data.summary !== undefined) updateData.summary = data.summary.trim();
  if (data.description !== undefined) updateData.description = data.description.trim();
  if (data.instruction !== undefined) updateData.instruction = data.instruction?.trim() || null;
  if (data.categoryId) updateData.categoryId = data.categoryId;
  if (data.stock !== undefined) updateData.stock = data.stock;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.availableInRussia !== undefined) updateData.availableInRussia = data.availableInRussia;
  if (data.availableInBali !== undefined) updateData.availableInBali = data.availableInBali;
  if (imageUrl) updateData.imageUrl = imageUrl;

  const product = await prisma.product.update({
    where: { id: productId },
    data: updateData,
  });

  return product;
}

/**
 * Удалить товар
 */
export async function deleteProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId }
  });
  if (!product) {
    throw new Error('Товар не найден');
  }

  await prisma.product.delete({
    where: { id: productId }
  });

  return true;
}

/**
 * Переключить статус активности товара
 */
export async function toggleProductActive(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId }
  });
  if (!product) {
    throw new Error('Товар не найден');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { isActive: !product.isActive }
  });

  return updated;
}

/**
 * Обновить изображение товара
 */
export async function updateProductImage(productId: string, imageUrl: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId }
  });
  if (!product) {
    throw new Error('Товар не найден');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { imageUrl: imageUrl.trim() }
  });

  return updated;
}

/**
 * Сохранить инструкцию товара
 */
export async function saveProductInstruction(productId: string, instruction: string | null) {
  const product = await prisma.product.findUnique({
    where: { id: productId }
  });
  if (!product) {
    throw new Error('Товар не найден');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { instruction: instruction?.trim() || null }
  });

  return updated;
}

/**
 * Получить список товаров для API
 */
export async function getProductsList() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      price: true,
      category: {
        select: {
          name: true
        }
      }
    },
    orderBy: [
      { category: { name: 'asc' } },
      { title: 'asc' }
    ]
  });

  return products;
}

/**
 * Получить все изображения товаров
 */
export async function getAllProductImages() {
  const products = await prisma.product.findMany({
    select: {
      imageUrl: true,
      title: true,
      id: true,
    },
    where: {
      imageUrl: {
        not: null,
      },
    },
  });

  // Группируем по URL изображения
  const imageMap = new Map<string, { url: string; products: Array<{ id: string; title: string }> }>();

  products.forEach((product) => {
    if (!product.imageUrl) return;

    if (!imageMap.has(product.imageUrl)) {
      imageMap.set(product.imageUrl, {
        url: product.imageUrl,
        products: [],
      });
    }

    imageMap.get(product.imageUrl)!.products.push({
      id: product.id,
      title: product.title,
    });
  });

  return Array.from(imageMap.values());
}

