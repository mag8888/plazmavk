# 🔄 Рефакторинг на Mongoose - Статус

## ✅ Выполнено

1. ✅ Установлен Mongoose и зависимости
2. ✅ Созданы Mongoose модели:
   - User, Category, Product, CartItem
   - Review, UserHistory
   - PartnerProfile, PartnerReferral, PartnerTransaction
   - OrderRequest, Payment, BotContent, AudioFile
3. ✅ Создан Mongoose connection (`src/lib/mongoose.ts`)
4. ✅ Рефакторинг сервисов:
   - `user-history.ts` - полностью переписан на Mongoose
   - `cart-service.ts` - полностью переписан на Mongoose
   - `review-service.ts` - полностью переписан на Mongoose
   - `shop-service.ts` - полностью переписан на Mongoose
   - `partner-service.ts` - полностью переписан на Mongoose
   - `bot-content-service.ts` - полностью переписан на Mongoose
5. ✅ Обновлен `bootstrap.ts` для использования Mongoose
6. ✅ Обновлен `server.ts` для использования Mongoose вместо Prisma

## ⚠️ Осталось исправить

### 1. Ошибки компиляции в моделях
- Исправить типы ObjectId в моделях (CartItem, AudioFile, BotContent)
- Использовать `_id` вместо `id` в интерфейсах

### 2. Обновить модули бота
- `src/modules/shop/index.ts` - заменить Prisma на Mongoose
- `src/modules/cart/index.ts` - заменить Prisma на Mongoose
- `src/modules/partner/index.ts` - заменить Prisma на Mongoose
- `src/modules/payment/index.ts` - заменить Prisma на Mongoose
- `src/modules/navigation/index.ts` - заменить Prisma на Mongoose

### 3. Обновить API и Webapp
- `src/api/external.ts` - заменить `.id` на `._id` и Prisma на Mongoose
- `src/webapp/webapp.ts` - заменить Prisma на Mongoose

### 4. Обновить Admin панель
- `src/admin/web.ts` - заменить Prisma на Mongoose (или использовать AdminJS с Mongoose)

### 5. Удалить Prisma
- Удалить `prisma/schema.prisma`
- Удалить `src/lib/prisma.ts`
- Удалить зависимости `@prisma/client` и `prisma` из `package.json`

## 📝 Важные изменения

### Использование `_id` вместо `id`
Mongoose использует `_id` как идентификатор документа. Везде, где использовался `id`, нужно заменить на `_id` или добавить виртуальное поле:

```typescript
// В моделях можно добавить виртуальное поле id
schema.virtual('id').get(function() {
  return this._id.toHexString();
});

schema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});
```

### ObjectId в запросах
Mongoose автоматически конвертирует строки в ObjectId, поэтому не нужно явно создавать `new mongoose.Types.ObjectId()`:

```typescript
// Вместо:
await Model.find({ userId: new mongoose.Types.ObjectId(userId) });

// Можно просто:
await Model.find({ userId: userId });
```

## 🚀 Следующие шаги

1. Исправить ошибки компиляции в моделях
2. Обновить все модули бота
3. Обновить API и Webapp
4. Обновить Admin панель
5. Протестировать на Railway
6. Удалить Prisma зависимости

## 📚 Полезные ссылки

- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [Mongoose Types](https://mongoosejs.com/docs/typescript.html)
