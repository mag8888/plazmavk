# 🔧 Альтернативные способы подключения к MongoDB shell

## Проблема

`railway run mongosh` выдает ошибку "No such file or directory".

## ✅ Решения

### Вариант 1: Попробуйте `mongo` (старая версия)

```bash
railway run mongo
```

### Вариант 2: Попробуйте полный путь

```bash
railway run /usr/bin/mongosh
```

или

```bash
railway run /usr/local/bin/mongosh
```

### Вариант 3: Используйте локальный mongosh с connection string

1. **Получите MONGO_URL:**
   ```bash
   railway variables
   ```
   Найдите `MONGO_URL` или скопируйте из Railway Dashboard

2. **Установите mongosh локально (если еще не установлен):**
   ```bash
   brew install mongosh
   ```
   (для macOS)

3. **Подключитесь используя connection string:**
   ```bash
   mongosh "mongodb://mongo:password@host:port/plazma_bot?authSource=admin"
   ```
   
   Замените `password`, `host`, `port` на значения из `MONGO_URL`

### Вариант 4: Используйте Railway Dashboard

1. Откройте Railway Dashboard
2. Сервис **MongoDB** → **Database** → **Connect**
3. Скопируйте Connection String
4. Используйте его для подключения через локальный `mongosh`

### Вариант 5: Проверьте доступные команды в контейнере

```bash
railway run ls /usr/bin/ | grep mongo
```

или

```bash
railway run which mongosh
railway run which mongo
```

## 🎯 Рекомендуемый способ

**Вариант 3** - использовать локальный `mongosh` с connection string из Railway. Это самый надежный способ.

## 📝 После подключения

В MongoDB shell выполните:

```javascript
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "localhost:27017" }
  ]
})

// Подождите 5-10 секунд
rs.status()
```
