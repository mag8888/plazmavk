# План рефакторинга модуля товаров

## Статус

✅ **Создано:**
- `utils.ts` - утилиты (escapeAttr, validate, sanitize)
- `services.ts` - бизнес-логика (CRUD операции)
- `index.ts` - главный экспорт
- `README.md` - документация

⏳ **В процессе:**
- `routes.ts` - подключение маршрутов
- `handlers.ts` - обработчики запросов
- `templates.ts` - HTML шаблоны
- `styles.ts` - CSS (уже есть в products-styles.ts)
- `scripts.ts` - JavaScript код

## Следующие шаги

1. Перенести стили из `products-styles.ts` в `products/styles.ts`
2. Создать шаблоны HTML в `products/templates.ts`
3. Создать JavaScript код в `products/scripts.ts`
4. Создать обработчики в `products/handlers.ts`
5. Создать маршруты в `products/routes.ts`
6. Подключить модуль к `web.ts`

## Примечание

Из-за большого размера файла web.ts (12000+ строк), модуль создается постепенно. Все функции будут перенесены из web.ts в новые модульные файлы для улучшения поддерживаемости кода.










