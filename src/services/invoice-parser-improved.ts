/**
 * Улучшенный парсер инвойса для извлечения данных о товарах из текстового формата
 */

export interface ParsedInvoiceItem {
  sku: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

/**
 * Парсит инвойс из текстового формата
 * Поддерживает различные форматы инвойса
 */
export function parseInvoiceText(text: string): ParsedInvoiceItem[] {
  const items: ParsedInvoiceItem[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // Регулярное выражение для поиска SKU (например: FS1002-24, FC0001-45)
  const skuPattern = /([A-Z]{1,3}\d{4}-\d{1,3})/;

  // Словарь для группировки товаров по SKU
  const itemsMap = new Map<string, ParsedInvoiceItem>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Пропускаем служебные строки
    if (line.includes('Item') ||
      line.includes('Description') ||
      line.includes('Qty') ||
      line.includes('Rate') ||
      line.includes('Amount') ||
      line.includes('Total') ||
      line.includes('INVOICE') ||
      line.includes('We hereby') ||
      line.includes('Page') ||
      line.startsWith('---') ||
      line.includes('ORDER DEPOSIT') ||
      line.includes('Deposit paid') ||
      line.includes('Please make payment') ||
      line.includes('Bangkok Bank') ||
      line.includes('Account Name') ||
      line.includes('Swift Code') ||
      line.includes('Out-of-state') ||
      line.includes('THB')) {
      continue;
    }

    // Ищем SKU
    const skuMatch = line.match(skuPattern);
    if (!skuMatch) continue;

    const sku = skuMatch[1];

    // Извлекаем числа из строки
    let numbers = line.match(/\b(\d+(?:\.\d+)?)\b/g);
    if (!numbers || numbers.length < 3) {
      // Пробуем взять данные из следующей строки
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextNumbers = nextLine.match(/\b(\d+(?:\.\d+)?)\b/g);
        if (nextNumbers && nextNumbers.length >= 3) {
          numbers = nextNumbers;
          i++; // Пропускаем следующую строку
        }
      }
      if (!numbers || numbers.length < 3) continue;
    }

    const qty = parseInt(numbers[0]) || 0;
    const rate = parseFloat(numbers[1]) || 0;
    const amount = parseFloat(numbers[2]) || 0;

    // Извлекаем описание
    let description = '';

    // Удаляем SKU и числа из строки, оставляем только описание
    let descriptionLine = line
      .replace(skuPattern, '')
      .replace(/\b\d+(?:\.\d+)?\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Очищаем от лишних символов
    descriptionLine = descriptionLine
      .replace(/^\||\|$/g, '')
      .replace(/\|/g, ' ')
      .trim();

    if (descriptionLine && descriptionLine.length > 3) {
      description = descriptionLine;
    } else {
      // Пробуем взять описание из следующей строки
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (!nextLine.match(skuPattern) &&
          !nextLine.match(/^\d+/) &&
          !nextLine.includes('Item') &&
          !nextLine.includes('Description')) {
          description = nextLine.trim();
          i++; // Пропускаем строку с описанием
        }
      }
    }

    // Если описание все еще пустое, используем SKU
    if (!description || description.length < 3) {
      description = `Товар ${sku}`;
    }

    // Группируем товары по SKU (суммируем количество)
    if (itemsMap.has(sku)) {
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

  return Array.from(itemsMap.values()).filter(item => item.quantity > 0 && item.rate > 0);
}











