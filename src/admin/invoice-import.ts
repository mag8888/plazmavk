/**
 * API endpoints для импорта инвойса и настроек
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { parseInvoiceFromDelimitedText, importInvoiceItems, getImportSettings, saveImportSettings, calculateSellingPrice } from '../services/invoice-import-service.js';
import multer from 'multer';

const router = Router();
const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB is plenty for CSV
});

function escapeCsvCell(value: any): string {
  const s = String(value ?? '');
  if (/[",\n\r;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function detectDelimiter(headerLine: string): ',' | ';' | '\t' {
  const comma = (headerLine.match(/,/g) || []).length;
  const semi = (headerLine.match(/;/g) || []).length;
  const tab = (headerLine.match(/\t/g) || []).length;
  if (tab >= comma && tab >= semi) return '\t';
  if (semi >= comma) return ';';
  return ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

type CsvRow = {
  productId: string;
  sku?: string;
  invoiceRateTHB?: number;
  invoiceQty?: number;
};

function parseCsvBuffer(buf: Buffer): { rows: CsvRow[]; errors: string[] } {
  const text = buf.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ['CSV пустой или содержит только заголовок'] };

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter);
  const colIndex = (name: string) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const idxProductId = colIndex('productId');
  const idxSku = colIndex('sku');
  const idxRate = colIndex('invoiceRateTHB');
  const idxQty = colIndex('invoiceQty');

  const errors: string[] = [];
  if (idxProductId < 0) errors.push('Нет колонки productId');
  if (idxRate < 0) errors.push('Нет колонки invoiceRateTHB');
  if (idxQty < 0) errors.push('Нет колонки invoiceQty');
  if (errors.length) return { rows: [], errors };

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const productId = String(cols[idxProductId] || '').trim();
    const sku = idxSku >= 0 ? String(cols[idxSku] || '').trim() : '';

    const rateRaw = String(cols[idxRate] || '').trim().replace(',', '.');
    const qtyRaw = String(cols[idxQty] || '').trim().replace(',', '.');

    const invoiceRateTHB = rateRaw ? Number(rateRaw) : undefined;
    const invoiceQty = qtyRaw ? Number(qtyRaw) : undefined;

    if (!productId) {
      // allow empty trailing lines, but otherwise it's an error
      continue;
    }

    rows.push({
      productId,
      sku: sku || undefined,
      invoiceRateTHB,
      invoiceQty
    });
  }

  return { rows, errors: [] };
}

// Middleware для проверки админа
function requireAdmin(req: any, res: any, next: any) {
  if (!req.session || !req.session.isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET: Получить настройки импорта
router.get('/api/import-settings', requireAdmin, async (req, res) => {
  try {
    const settings = await getImportSettings();
    res.json({ success: true, ...settings });
  } catch (error: any) {
    console.error('Error getting import settings:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка получения настроек' });
  }
});

// POST: Сохранить настройки импорта
router.post('/api/import-settings', requireAdmin, async (req, res) => {
  try {
    const { exchangeRate, priceMultiplier } = req.body;
    
    if (!exchangeRate || !priceMultiplier || exchangeRate <= 0 || priceMultiplier <= 0) {
      return res.status(400).json({ success: false, error: 'Курс и мультипликатор должны быть положительными числами' });
    }
    
    await saveImportSettings(parseFloat(exchangeRate), parseFloat(priceMultiplier));
    res.json({ success: true, message: 'Настройки сохранены' });
  } catch (error: any) {
    console.error('Error saving import settings:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка сохранения настроек' });
  }
});

// POST: Импорт инвойса
router.post('/api/import-invoice', requireAdmin, async (req, res) => {
  try {
    const { invoiceText } = req.body;
    
    if (!invoiceText || !invoiceText.trim()) {
      return res.status(400).json({ success: false, error: 'Текст инвойса не предоставлен' });
    }
    
    // Парсим инвойс
    const items = parseInvoiceFromDelimitedText(invoiceText);
    
    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'Не удалось распознать товары в инвойсе' });
    }
    
    // Запускаем импорт в фоне
    importInvoiceItems(items)
      .then(result => {
        console.log('✅ Invoice import completed:', result);
      })
      .catch(error => {
        console.error('❌ Invoice import error:', error);
      });
    
    res.json({
      success: true,
      message: `Импорт запущен. Обрабатывается ${items.length} товаров.`,
      itemsCount: items.length
    });
  } catch (error: any) {
    console.error('Error importing invoice:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка импорта инвойса' });
  }
});

// POST: Импорт инвойса (синхронный, для детального результата)
router.post('/api/import-invoice-sync', requireAdmin, async (req, res) => {
  try {
    const { invoiceText } = req.body;
    
    if (!invoiceText || !invoiceText.trim()) {
      return res.status(400).json({ success: false, error: 'Текст инвойса не предоставлен' });
    }
    
    // Парсим инвойс
    const items = parseInvoiceFromDelimitedText(invoiceText);
    
    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'Не удалось распознать товары в инвойсе' });
    }
    
    // Выполняем импорт синхронно
    const result = await importInvoiceItems(items);
    
    res.json({
      success: true,
      message: 'Импорт завершен',
      result: {
        total: items.length,
        ...result
      }
    });
  } catch (error: any) {
    console.error('Error importing invoice:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка импорта инвойса' });
  }
});

// GET: CSV template export for invoice updates
router.get('/api/invoice-csv-template', requireAdmin, async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: { id: true, sku: true, title: true, price: true, stock: true, purchasePrice: true },
      orderBy: { createdAt: 'desc' }
    });

    const header = [
      'productId',
      'sku',
      'title',
      'currentPricePZ',
      'currentPriceRUB',
      'currentStock',
      'invoiceRateTHB',
      'invoiceQty'
    ];

    const lines: string[] = [];
    lines.push(header.join(','));
    for (const p of products) {
      const currentPz = Number(p.price || 0);
      const currentRub = Math.round(currentPz * 100);
      lines.push(
        [
          escapeCsvCell(p.id),
          escapeCsvCell(p.sku || ''),
          escapeCsvCell(p.title || ''),
          escapeCsvCell(currentPz.toFixed(2)),
          escapeCsvCell(String(currentRub)),
          escapeCsvCell(String(p.stock ?? '')),
          '', // invoiceRateTHB
          ''  // invoiceQty
        ].join(',')
      );
    }

    const csv = '\uFEFF' + lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="invoice_update_template.csv"');
    res.send(csv);
  } catch (error: any) {
    console.error('CSV template error:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка экспорта CSV' });
  }
});

// POST: Import invoice updates from CSV (dry-run or apply)
router.post('/api/import-invoice-csv-sync', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const file = (req as any).file as { buffer?: Buffer; originalname?: string } | undefined;
    if (!file?.buffer) {
      return res.status(400).json({ success: false, error: 'CSV файл не предоставлен (поле file)' });
    }

    const apply = String((req.body?.apply ?? '0')).trim() === '1';
    const { rows, errors: parseErrors } = parseCsvBuffer(file.buffer);
    if (parseErrors.length) {
      return res.status(400).json({ success: false, error: 'Ошибка CSV', errors: parseErrors });
    }

    const seen = new Set<string>();
    const errors: string[] = [];
    const actionable = rows.filter(r => r.invoiceRateTHB != null || r.invoiceQty != null);
    if (actionable.length === 0) {
      return res.status(400).json({ success: false, error: 'В файле нет строк для обновления (заполни invoiceRateTHB и invoiceQty)' });
    }

    for (const r of actionable) {
      if (seen.has(r.productId)) errors.push(`Дубликат productId в CSV: ${r.productId}`);
      seen.add(r.productId);
      if (r.invoiceRateTHB == null || !Number.isFinite(r.invoiceRateTHB) || r.invoiceRateTHB <= 0) {
        errors.push(`Некорректный invoiceRateTHB для productId=${r.productId}`);
      }
      if (r.invoiceQty == null || !Number.isFinite(r.invoiceQty) || r.invoiceQty < 0) {
        errors.push(`Некорректный invoiceQty для productId=${r.productId}`);
      }
    }

    if (errors.length) {
      return res.status(400).json({ success: false, error: 'Ошибки в CSV', errors });
    }

    const ids = actionable.map(r => r.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, sku: true, title: true, price: true, stock: true, isActive: true, lowStockThreshold: true }
    });
    const byId = new Map(products.map(p => [p.id, p]));

    const missing = ids.filter(id => !byId.has(id));
    if (missing.length) {
      return res.status(400).json({ success: false, error: 'Некоторые товары не найдены по productId', errors: missing.map(id => `Не найден productId: ${id}`) });
    }

    // Optional SKU consistency check (if provided)
    for (const r of actionable) {
      if (r.sku) {
        const p = byId.get(r.productId)!;
        const dbSku = String(p.sku || '').trim();
        if (dbSku && dbSku !== r.sku.trim()) {
          errors.push(`SKU не совпадает для productId=${r.productId}: CSV="${r.sku}" DB="${dbSku}"`);
        }
      }
    }
    if (errors.length) {
      return res.status(400).json({ success: false, error: 'Ошибки соответствия', errors });
    }

    const settings = await getImportSettings();
    const updates = actionable.map(r => {
      const p = byId.get(r.productId)!;
      const oldPricePz = Number(p.price || 0);
      const oldStock = Number(p.stock ?? 0);
      const newStock = Number(r.invoiceQty || 0);
      const newPricePz = calculateSellingPrice(Number(r.invoiceRateTHB || 0), settings.exchangeRate, settings.priceMultiplier);
      return {
        productId: p.id,
        sku: p.sku,
        title: p.title,
        oldPricePz,
        newPricePz,
        oldStock,
        newStock,
        purchasePriceTHB: Number(r.invoiceRateTHB || 0)
      };
    });

    if (apply) {
      await prisma.$transaction(async (tx) => {
        for (const u of updates) {
          const existing = byId.get(u.productId)!;
          await tx.product.update({
            where: { id: u.productId },
            data: {
              purchasePrice: u.purchasePriceTHB,
              price: u.newPricePz,
              stock: u.newStock,
              isActive: u.newStock > 0 ? existing.isActive : false
            }
          });
        }
      });
    }

    res.json({
      success: true,
      applied: apply,
      settings,
      summary: {
        rowsTotal: rows.length,
        rowsToUpdate: updates.length
      },
      updates
    });
  } catch (error: any) {
    console.error('CSV import error:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка импорта CSV' });
  }
});

// GET: Тест расчета цены
router.get('/api/test-price-calculation', requireAdmin, async (req, res) => {
  try {
    const { purchasePrice } = req.query;
    
    if (!purchasePrice) {
      return res.status(400).json({ success: false, error: 'Не указана закупочная цена' });
    }
    
    const settings = await getImportSettings();
    // Формула: цена_закупки * exchangeRate * priceMultiplier = цена в ₽, затем / 100 для PZ
    const purchasePriceBAT = parseFloat(purchasePrice as string);
    const priceInRubles = purchasePriceBAT * settings.exchangeRate * settings.priceMultiplier;
    const roundedPriceRub = Math.round(priceInRubles / 10) * 10;
    const sellingPrice = calculateSellingPrice(purchasePriceBAT, settings.exchangeRate, settings.priceMultiplier);

    res.json({
      success: true,
      calculation: {
        purchasePriceBAT: purchasePriceBAT,
        exchangeRate: settings.exchangeRate,
        multiplier: settings.priceMultiplier,
        priceInRubles: priceInRubles,
        roundedPriceRub: roundedPriceRub,
        sellingPricePZ: sellingPrice,
        formula: `${purchasePriceBAT} × ${settings.exchangeRate} × ${settings.priceMultiplier} = ${priceInRubles.toFixed(2)} руб. → округлено до ${roundedPriceRub} руб. = ${sellingPrice.toFixed(2)} PZ`
      }
    });
  } catch (error: any) {
    console.error('Error testing price calculation:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка расчета цены' });
  }
});

export default router;




