# Архитектура Telegram Web App

## Общая схема

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Bot                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Основной бот (существующий)                       │   │
│  │  - Магазин                                        │   │
│  │  - Партнёрка                                      │   │
│  │  - Отзывы                                         │   │
│  │  - О PLASMA                                       │   │
│  │  - Поддержка                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Telegram Web App                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Frontend (HTML/CSS/JS)                            │   │
│  │  - Темная тема                                     │   │
│  │  - Wireframe дизайн                                │   │
│  │  - Адаптивная сетка                                │   │
│  │  - Telegram Web App API                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                │                           │
│                                ▼                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Backend API (/webapp/api/*)                       │   │
│  │  - Аутентификация через Telegram                   │   │
│  │  - RESTful endpoints                               │   │
│  │  - Интеграция с существующими сервисами            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    База данных                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PostgreSQL + Prisma                               │   │
│  │  - Пользователи                                    │   │
│  │  - Товары и категории                              │   │
│  │  - Корзина                                        │   │
│  │  - Заказы                                         │   │
│  │  - Партнёры                                       │   │
│  │  - Отзывы                                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Компоненты системы

### 1. Frontend (webapp/)
```
webapp/
├── index.html          # Главная страница приложения
├── styles.css          # CSS в стиле wireframe
└── app.js             # JavaScript логика
```

**Особенности:**
- Темная тема (#1a1a1a фон)
- Wireframe иконки с синим свечением
- Адаптивная сетка 2x3
- Telegram Web App API интеграция
- Плавные анимации и переходы

### 2. Backend API (src/webapp/)
```
src/webapp/
└── webapp.ts          # Express.js роутер
```

**Endpoints:**
- `GET /webapp/api/user/profile` - профиль пользователя
- `GET /webapp/api/categories` - категории товаров
- `GET /webapp/api/categories/:id/products` - товары категории
- `GET /webapp/api/cart/items` - корзина
- `POST /webapp/api/cart/add` - добавить в корзину
- `POST /webapp/api/orders/create` - создать заказ
- `GET /webapp/api/reviews` - отзывы
- `POST /webapp/api/partner/activate` - активировать партнёрку
- `GET /webapp/api/partner/dashboard` - личный кабинет
- `GET /webapp/api/audio/files` - аудиофайлы

### 3. Интеграция с основным ботом
```
src/server.ts          # Добавлен webappRouter
src/modules/           # Существующие модули бота
src/services/          # Существующие сервисы
```

**Переиспользование:**
- Все сервисы (shop-service, partner-service, etc.)
- База данных и Prisma схема
- Система пользователей
- Логика партнёрской программы

## Поток данных

### 1. Аутентификация
```
Telegram Web App → X-Telegram-Init-Data → extractTelegramUser → req.telegramUser
```

### 2. Загрузка данных
```
Frontend → API Request → Backend Service → Database → Response
```

### 3. Пользовательские действия
```
User Action → Frontend Handler → API Call → Service Logic → Database Update → Response
```

## Безопасность

### 1. CORS
```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Telegram-Init-Data');
});
```

### 2. Аутентификация
- Telegram Web App init data
- Валидация пользователя в каждом запросе
- Защита от CSRF атак

### 3. Валидация данных
- Проверка всех входящих параметров
- Типизация с TypeScript
- Обработка ошибок

## Развертывание

### 1. Сборка
```bash
npm run build
```

### 2. Запуск
```bash
npm start
```

### 3. Настройка
```bash
npm run setup-webapp
```

### 4. Доступ
```
https://your-domain.com/webapp
```

## Мониторинг

### 1. Health Check
```
GET /webapp/api/health
```

### 2. Логирование
- Все API запросы
- Ошибки и исключения
- Действия пользователей

### 3. Метрики
- Время ответа API
- Количество пользователей
- Популярные разделы

## Масштабирование

### 1. Горизонтальное
- Несколько инстансов сервера
- Load balancer
- Общая база данных

### 2. Вертикальное
- Увеличение ресурсов сервера
- Оптимизация запросов к БД
- Кэширование

### 3. Кэширование
- Redis для сессий
- Кэш категорий и товаров
- CDN для статических файлов
