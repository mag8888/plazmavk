# External API Documentation

API для дружественных сервисов для интеграции с каталогом продукции и создания заказов.

## Аутентификация

Все запросы требуют API ключ в заголовке:

```
X-API-Key: ваш-api-ключ
```

API ключ настраивается через переменную окружения `EXTERNAL_API_KEY`.

## Базовый URL

```
https://plazma-production.up.railway.app/api/external
```

## Эндпоинты

### 1. Получить полный каталог

**GET** `/catalog`

Возвращает все активные категории с товарами.

**Query параметры:**
- `region` (опционально) - `RUSSIA` или `BALI` (по умолчанию `RUSSIA`)

**Пример запроса:**
```bash
curl -X GET "https://plazma-production.up.railway.app/api/external/catalog?region=RUSSIA" \
  -H "X-API-Key: ваш-api-ключ"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": [
    {
      "id": "category-id",
      "name": "Название категории",
      "slug": "category-slug",
      "description": "Описание категории",
      "isActive": true,
      "products": [
        {
          "id": "product-id",
          "title": "Название товара",
          "summary": "Краткое описание",
          "description": "Полное описание",
          "imageUrl": "https://...",
          "price": 1.2,
          "priceRub": 120,
          "stock": 999,
          "availableInRussia": true,
          "availableInBali": false,
          "createdAt": "2024-01-01T00:00:00.000Z",
          "updatedAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 2. Получить список категорий

**GET** `/categories`

Возвращает список всех активных категорий.

**Пример запроса:**
```bash
curl -X GET "https://plazma-production.up.railway.app/api/external/categories" \
  -H "X-API-Key: ваш-api-ключ"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": [
    {
      "id": "category-id",
      "name": "Название категории",
      "slug": "category-slug",
      "description": "Описание категории",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 3. Получить список товаров

**GET** `/products`

Возвращает список товаров с возможностью фильтрации.

**Query параметры:**
- `categoryId` (опционально) - ID категории для фильтрации
- `region` (опционально) - `RUSSIA` или `BALI` (по умолчанию `RUSSIA`)
- `search` (опционально) - поиск по названию/описанию
- `limit` (опционально) - лимит результатов (по умолчанию 100, максимум 1000)
- `offset` (опционально) - смещение для пагинации (по умолчанию 0)

**Пример запроса:**
```bash
curl -X GET "https://plazma-production.up.railway.app/api/external/products?categoryId=xxx&region=RUSSIA&limit=50&offset=0" \
  -H "X-API-Key: ваш-api-ключ"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": [
    {
      "id": "product-id",
      "title": "Название товара",
      "description": "Описание товара",
      "price": 1.2,
      "priceRub": 120,
      "isActive": true,
      "categoryId": "category-id",
      "imageUrl": "https://...",
      "summary": "Краткое описание",
      "stock": 999,
      "availableInRussia": true,
      "availableInBali": false,
      "category": {
        "id": "category-id",
        "name": "Название категории",
        "slug": "category-slug"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Заголовки ответа:**
- `X-Total-Count` - общее количество товаров
- `X-Limit` - использованный лимит
- `X-Offset` - использованное смещение

### 4. Получить конкретный товар

**GET** `/products/:id`

Возвращает информацию о конкретном товаре по ID.

**Пример запроса:**
```bash
curl -X GET "https://plazma-production.up.railway.app/api/external/products/product-id" \
  -H "X-API-Key: ваш-api-ключ"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "id": "product-id",
    "title": "Название товара",
    "description": "Описание товара",
    "price": 1.2,
    "priceRub": 120,
    "isActive": true,
    "categoryId": "category-id",
    "imageUrl": "https://...",
    "summary": "Краткое описание",
    "stock": 999,
    "availableInRussia": true,
    "availableInBali": false,
    "category": {
      "id": "category-id",
      "name": "Название категории",
      "slug": "category-slug",
      "description": "Описание категории",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 5. Создать заказ

**POST** `/orders`

Создает новый заказ.

**Тело запроса:**
```json
{
  "contact": "телефон или другой контакт",
  "items": [
    {
      "productId": "product-id",
      "quantity": 2,
      "price": 1.2
    }
  ],
  "message": "дополнительная информация (опционально)"
}
```

**Поля:**
- `contact` (обязательно) - контактная информация клиента
- `items` (обязательно) - массив товаров:
  - `productId` (обязательно) - ID товара
  - `quantity` (обязательно) - количество (должно быть > 0)
  - `price` (опционально) - цена за единицу (если не указана, берется из БД)
- `message` (опционально) - дополнительная информация о заказе

**Пример запроса:**
```bash
curl -X POST "https://plazma-production.up.railway.app/api/external/orders" \
  -H "X-API-Key: ваш-api-ключ" \
  -H "Content-Type: application/json" \
  -d '{
    "contact": "+79991234567",
    "items": [
      {
        "productId": "product-id-1",
        "quantity": 2
      },
      {
        "productId": "product-id-2",
        "quantity": 1,
        "price": 1.5
      }
    ],
    "message": "Заказ через внешний сервис"
  }'
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "orderId": "order-id",
    "status": "NEW",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "items": [
      {
        "productId": "product-id-1",
        "title": "Название товара 1",
        "price": 1.2,
        "quantity": 2,
        "originalPrice": 1.2,
        "discountApplied": false
      },
      {
        "productId": "product-id-2",
        "title": "Название товара 2",
        "price": 1.5,
        "quantity": 1,
        "originalPrice": 1.5,
        "discountApplied": false
      }
    ],
    "total": 3.9
  }
}
```

## Формат цен

- `price` - цена в PZ (Plazma Points)
- `priceRub` - цена в рублях (PZ × 100)

Например: 1.2 PZ = 120 RUB

## Обработка ошибок

Все ошибки возвращаются в формате:

```json
{
  "success": false,
  "error": "Описание ошибки"
}
```

**Коды статусов:**
- `200` - успешный запрос
- `201` - ресурс создан (для POST /orders)
- `400` - ошибка валидации
- `401` - неверный или отсутствующий API ключ
- `404` - ресурс не найден
- `500` - внутренняя ошибка сервера

## Примеры использования

### JavaScript/TypeScript

```typescript
const API_KEY = 'ваш-api-ключ';
const BASE_URL = 'https://plazma-production.up.railway.app/api/external';

// Получить каталог
async function getCatalog(region = 'RUSSIA') {
  const response = await fetch(`${BASE_URL}/catalog?region=${region}`, {
    headers: {
      'X-API-Key': API_KEY
    }
  });
  return response.json();
}

// Получить товары категории
async function getProductsByCategory(categoryId: string) {
  const response = await fetch(`${BASE_URL}/products?categoryId=${categoryId}`, {
    headers: {
      'X-API-Key': API_KEY
    }
  });
  return response.json();
}

// Создать заказ
async function createOrder(contact: string, items: Array<{productId: string, quantity: number}>) {
  const response = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contact,
      items
    })
  });
  return response.json();
}
```

### Python

```python
import requests

API_KEY = 'ваш-api-ключ'
BASE_URL = 'https://plazma-production.up.railway.app/api/external'

headers = {'X-API-Key': API_KEY}

# Получить каталог
def get_catalog(region='RUSSIA'):
    response = requests.get(f'{BASE_URL}/catalog', 
                           params={'region': region}, 
                           headers=headers)
    return response.json()

# Создать заказ
def create_order(contact, items):
    response = requests.post(f'{BASE_URL}/orders',
                            json={'contact': contact, 'items': items},
                            headers=headers)
    return response.json()
```

## Настройка

Для работы API необходимо установить переменную окружения:

```bash
EXTERNAL_API_KEY=ваш-секретный-ключ
```

Рекомендуется использовать длинный случайный ключ (минимум 32 символа).

## Ограничения

- Максимальное количество товаров в одном запросе: 1000
- Все запросы должны содержать валидный API ключ
- Товары фильтруются по региону (RUSSIA/BALI) и активности
- Заказы создаются со статусом "NEW" и требуют обработки администратором

