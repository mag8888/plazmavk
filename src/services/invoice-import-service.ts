/**
 * Сервис для импорта товаров из инвойса
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface InvoiceItem {
  sku: string; // Код товара (например: FS1002-24)
  description: string; // Описание товара
  quantity: number; // Количество
  rate: number; // Цена в БАТ (за единицу)
  amount: number; // Сумма (quantity * rate)
}

/**
 * Парсит инвойс из текстового формата (разделенный |)
 */
export function parseInvoiceFromDelimitedText(text: string): InvoiceItem[] {
  const items: InvoiceItem[] = [];
  const lines = text.split('\n');

  // Группируем товары по SKU (суммируем количество)
  const itemsMap = new Map<string, InvoiceItem>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Формат: SKU|Description|Qty|Rate|Amount
    const parts = trimmed.split('|').map(p => p.trim());

    if (parts.length >= 5) {
      const sku = parts[0];
      const description = parts[1];
      const qty = parseInt(parts[2]) || 0;
      const rate = parseFloat(parts[3]) || 0;
      const amount = parseFloat(parts[4]) || 0;

      if (sku && qty > 0 && rate > 0) {
        if (itemsMap.has(sku)) {
          // Суммируем количество для одинаковых SKU
          const existing = itemsMap.get(sku)!;
          existing.quantity += qty;
          existing.amount += amount;
        } else {
          itemsMap.set(sku, {
            sku,
            description,
            quantity: qty,
            rate,
            amount
          });
        }
      }
    }
  }

  return Array.from(itemsMap.values());
}

/**
 * Получает настройки импорта (курс валюты и мультипликатор)
 */
export async function getImportSettings(): Promise<{ exchangeRate: number; priceMultiplier: number }> {
  // По умолчанию: формула из ТЗ — THB × 2.7 × (2 × 4) = THB × 2.7 × 8
  const defaultExchangeRate = 2.7;
  const defaultMultiplier = 8;

  try {
    const exchangeRateSetting = await prisma.settings.findUnique({
      where: { key: 'exchange_rate' }
    });

    const multiplierSetting = await prisma.settings.findUnique({
      where: { key: 'price_multiplier' }
    });

    return {
      exchangeRate: exchangeRateSetting ? parseFloat(exchangeRateSetting.value) : defaultExchangeRate,
      priceMultiplier: multiplierSetting ? parseFloat(multiplierSetting.value) : defaultMultiplier
    };
  } catch (error) {
    console.error('Error getting import settings:', error);
    return {
      exchangeRate: defaultExchangeRate,
      priceMultiplier: defaultMultiplier
    };
  }
}

/**
 * Сохраняет настройки импорта
 */
export async function saveImportSettings(exchangeRate: number, priceMultiplier: number): Promise<void> {
  try {
    // REFACTOR: Avoid upsert on standalone
    let exRate = await prisma.settings.findUnique({ where: { key: 'exchange_rate' } });
    if (exRate) {
      await prisma.settings.update({
        where: { key: 'exchange_rate' },
        data: { value: exchangeRate.toString(), description: 'Курс обмена БАТ в рублях' }
      });
    } else {
      await prisma.settings.create({
        data: {
          key: 'exchange_rate',
          value: exchangeRate.toString(),
          description: 'Курс обмена БАТ в рублях'
        }
      });
    }

    let mult = await prisma.settings.findUnique({ where: { key: 'price_multiplier' } });
    if (mult) {
      await prisma.settings.update({
        where: { key: 'price_multiplier' },
        data: { value: priceMultiplier.toString(), description: 'Мультипликатор для расчета продажной цены' }
      });
    } else {
      await prisma.settings.create({
        data: {
          key: 'price_multiplier',
          value: priceMultiplier.toString(),
          description: 'Мультипликатор для расчета продажной цены'
        }
      });
    }
  } catch (error) {
    console.error('Error saving import settings:', error);
    throw error;
  }
}

/**
 * Рассчитывает продажную цену из закупочной
 * Формула: Цена закупки * exchangeRate * multiplier = цена в рублях
 * Округляем до ближайшего десятка (10, 20, 30, ...)
 * Затем конвертируем в PZ: цена в рублях / 100
 */
export function calculateSellingPrice(purchasePriceBAT: number, exchangeRate: number, multiplier: number): number {
  // Формула: цена_закупки * exchangeRate * multiplier = цена в рублях
  const priceInRubles = purchasePriceBAT * exchangeRate * multiplier;
  // Округляем до ближайшего десятка
  const roundedRubles = Math.round(priceInRubles / 10) * 10;
  // Конвертируем в PZ (1 PZ = 100 руб)
  const priceInPZ = roundedRubles / 100;
  return Math.round(priceInPZ * 100) / 100; // Округляем до 2 знаков
}

