# 🗄️ MongoDB Setup - Game Board v2.0

## 📋 Обзор

Game Board v2.0 теперь поддерживает MongoDB для постоянного хранения данных. Система работает в гибридном режиме: если MongoDB недоступна, используется локальное хранилище.

## 🚀 Быстрый старт

### 1. **MongoDB Atlas (Рекомендуется)**

#### Создание кластера:
1. Перейдите на [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Создайте бесплатный аккаунт
3. Создайте новый кластер (бесплатный tier M0)
4. Настройте сетевой доступ (0.0.0.0/0 для разработки)
5. Создайте пользователя базы данных

#### Получение строки подключения:
```
mongodb+srv://<username>:<password>@cluster0.mongodb.net/gameboard?retryWrites=true&w=majority
```

### 2. **Локальная MongoDB**

#### Установка:
```bash
# macOS (с Homebrew)
brew install mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb

# Windows
# Скачайте с официального сайта MongoDB
```

#### Запуск:
```bash
# macOS/Linux
mongod --dbpath /usr/local/var/mongodb

# Windows
mongod.exe --dbpath C:\data\db
```

## 🔧 Конфигурация

### Переменные окружения:

Создайте файл `.env` в корне проекта:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/gameboard?retryWrites=true&w=majority
MONGODB_LOCAL_URI=mongodb://localhost:27017/gameboard

# Database Names
DB_NAME=gameboard
DB_COLLECTION_ROOMS=rooms
DB_COLLECTION_USERS=users
DB_COLLECTION_GAMES=games
DB_COLLECTION_PROFESSIONS=professions
DB_COLLECTION_BANK=bank_accounts
```

### Конфигурация подключения:

```javascript
// config/database.js
const DB_CONFIG = {
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_LOCAL_URI: process.env.MONGODB_LOCAL_URI,
    OPTIONS: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
    }
};
```

## 📊 Модели данных

### 1. **Room Model**
```javascript
{
    name: String,
    maxPlayers: Number,
    players: [{
        name: String,
        isHost: Boolean,
        isReady: Boolean
    }],
    status: String, // waiting, full, playing, finished
    hostId: String,
    gameSettings: Object,
    createdAt: Date,
    startedAt: Date
}
```

### 2. **User Model**
```javascript
{
    username: String,
    email: String,
    password: String,
    profile: Object,
    gameStats: Object,
    preferences: Object,
    status: {
        isOnline: Boolean,
        lastSeen: Date,
        currentRoom: ObjectId
    }
}
```

### 3. **Profession Model**
```javascript
{
    name: String,
    description: String,
    category: String,
    difficulty: String,
    startingFinancials: {
        income: Number,
        expenses: Number,
        cashflow: Number,
        startingBalance: Number
    },
    liabilities: [Object],
    paths: [Object]
}
```

### 4. **BankAccount Model**
```javascript
{
    userId: String,
    roomId: String,
    balance: Number,
    transactions: [{
        type: String,
        amount: Number,
        from: String,
        to: String,
        description: String,
        timestamp: Date
    }]
}
```

## 🔄 Гибридный режим

Система автоматически переключается между MongoDB и локальным хранилищем:

```javascript
// Инициализация
async function initializeDatabase() {
    try {
        await connectToDatabase();
        console.log('✅ Database connection established');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.log('🔄 Continuing with in-memory storage...');
    }
}
```

### Логика переключения:
1. **MongoDB доступна** → Используется база данных
2. **MongoDB недоступна** → Используется localStorage/in-memory
3. **Автоматическое восстановление** → При восстановлении подключения

## 🛠️ API Endpoints

### Room Management:
```javascript
// MongoDB операции
Room.findActiveRooms()
Room.findByPlayer(playerName)
Room.cleanupOldRooms()
```

### User Management:
```javascript
User.findOnlineUsers()
User.findTopPlayers(limit)
User.findByRoom(roomId)
```

### Profession Management:
```javascript
Profession.findByCategory(category)
Profession.findByDifficulty(difficulty)
Profession.getDefaultProfession()
```

### Bank Operations:
```javascript
BankAccount.findByUser(userId, roomId)
BankAccount.transferBetweenAccounts(from, to, roomId, amount)
BankAccount.getRoomBalances(roomId)
```

## 📈 Мониторинг

### Статус подключения:
```javascript
const status = getConnectionStatus();
console.log(status);
// {
//     isConnected: true,
//     readyState: 1,
//     host: 'cluster0.mongodb.net',
//     port: 27017,
//     name: 'gameboard'
// }
```

### Логи подключения:
```
✅ MongoDB connected successfully!
📊 Database: gameboard
🌐 Host: cluster0.mongodb.net
🔌 Port: 27017
✅ Default profession created
```

## 🔒 Безопасность

### Рекомендации:
1. **Используйте переменные окружения** для строк подключения
2. **Ограничьте сетевой доступ** в production
3. **Используйте аутентификацию** MongoDB
4. **Регулярно обновляйте** пароли
5. **Мониторьте подключения** и логи

### Production настройки:
```javascript
const OPTIONS = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    bufferMaxEntries: 0,
    bufferCommands: false,
    ssl: true,
    sslValidate: true
};
```

## 🚀 Развертывание

### Railway с MongoDB:
1. Добавьте переменную `MONGODB_URI` в настройки Railway
2. Убедитесь, что IP-адрес Railway добавлен в whitelist MongoDB Atlas
3. Перезапустите приложение

### Docker с MongoDB:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Производительность

### Индексы:
```javascript
// Room indexes
roomSchema.index({ status: 1, createdAt: -1 });
roomSchema.index({ hostId: 1 });
roomSchema.index({ 'players.name': 1 });

// User indexes
userSchema.index({ username: 1 });
userSchema.index({ 'status.isOnline': 1 });
userSchema.index({ 'gameStats.gamesPlayed': -1 });

// BankAccount indexes
bankAccountSchema.index({ userId: 1, roomId: 1 }, { unique: true });
bankAccountSchema.index({ 'transactions.timestamp': -1 });
```

### Оптимизация:
- Используйте соединения с пулом
- Настройте таймауты
- Регулярно очищайте старые данные
- Мониторьте производительность запросов

## ✅ Готовые функции

- ✅ MongoDB Atlas подключение
- ✅ Локальная MongoDB поддержка
- ✅ Гибридный режим работы
- ✅ Автоматическая инициализация данных
- ✅ Graceful shutdown
- ✅ Мониторинг подключения
- ✅ Полные модели данных
- ✅ API для всех операций

## 🔄 Следующие шаги

- [ ] Настроить MongoDB Atlas
- [ ] Добавить переменные окружения
- [ ] Протестировать подключение
- [ ] Настроить индексы для production
- [ ] Добавить мониторинг и алерты
