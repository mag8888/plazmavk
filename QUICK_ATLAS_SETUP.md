# ⚡ Быстрая настройка MongoDB Atlas на Railway (5 минут)

## 🚀 Быстрые шаги

### 1. Создайте кластер в Atlas (2 мин)
- https://www.mongodb.com/cloud/atlas
- **Build a Database** → **M0 FREE** → **Create**
- Подождите 1-3 минуты

### 2. Настройте доступ (1 мин)
- **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)
- **Database Access** → **Add New Database User**
  - Username: `plazma_bot`
  - Password: Сгенерируйте и **сохраните!**
  - Privileges: `Atlas admin`

### 3. Получите connection string (1 мин)
- **Database** → **Connect** → **Connect your application**
- Скопируйте строку:
  ```
  mongodb+srv://plazma_bot:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
  ```
- Замените `<password>` на ваш пароль
- Добавьте имя базы перед `?`:
  ```
  mongodb+srv://plazma_bot:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/plazma_bot?retryWrites=true&w=majority
  ```

### 4. Настройте на Railway (1 мин)
- Railway Dashboard → ваш проект → сервис **plazma**
- **Settings** → **Variables**
- Создайте/обновите `DATABASE_URL` с connection string из шага 3
- Сохраните

### 5. Перезапустите
- Railway автоматически перезапустит
- Или вручную: **Deployments** → **Redeploy**

## ✅ Проверка

В логах должно быть:
```
⚠️  MongoDB Atlas detected
Database connected
```

НЕ должно быть:
- ❌ `SCRAM failure`
- ❌ `replica set`
- ❌ `ConnectorError`

## 🆘 Если не работает

1. **Проверьте пароль** - должен быть URL-encoded (специальные символы → %XX)
2. **Проверьте Network Access** - должен быть `0.0.0.0/0`
3. **Проверьте имя базы** - должно быть `/plazma_bot` перед `?`

## 📚 Подробная инструкция

См. `RAILWAY_MONGODB_ATLAS_SETUP.md` для детальных шагов и решения проблем.
