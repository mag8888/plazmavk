/**
 * Парсер инвойса для извлечения данных о товарах
 */

export interface InvoiceItem {
  sku: string; // Код товара (например: FS1002-24)
  description: string; // Описание товара
  quantity: number; // Количество
  rate: number; // Цена в БАТ (за единицу)
  amount: number; // Сумма (quantity * rate)
}

/**
 * Парсит инвойс из текстового формата
 * Формат инвойса: Item | Description | Qty | Rate | Amount
 */
export function parseInvoiceText(text: string): InvoiceItem[] {
  const items: InvoiceItem[] = [];
  const lines = text.split('\n');
  
  // Регулярное выражение для поиска строк с товарами
  // Формат: SKU | Description | Qty | Rate | Amount
  const itemPattern = /^([A-Z]{1,3}\d{4}-\d{1,3})\s+(.+?)\s+(\d+)\s+([\d.]+)\s+([\d.]+)$/;
  
  // Альтернативный паттерн для строк без разделителей
  const compactPattern = /([A-Z]{1,3}\d{4}-\d{1,3})\s+([A-Z][^0-9]+?)\s+(\d+)\s+([\d.]+)\s+([\d.]+)/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Пропускаем пустые строки, заголовки и служебные строки
    if (!line || 
        line.includes('Item') || 
        line.includes('Description') || 
        line.includes('Qty') ||
        line.includes('Rate') ||
        line.includes('Amount') ||
        line.includes('Total') ||
        line.includes('INVOICE') ||
        line.includes('We hereby') ||
        line.includes('Page') ||
        line.startsWith('---')) {
      continue;
    }
    
    // Ищем код товара (SKU)
    const skuMatch = line.match(/([A-Z]{1,3}\d{4}-\d{1,3})/);
    if (!skuMatch) continue;
    
    const sku = skuMatch[1];
    
    // Пытаемся извлечь данные из строки
    let qty = 0;
    let rate = 0;
    let amount = 0;
    let description = '';
    
    // Ищем числа в строке (количество, цена, сумма)
    const numbers = line.match(/\b(\d+(?:\.\d+)?)\b/g);
    
    if (numbers && numbers.length >= 3) {
      // Обычно формат: SKU Description Qty Rate Amount
      // Но может быть разное количество пробелов
      const parts = line.split(/\s+/);
      
      // Находим позицию SKU
      const skuIndex = parts.findIndex(p => p === sku);
      
      if (skuIndex >= 0) {
        // Описание - все между SKU и числами
        const descriptionParts: string[] = [];
        let foundFirstNumber = false;
        
        for (let j = skuIndex + 1; j < parts.length; j++) {
          const part = parts[j];
          if (/^\d+(?:\.\d+)?$/.test(part)) {
            if (!foundFirstNumber) {
              qty = parseInt(part) || 0;
              foundFirstNumber = true;
            } else if (rate === 0) {
              rate = parseFloat(part) || 0;
            } else if (amount === 0) {
              amount = parseFloat(part) || 0;
              break;
            }
          } else {
            descriptionParts.push(part);
          }
        }
        
        description = descriptionParts.join(' ').trim();
      }
    }
    
    // Если не удалось распарсить, используем простой метод
    if (qty === 0 || rate === 0) {
      const parts = line.split(/\s+/);
      const skuIndex = parts.findIndex(p => p.includes(sku));
      
      if (skuIndex >= 0) {
        // Ищем все числа в строке
        const numbersInLine = line.match(/\b(\d+(?:\.\d+)?)\b/g);
        if (numbersInLine && numbersInLine.length >= 3) {
          qty = parseInt(numbersInLine[0]) || 0;
          rate = parseFloat(numbersInLine[1]) || 0;
          amount = parseFloat(numbersInLine[2]) || 0;
          
          // Описание - все до первого числа после SKU
          const afterSku = line.substring(line.indexOf(sku) + sku.length);
          description = afterSku.replace(/\s*\d+.*$/, '').trim();
        }
      }
    }
    
    // Если описание пустое, используем следующий шаг - ищем в следующей строке
    if (!description || description.length < 3) {
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // Если следующая строка не содержит числа и не является заголовком
        if (nextLine && 
            !nextLine.match(/^\d/) && 
            !nextLine.includes('Item') &&
            !nextLine.includes('Description') &&
            !nextLine.includes('Page')) {
          description = nextLine;
          i++; // Пропускаем эту строку
        }
      }
    }
    
    // Если все еще нет описания, используем SKU как описание
    if (!description || description.length < 3) {
      description = `Товар ${sku}`;
    }
    
    // Добавляем товар, если есть все необходимые данные
    if (sku && qty > 0 && rate > 0) {
      items.push({
        sku,
        description: description || sku,
        quantity: qty,
        rate,
        amount: amount || (qty * rate)
      });
    }
  }
  
  return items;
}











