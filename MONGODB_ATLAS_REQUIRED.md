# ⚠️ Важно: Prisma требует MongoDB Atlas (replica set)

## 🔴 Проблема

В логах видны ошибки:
```
Prisma needs to perform transactions, which requires your MongoDB server to be run as a replica set
Invalid `prisma.user.update()` invocation
```

**Причина:** Prisma требует replica set для операций `update()` и `create()`, даже если мы не используем транзакции явно. Railway MongoDB **не поддерживает replica set** по умолчанию.

## ✅ Решение: Использовать MongoDB Atlas

MongoDB Atlas бесплатный tier (M0) **поддерживает replica set** и полностью совместим с Prisma.

## 🚀 Быстрая настройка MongoDB Atlas (5 минут)

### Шаг 1: Создайте кластер в MongoDB Atlas

1. Перейдите на https://www.mongodb.com/cloud/atlas
2. Войдите или создайте бесплатный аккаунт
3. Нажмите **"Build a Database"**
4. Выберите **"M0 FREE"** (бесплатный tier)
5. Выберите регион (ближайший к Railway)
6. Нажмите **"Create"**
7. Подождите 1-3 минуты до создания кластера

### Шаг 2: Настройте Network Access

1. В левом меню выберите **"Network Access"**
2. Нажмите **"Add IP Address"**
3. Выберите **"Allow Access from Anywhere"** (`0.0.0.0/0`)
   - Или добавьте IP Railway (можно найти в логах Railway)
4. Нажмите **"Confirm"**

### Шаг 3: Создайте пользователя базы данных

1. В левом меню выберите **"Database Access"**
2. Нажмите **"Add New Database User"**
3. Выберите **"Password"** как метод аутентификации
4. Введите:
   - **Username:** `plazma_bot` (или любое другое)
   - **Password:** Сгенерируйте надежный пароль (сохраните его!)
   - **Database User Privileges:** `Atlas admin` (или `Read and write to any database`)
5. Нажмите **"Add User"**

### Шаг 4: Получите connection string

1. В левом меню выберите **"Database"**
2. Нажмите **"Connect"** на вашем кластере
3. Выберите **"Connect your application"**
4. Выберите **"Node.js"** и версию **"5.5 or later"**
5. Скопируйте connection string:
   ```
   mongodb+srv://plazma_bot:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Замените `<password>` на ваш пароль
7. Добавьте имя базы данных перед `?`:
   ```
   mongodb+srv://plazma_bot:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/plazma_bot?retryWrites=true&w=majority
   ```

### Шаг 5: Настройте DATABASE_URL на Railway

1. Откройте [Railway Dashboard](https://railway.app)
2. Выберите проект `plazma-production`
3. Откройте сервис **plazma** → **Settings** → **Variables**
4. Найдите или создайте переменную `DATABASE_URL`
5. Вставьте connection string из шага 4
6. Сохраните

**Важно:** Убедитесь, что пароль URL-encoded (специальные символы заменены на %XX):
- `@` → `%40`
- `#` → `%23`
- `%` → `%25`
- и т.д.

### Шаг 6: Перезапустите сервис

1. Railway автоматически перезапустит при изменении переменных
2. Или вручную: **Deployments** → **Redeploy**

### Шаг 7: Проверьте логи

После перезапуска должно быть:
```
⚠️  MongoDB Atlas detected (consider switching to Railway MongoDB)
Database URL configured: mongodb+srv://...
Database connected
```

**НЕ должно быть:**
- ❌ `Prisma needs to perform transactions, which requires your MongoDB server to be run as a replica set`
- ❌ `Invalid prisma.user.update() invocation`

## 📊 Восстановление данных

После переключения на Atlas восстановите данные из бэкапа:

```bash
# Через Railway CLI
railway link
railway run npm run restore
```

Или через Railway Dashboard:
1. Откройте сервис → **Deployments**
2. Откройте терминал (если доступен)
3. Выполните: `npm run restore`

## 🔄 Альтернатива: Настроить Railway MongoDB как replica set

**Внимание:** Это сложно и может не работать на Railway.

Если вы хотите использовать Railway MongoDB, нужно настроить его как replica set. Это требует:
1. Доступ к конфигурации MongoDB
2. Настройку replica set вручную
3. Возможные проблемы с Railway managed MongoDB

**Рекомендация:** Используйте MongoDB Atlas - это проще и надежнее.

## ✅ Преимущества MongoDB Atlas

- ✅ Поддерживает replica set (требуется Prisma)
- ✅ Бесплатный tier (M0) достаточен для большинства проектов
- ✅ Автоматические бэкапы
- ✅ Мониторинг и алерты
- ✅ Простая настройка
- ✅ Надежная инфраструктура

## 📚 Дополнительная информация

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Prisma MongoDB Setup](https://www.prisma.io/docs/concepts/database-connectors/mongodb)
- [Prisma Replica Set Requirements](https://www.prisma.io/docs/concepts/database-connectors/mongodb#replica-set-requirement)
