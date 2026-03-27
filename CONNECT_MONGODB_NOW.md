# 🚀 Подключитесь к MongoDB прямо сейчас

## ✅ У вас есть переменные MongoDB!

Я вижу ваши переменные:
- Host: `mongodb.railway.internal`
- Port: `27017`
- User: `mongo`
- Password: `pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp`

## 🔧 Способ 1: Установите mongosh локально и подключитесь

### Шаг 1: Установите mongosh

```bash
brew install mongosh
```

### Шаг 2: Подключитесь к MongoDB

```bash
mongosh "mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@mongodb.railway.internal:27017/plazma_bot?authSource=admin"
```

**Или используйте переменные:**

```bash
mongosh "mongodb://$MONGOUSER:$MONGOPASSWORD@$MONGOHOST:$MONGOPORT/plazma_bot?authSource=admin"
```

## 🔧 Способ 2: Попробуйте альтернативные команды в Railway

```bash
railway run mongo
```

или

```bash
railway run /usr/bin/mongo
```

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

Должно показать:
```json
{
  "set": "rs0",
  "myState": 1,
  "members": [
    {
      "_id": 0,
      "name": "localhost:27017",
      "stateStr": "PRIMARY"
    }
  ]
}
```

## ✅ Готово!

После настройки replica set обновите `DATABASE_URL` на Railway (добавьте `replicaSet=rs0`).