/**
 * Импортирует товары из инвойса
 */
export async function importInvoiceItems(invoiceItems: InvoiceItem[]): Promise<{
  updated: number;
  created: number;
  failed: number;
  lowStockWarnings: string[];
  outOfStock: string[];
  errors: string[];
}> {
  const settings = await getImportSettings();
  const { exchangeRate, priceMultiplier } = settings;

  let updated = 0;
  let created = 0;
  let failed = 0;
  const lowStockWarnings: string[] = [];
  const outOfStock: string[] = [];
  const errors: string[] = [];

  for (const item of invoiceItems) {
    try {
      // Находим товар по SKU
      const existingProduct = await prisma.product.findFirst({
        where: {
          OR: [
            { sku: item.sku },
            { title: { contains: item.sku } }
          ]
        }
      });

      // Рассчитываем продажную цену
      const sellingPrice = calculateSellingPrice(item.rate, exchangeRate, priceMultiplier);

      if (existingProduct) {
        // Обновляем существующий товар
        const oldStock = existingProduct.stock;
        const newStock = item.quantity;

        // Обновляем товар
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            purchasePrice: item.rate,
            price: sellingPrice,
            stock: newStock,
            sku: item.sku,
            // Деактивируем если остаток 0
            isActive: newStock > 0 ? existingProduct.isActive : false
          }
        });

        updated++;

        // Проверяем низкий остаток
        if (newStock > 0 && newStock <= (existingProduct.lowStockThreshold || 3)) {
          lowStockWarnings.push(`${existingProduct.title} (SKU: ${item.sku}) - осталось ${newStock} шт.`);
        }

        // Проверяем нулевой остаток
        if (newStock === 0 && oldStock > 0) {
          outOfStock.push(`${existingProduct.title} (SKU: ${item.sku})`);
        }

      } else {
        // Ищем категорию по умолчанию или создаем
        let defaultCategory = await prisma.category.findFirst({
          where: { slug: 'default' }
        });

        if (!defaultCategory) {
          defaultCategory = await prisma.category.create({
            data: {
              name: 'По умолчанию',
              slug: 'default',
              isActive: true
            }
          });
        }

        // Создаем новый товар
        await prisma.product.create({
          data: {
            title: item.description || item.sku,
            summary: item.description || `Товар ${item.sku}`,
            description: item.description || '',
            price: sellingPrice,
            purchasePrice: item.rate,
            sku: item.sku,
            stock: item.quantity,
            isActive: item.quantity > 0,
            categoryId: defaultCategory.id,
            availableInRussia: true,
            availableInBali: false,
            lowStockThreshold: 3
          }
        });

        created++;

        // Проверяем низкий остаток
        if (item.quantity <= 3) {
          lowStockWarnings.push(`${item.description || item.sku} (SKU: ${item.sku}) - осталось ${item.quantity} шт.`);
        }

        // Проверяем нулевой остаток
        if (item.quantity === 0) {
          outOfStock.push(`${item.description || item.sku} (SKU: ${item.sku})`);
        }
      }
    } catch (error: any) {
      console.error(`Error importing item ${item.sku}:`, error);
      failed++;
      errors.push(`${item.sku}: ${error.message || 'Unknown error'}`);
    }
  }

  // Отправляем уведомления админам
  try {
    const { getBotInstance } = await import('../lib/bot-instance.js');
    const { sendToAllAdmins } = await import('../config/env.js');
    const bot = await getBotInstance();

    if (bot) {
      if (lowStockWarnings.length > 0) {
        const message = '⚠️ <b>Предупреждение о низком остатке товаров:</b>\n\n' +
          lowStockWarnings.slice(0, 10).map((w, i) => `${i + 1}. ${w}`).join('\n') +
          (lowStockWarnings.length > 10 ? `\n\n... и еще ${lowStockWarnings.length - 10} товаров` : '');

        try {
          await sendToAllAdmins(bot, message);
        } catch (error) {
          console.error('Error sending low stock warning:', error);
        }
      }

      if (outOfStock.length > 0) {
        const message = '🛑 <b>Товары закончились (деактивированы):</b>\n\n' +
          outOfStock.slice(0, 10).map((w, i) => `${i + 1}. ${w}`).join('\n') +
          (outOfStock.length > 10 ? `\n\n... и еще ${outOfStock.length - 10} товаров` : '');

        try {
          await sendToAllAdmins(bot, message);
        } catch (error) {
          console.error('Error sending out of stock notification:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error getting bot instance for notifications:', error);
  }

  return {
    updated,
    created,
    failed,
    lowStockWarnings,
    outOfStock,
    errors
  };
}
