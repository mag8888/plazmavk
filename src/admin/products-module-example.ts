/**
 * Пример использования модульной структуры для страницы товаров
 * Это демонстрирует, как можно использовать созданные модули
 */

import { escapeAttr, escapeHtml, formatPrice, formatDate } from './products-helpers.js';
import { PRODUCTS_STYLES } from './products-styles.js';

/**
 * Пример функции для генерации HTML страницы товаров
 * Вместо встроенного HTML, используем импортированные модули
 */
export function generateProductsPageHtml(data: {
  categories: any[];
  allProducts: any[];
  query: any;
}) {
  const { categories, allProducts, query } = data;

  // Используем импортированные стили
  const styles = PRODUCTS_STYLES;

  // Используем вспомогательные функции
  const escapedTitle = escapeHtml('Управление товарами');
  
  // Генерация HTML с использованием модулей
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapedTitle}</title>
      <meta charset="utf-8">
      <style>${styles}</style>
      <script src="/admin/products-scripts.js"></script>
    </head>
    <body>
      ${generateHeader()}
      ${generateAlerts(query)}
      ${generateFilters(categories, allProducts.length)}
      ${generateProductGrid(allProducts)}
      ${generateModals(categories)}
    </body>
    </html>
  `;

  return html;
}

/**
 * Генерация заголовка страницы
 */
function generateHeader(): string {
  return `
    <h2>🛍 Управление товарами</h2>
    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
      <a href="/admin" class="btn">← Назад</a>
      <button onclick="scrapeAllImages()" class="btn" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">📸 Собрать ВСЕ фото с сайта</button>
      <button onclick="moveAllToCosmetics()" class="btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">🔄 Собрать в категорию "Косметика"</button>
    </div>
  `;
}

/**
 * Генерация алертов
 */
function generateAlerts(query: any): string {
  const alerts: string[] = [];

  if (query.success === 'image_updated') {
    alerts.push('<div class="alert alert-success">✅ Фото успешно обновлено!</div>');
  }
  if (query.error === 'no_image') {
    alerts.push('<div class="alert alert-error">❌ Файл не выбран</div>');
  }
  if (query.error === 'image_upload') {
    alerts.push('<div class="alert alert-error">❌ Ошибка загрузки фото</div>');
  }
  if (query.error === 'product_not_found') {
    alerts.push('<div class="alert alert-error">❌ Товар не найден</div>');
  }
  if (query.success === 'images_scraped') {
    alerts.push('<div class="alert alert-success">✅ Фото успешно собраны! Проверьте результаты ниже.</div>');
  }

  return alerts.join('\n');
}

/**
 * Генерация фильтров категорий
 */
function generateFilters(categories: any[], totalProducts: number): string {
  let html = `
    <div class="filters">
      <button type="button" class="filter-btn active" data-filter="all">Все категории (${totalProducts})</button>
  `;

  categories.forEach((category) => {
    html += `
      <button type="button" class="filter-btn" data-filter="${escapeAttr(category.id)}">${escapeHtml(category.name)} (${category.products.length})</button>
    `;
  });

  html += `
      <button type="button" class="filter-btn add-category-btn" onclick="openAddCategoryModal()" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none;">
        ➕ Категорию
      </button>
      <button type="button" class="filter-btn add-subcategory-btn" onclick="openAddSubcategoryModal()" style="background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; border: none;">
        ➕ Подкатегорию
      </button>
    </div>
  `;

  return html;
}

/**
 * Генерация сетки товаров
 */
function generateProductGrid(products: any[]): string {
  if (products.length === 0) {
    return `
      <div class="empty-state">
        <h3>Пока нет добавленных товаров</h3>
        <p>Используйте форму на главной странице админки, чтобы добавить первый товар.</p>
      </div>
    `;
  }

  let html = '<div class="product-grid">';

  products.forEach((product) => {
    html += generateProductCard(product);
  });

  html += '</div>';

  return html;
}

/**
 * Генерация карточки товара
 */
function generateProductCard(product: any): string {
  const rubPrice = (product.price * 100).toFixed(2);
  const priceFormatted = `${rubPrice} руб. / ${product.price.toFixed(2)} PZ`;
  const createdAt = formatDate(product.createdAt);
  const imageId = `product-img-${product.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const placeholderId = `product-placeholder-${product.id.replace(/[^a-zA-Z0-9]/g, '-')}`;

  const imageSection = product.imageUrl
    ? `<img id="${imageId}" src="${escapeAttr(product.imageUrl)}" alt="${escapeAttr(product.title)}" class="product-image" loading="lazy" onerror="var i=document.getElementById('${imageId}');var p=document.getElementById('${placeholderId}');if(i)i.style.display='none';if(p)p.style.display='flex';">
       <div id="${placeholderId}" class="product-image-placeholder" style="display: none;">
         <span class="placeholder-icon">📷</span>
         <span class="placeholder-text">Нет фото</span>
       </div>`
    : `<div class="product-image-placeholder">
         <span class="placeholder-icon">📷</span>
         <span class="placeholder-text">Нет фото</span>
       </div>`;

  return `
    <div class="product-card" data-category="${escapeAttr(product.categoryId)}" data-id="${escapeAttr(product.id)}">
      ${imageSection}
      <div class="product-header">
        <h3 class="product-title">${escapeHtml(product.title)}</h3>
        <form method="post" action="/admin/products/${escapeAttr(product.id)}/toggle-active" style="display: inline;">
          <button type="submit" class="status-btn ${product.isActive ? 'active' : 'inactive'}" style="border: none; background: none; cursor: pointer; font-size: 12px; padding: 4px 8px; border-radius: 4px;">
            ${product.isActive ? '✅ Активен' : '❌ Неактивен'}
          </button>
        </form>
      </div>
      <span class="badge badge-category">${escapeHtml(product.categoryName)}</span>
      <div style="margin: 8px 0;">
        <span style="font-size: 12px; color: #666;">Регионы:</span>
        ${(product as any).availableInRussia ? '<span style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px;">🇷🇺 Россия</span>' : ''}
        ${(product as any).availableInBali ? '<span style="background: #f3e5f5; color: #7b1fa2; padding: 2px 6px; border-radius: 4px; font-size: 11px;">🇮🇩 Бали</span>' : ''}
      </div>
      <p class="product-summary">${escapeHtml(product.summary)}</p>
      <div class="product-price">${priceFormatted}</div>
      <div class="product-meta">
        <span>Создан: ${createdAt}</span>
        <span>ID: ${escapeHtml(product.id.slice(0, 8))}...</span>
      </div>
      ${generateProductActions(product)}
    </div>
  `;
}

