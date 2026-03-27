# ⚡ Быстрая настройка Railway MongoDB без Atlas

## 🎯 Цель

Настроить Railway MongoDB как replica set для работы с Prisma.

## 🚀 Быстрые шаги (3 минуты)

### Шаг 1: Установите Railway CLI

```bash
npm i -g @railway/cli
```

### Шаг 2: Подключитесь к проекту

```bash
railway link
```

Выберите ваш проект `plazma-production`.

### Шаг 3: Настройте replica set

**Вариант A: Через MongoDB Shell (Рекомендуется)**

```bash
# Откройте MongoDB shell
railway run mongosh

# В MongoDB shell выполните:
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "localhost:27017" }
  ]
})

# Проверьте статус
rs.status()
```

**Вариант B: Через скрипт (если установлен mongodb driver)**

```bash
railway run npm run setup-replica-set
```

### Шаг 4: Обновите DATABASE_URL

1. Railway Dashboard → сервис **plazma** → **Settings** → **Variables**
2. Найдите `DATABASE_URL`
3. Добавьте параметр `replicaSet=rs0`:
   ```
   mongodb://mongo:password@host:port/plazma_bot?authSource=admin&replicaSet=rs0
   ```

### Шаг 5: Перезапустите сервис

Railway автоматически перезапустит при изменении переменных.

## ✅ Проверка

В логах должно быть:
```
Database connected
✅ Initial data ensured
```

НЕ должно быть:
- ❌ `Prisma needs to perform transactions, which requires your MongoDB server to be run as a replica set`
- ❌ `Invalid prisma.user.update() invocation`

## 🆘 Если не работает

1. **Проверьте, что replica set инициализирован:**
   ```bash
   railway run mongosh
   rs.status()
   ```

2. **Проверьте connection string:**
   - Должен содержать `replicaSet=rs0`
   - Должен содержать `authSource=admin`

3. **Попробуйте перезапустить MongoDB сервис:**
   - Railway Dashboard → MongoDB сервис → **Settings** → **Redeploy**

## 📚 Подробная инструкция

См. `RAILWAY_MONGODB_WITHOUT_ATLAS.md` для детальных шагов и решения проблем.

## 💡 Альтернатива

Если настройка replica set не работает, рассмотрите:
- Использование MongoDB Atlas (проще и надежнее)
- Замену Prisma на Mongoose (не требует replica set)
