# Модуль управления товарами

Полностью переписанный с нуля модуль для управления товарами в админ-панели.

## Структура модуля

```
products/
├── index.ts         # Главный файл экспорта модуля
├── utils.ts         # Утилиты (escapeAttr, validate, и т.д.)
├── services.ts      # Бизнес-логика (CRUD операции)
├── handlers.ts      # Обработчики HTTP запросов
├── routes.ts        # Определение маршрутов
├── templates.ts     # HTML шаблоны
├── styles.ts        # CSS стили
├── scripts.ts       # JavaScript код
└── README.md        # Документация
```

## Функциональность

- ✅ Просмотр всех товаров с фильтрацией по категориям
- ✅ Создание нового товара
- ✅ Редактирование товара
- ✅ Удаление товара
- ✅ Переключение статуса активности
- ✅ Загрузка и выбор изображений
- ✅ Управление инструкциями
- ✅ API для получения списка товаров

## Маршруты

- `GET /admin/products` - Страница управления товарами
- `POST /admin/api/products` - Создание товара
- `POST /admin/products/:id/update` - Обновление товара
- `POST /admin/products/:id/delete` - Удаление товара
- `POST /admin/products/:id/toggle-active` - Переключение статуса
- `POST /admin/products/:id/upload-image` - Загрузка изображения
- `GET /admin/api/products/images` - Получение всех изображений
- `POST /admin/api/products/:id/select-image` - Выбор изображения
- `POST /admin/products/:id/save-instruction` - Сохранение инструкции
- `POST /admin/products/:id/delete-instruction` - Удаление инструкции

## Использование

```typescript
import { setupProductsRoutes } from './products/routes';

// Подключение к роутеру
setupProductsRoutes(router, requireAdmin, upload);
```