/**
 * Генерация действий для товара
 */
function generateProductActions(product: any): string {
  return `
    <div class="product-actions">
      <button 
        type="button" 
        class="edit-btn"
        data-id="${escapeAttr(product.id)}"
        data-title="${escapeAttr(product.title)}"
        data-summary="${escapeAttr(product.summary)}"
        data-description="${escapeAttr(product.description)}"
        data-instruction="${escapeAttr((product as any).instruction)}"
        data-price="${product.price}"
        data-category-id="${escapeAttr(product.categoryId)}"
        data-active="${product.isActive ? 'true' : 'false'}"
        data-russia="${(product as any).availableInRussia ? 'true' : 'false'}"
        data-bali="${(product as any).availableInBali ? 'true' : 'false'}"
        data-image="${escapeAttr(product.imageUrl)}"
        onclick="editProduct(this)"
      >✏️ Редактировать</button>
      <form method="post" action="/admin/products/${escapeAttr(product.id)}/toggle-active">
        <button type="submit" class="toggle-btn">${product.isActive ? 'Отключить' : 'Включить'}</button>
      </form>
      <form method="post" action="/admin/products/${escapeAttr(product.id)}/upload-image" enctype="multipart/form-data" style="display: inline;">
        <input type="file" name="image" accept="image/*" style="display: none;" id="image-${escapeAttr(product.id)}" onchange="this.form.submit()">
        <button type="button" class="image-btn" onclick="document.getElementById('image-${escapeAttr(product.id)}').click()">📷 ${product.imageUrl ? 'Изменить фото' : 'Добавить фото'}</button>
      </form>
      <button type="button" class="image-btn select-image-btn" style="background: #6366f1;" data-product-id="${escapeAttr(product.id)}">🖼️ Выбрать из загруженных</button>
      <button class="instruction-btn" data-instruction-id="${escapeAttr(product.id)}" data-instruction-text="${escapeAttr((product as any).instruction)}" onclick="showInstructionSafe(this)" style="background: #28a745;">📋 Инструкция</button>
      <form method="post" action="/admin/products/${escapeAttr(product.id)}/delete" onsubmit="return confirm('Удалить товар?')">
        <button type="submit" class="delete-btn">Удалить</button>
      </form>
    </div>
  `;
}

/**
 * Генерация модальных окон
 */
function generateModals(categories: any[]): string {
  return `
    ${generateAddCategoryModal()}
    ${generateAddSubcategoryModal(categories)}
  `;
}

/**
 * Генерация модального окна добавления категории
 */
function generateAddCategoryModal(): string {
  return `
    <div id="addCategoryModal" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h2>➕ Добавить категорию</h2>
          <button class="close-btn" onclick="closeAddCategoryModal()">&times;</button>
        </div>
        <form id="addCategoryForm" class="modal-form">
          <div class="form-group">
            <label for="categoryName">Название категории</label>
            <input type="text" id="categoryName" name="name" required placeholder="Например: Косметика">
          </div>
          <div class="form-group">
            <label for="categoryDescription">Описание (необязательно)</label>
            <textarea id="categoryDescription" name="description" rows="3" placeholder="Описание категории"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" onclick="closeAddCategoryModal()">❌ Отмена</button>
            <button type="submit">✅ Создать категорию</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Генерация модального окна добавления подкатегории
 */
function generateAddSubcategoryModal(categories: any[]): string {
  const categoryOptions = categories.map(cat => 
    `<option value="${escapeAttr(cat.id)}">${escapeHtml(cat.name)}</option>`
  ).join('');

  return `
    <div id="addSubcategoryModal" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h2>➕ Добавить подкатегорию</h2>
          <button class="close-btn" onclick="closeAddSubcategoryModal()">&times;</button>
        </div>
        <form id="addSubcategoryForm" class="modal-form">
          <div class="form-group">
            <label for="subcategoryName">Название подкатегории</label>
            <input type="text" id="subcategoryName" name="name" required placeholder="Например: Кремы для лица">
          </div>
          <div class="form-group">
            <label for="subcategoryParent">Родительская категория</label>
            <select id="subcategoryParent" name="parentId" required>
              <option value="">Выберите категорию...</option>
              ${categoryOptions}
            </select>
          </div>
          <div class="form-group">
            <label for="subcategoryDescription">Описание (необязательно)</label>
            <textarea id="subcategoryDescription" name="description" rows="3" placeholder="Описание подкатегории"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" onclick="closeAddSubcategoryModal()">❌ Отмена</button>
            <button type="submit">✅ Создать подкатегорию</button>
          </div>
        </form>
      </div>
    </div>
  `;
}










