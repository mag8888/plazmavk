# Telegram Bot + MongoDB Integration

## 🎯 Цель
Интегрировать Telegram бота с MongoDB для единой системы авторизации и управления пользователями.

## 🏗️ Архитектура

### База данных MongoDB
- **Database**: `em_bot` (как настроено в Railway)
- **Collections**:
  - `users` - пользователи (общие для бота и игры)
  - `transactions` - транзакции
  - `referrals` - реферальная система
  - `rooms` - игровые комнаты (из основного приложения)

### Переменные окружения
```bash
MONGODB_URI=mongodb+srv://xqrmedia_db_user:9URUHWBY91UQPOsj@cluster0.wVumcaj.mongodb.net/energy_money_game?retryWrites=true&w=majority&appName=Cluster0
MONGODB_DB_NAME=em_bot
BOT_TOKEN=your_bot_token
JWT_SECRET=em1-production-secret-key-2024-railway
```

## 🔧 Настройка

### 1. Установка зависимостей
```bash
cd telegram-bot
npm install
```

### 2. Настройка переменных окружения
В Railway Dashboard добавьте:
- `MONGODB_URI` - строка подключения к MongoDB
- `MONGODB_DB_NAME` - название базы данных (em_bot)
- `JWT_SECRET` - секретный ключ для JWT (должен совпадать с основным приложением)

### 3. Запуск бота
```bash
npm start
```

## 📡 API Endpoints

### Авторизация через Telegram
```http
POST /api/auth/telegram
Content-Type: application/json

{
  "telegramId": 123456789,
  "username": "username",
  "firstName": "Имя",
  "lastName": "Фамилия"
}
```

**Ответ:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "telegramId": 123456789,
    "username": "username",
    "firstName": "Имя",
    "lastName": "Фамилия",
    "balance": 0,
    "referralCode": "EM123456789ABCD",
    "isMaster": false,
    "gameUserId": null
  }
}
```

### Получение информации о пользователе
```http
GET /api/auth/me
Authorization: Bearer jwt_token_here
```

### Связывание с игровым аккаунтом
```http
POST /api/auth/link-game
Content-Type: application/json

{
  "telegramId": 123456789,
  "gameUserId": "game_user_id"
}
```

### Статистика пользователя
```http
GET /api/auth/stats/123456789
```

## 🔄 Интеграция с основным приложением

### 1. Обновление основного сервера
Добавьте в `server.js` поддержку авторизации через Telegram:

```javascript
// Middleware для проверки Telegram токенов
const verifyTelegramToken = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type === 'telegram') {
            req.telegramUser = decoded;
        }
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};
```

### 2. Синхронизация пользователей
Создайте функцию для синхронизации пользователей между ботом и игрой:

```javascript
const syncTelegramUser = async (telegramId, gameUserId) => {
    try {
        // Обновляем пользователя в MongoDB
        await db.updateUserGameId(telegramId, gameUserId);
        
        // Создаем пользователя в основном приложении
        const user = await db.getUserByTelegramId(telegramId);
        if (user) {
            // Добавляем в локальную базу пользователей
            users.set(user._id.toString(), {
                id: user._id.toString(),
                email: user.username,
                username: user.username,
                telegramId: user.telegramId,
                balance: user.balance
            });
        }
    } catch (error) {
        console.error('Error syncing Telegram user:', error);
    }
};
```

## 🎮 Логин через бота

### 1. В Telegram боте
Добавьте кнопку "Войти в игру":

```javascript
// В handlers.js
const showGameLogin = async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    // Создаем JWT токен
    const token = jwt.sign(
        { 
            userId: user._id.toString(),
            telegramId: user.telegramId,
            username: user.username,
            type: 'telegram'
        },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
    
    // Создаем ссылку для входа в игру
    const gameUrl = `${config.GAME_SERVER_URL}/auth/telegram?token=${token}`;
    
    const keyboard = {
        inline_keyboard: [[
            { text: '🎮 Войти в игру', url: gameUrl }
        ]]
    };
    
    bot.sendMessage(chatId, 'Нажмите кнопку ниже, чтобы войти в игру:', {
        reply_markup: keyboard
    });
};
```

### 2. В основном приложении
Добавьте endpoint для авторизации через Telegram:

```javascript
// В server.js
app.get('/auth/telegram', async (req, res) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.redirect('/login?error=no_token');
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.type !== 'telegram') {
            return res.redirect('/login?error=invalid_token');
        }
        
        // Синхронизируем пользователя
        await syncTelegramUser(decoded.telegramId, decoded.userId);
        
        // Устанавливаем сессию
        req.session.userId = decoded.userId;
        req.session.telegramId = decoded.telegramId;
        
        res.redirect('/game');
        
    } catch (error) {
        console.error('Telegram auth error:', error);
        res.redirect('/login?error=auth_failed');
    }
});
```

## 📊 Мониторинг

### Логи бота
```bash
# Проверка подключения к MongoDB
✅ Bot connected to MongoDB Atlas

# Создание пользователя
✅ New user created via Telegram: 123456789

# Синхронизация с игрой
✅ User synced with game: 123456789
```

### Логи основного приложения
```bash
# Загрузка пользователей из MongoDB
✅ Loaded X users from MongoDB

# Синхронизация Telegram пользователей
✅ Telegram user synced: 123456789
```

## 🔒 Безопасность

### JWT токены
- Используйте одинаковый `JWT_SECRET` для бота и основного приложения
- Токены действительны 30 дней
- Включают тип авторизации (`telegram`)

### Валидация
- Проверяйте `telegramId` на уникальность
- Валидируйте JWT токены на каждом запросе
- Логируйте все попытки авторизации

## 🚀 Деплой

### 1. Обновление бота
```bash
cd telegram-bot
git add .
git commit -m "Add MongoDB integration for Telegram bot"
git push origin main
```

### 2. Обновление основного приложения
```bash
git add .
git commit -m "Add Telegram bot integration with MongoDB"
git push origin main
```

### 3. Проверка в Railway
- Убедитесь, что переменные окружения настроены
- Проверьте логи на ошибки подключения к MongoDB
- Протестируйте авторизацию через бота

## ✅ Результат

После настройки:
- ✅ Единая база данных для бота и игры
- ✅ Авторизация через Telegram
- ✅ Синхронизация пользователей
- ✅ Реферальная система
- ✅ Транзакции и баланс
- ✅ Мастерская система

---

**Готово!** Теперь пользователи могут входить в игру через Telegram бота! 🎉
