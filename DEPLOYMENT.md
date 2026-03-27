# Руководство по развертыванию Plazma Bot

## 🚀 Развертывание на Railway

### 1. Подготовка

1. **Создайте аккаунт на [Railway](https://railway.app/)**
2. **Подключите GitHub репозиторий**
3. **Создайте PostgreSQL базу данных**

### 2. Настройка переменных окружения

В Railway Dashboard добавьте следующие переменные:

```env
# Telegram Bot
BOT_TOKEN=your_bot_token_from_botfather
BOT_WEBHOOK_URL=https://your-app.railway.app/bot/webhook
BOT_WEBHOOK_SECRET=your_random_secret_string

# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Admin Panel
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_secure_password

# Public URL
PUBLIC_BASE_URL=https://your-app.railway.app

# Notifications
ADMIN_CHAT_ID=your_telegram_chat_id
```

### 3. Настройка базы данных

После создания базы данных на Railway:

```bash
# Подключитесь к Railway CLI
railway login

# Выберите проект
railway link

# Запустите миграции
railway run npx prisma migrate deploy
```

### 4. Настройка Telegram Bot

1. **Создайте бота через [@BotFather](https://t.me/BotFather)**
2. **Получите токен бота**
3. **Настройте команды бота:**

```
start - 🚀 Запустить бота
shop - 🛍 Магазин
cart - 🛒 Корзина
partner - 🤝 Партнерская программа
reviews - ⭐ Отзывы
about - ℹ️ О проекте
```

4. **Настройте webhook:**
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-app.railway.app/bot/webhook"}'
```

## 🐳 Развертывание с Docker

### 1. Создание Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Копируем package files
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Собираем проект
RUN npm run build

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]
```

### 2. Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/plazma
      - BOT_TOKEN=${BOT_TOKEN}
      - BOT_WEBHOOK_URL=${BOT_WEBHOOK_URL}
      - BOT_WEBHOOK_SECRET=${BOT_WEBHOOK_SECRET}
      - ADMIN_EMAIL=${ADMIN_EMAIL}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - PUBLIC_BASE_URL=${PUBLIC_BASE_URL}
      - ADMIN_CHAT_ID=${ADMIN_CHAT_ID}
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=plazma
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### 3. Запуск

```bash
docker-compose up -d
```

## 🌐 Развертывание на VPS

### 1. Подготовка сервера

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Устанавливаем PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Устанавливаем PM2
sudo npm install -g pm2

# Устанавливаем Nginx
sudo apt install nginx -y
```

### 2. Настройка базы данных

```bash
# Создаем пользователя и базу данных
sudo -u postgres psql
CREATE USER plazma_user WITH PASSWORD 'secure_password';
CREATE DATABASE plazma_bot;
GRANT ALL PRIVILEGES ON DATABASE plazma_bot TO plazma_user;
\q
```

### 3. Настройка Nginx

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Настройка SSL с Let's Encrypt

```bash
# Устанавливаем Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получаем сертификат
sudo certbot --nginx -d yourdomain.com
```

### 5. Запуск приложения

```bash
# Клонируем репозиторий
git clone https://github.com/arctur-dev/plazma.git
cd plazma

# Устанавливаем зависимости
npm install

# Собираем проект
npm run build

# Запускаем с PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 📊 Мониторинг

### 1. Логи приложения

```bash
# Просмотр логов PM2
pm2 logs

# Просмотр логов Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 2. Мониторинг ресурсов

```bash
# Статус PM2
pm2 status

# Мониторинг системы
htop
df -h
```

### 3. Резервное копирование

```bash
# Бэкап базы данных
pg_dump -h localhost -U plazma_user plazma_bot > backup_$(date +%Y%m%d).sql

# Автоматический бэкап (crontab)
0 2 * * * pg_dump -h localhost -U plazma_user plazma_bot > /backups/backup_$(date +\%Y\%m\%d).sql
```

## 🔧 Конфигурация ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'plazma-bot',
    script: 'dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

## 🚨 Безопасность

### 1. Firewall

```bash
# Настраиваем UFW
sudo ufw enable
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw deny 3000   # Блокируем прямой доступ к приложению
```

### 2. Обновления

```bash
# Автоматические обновления безопасности
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 3. Мониторинг безопасности

```bash
# Устанавливаем fail2ban
sudo apt install fail2ban -y

# Настраиваем fail2ban для SSH
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

## 📈 Масштабирование

### 1. Горизонтальное масштабирование

- Используйте Redis для сессий
- Настройте load balancer
- Разделите базу данных на read/write реплики

### 2. Вертикальное масштабирование

- Увеличьте RAM сервера
- Добавьте больше CPU ядер
- Оптимизируйте запросы к базе данных

## 🔍 Troubleshooting

### Частые проблемы

1. **Бот не отвечает**
   - Проверьте токен бота
   - Проверьте webhook URL
   - Проверьте логи приложения

2. **Ошибки базы данных**
   - Проверьте DATABASE_URL
   - Запустите миграции: `npx prisma migrate deploy`
   - Проверьте подключение к БД

3. **Проблемы с SSL**
   - Проверьте сертификат
   - Обновите конфигурацию Nginx
   - Проверьте DNS записи

### Полезные команды

```bash
# Проверка статуса сервисов
sudo systemctl status nginx
sudo systemctl status postgresql
pm2 status

# Перезапуск сервисов
sudo systemctl restart nginx
sudo systemctl restart postgresql
pm2 restart plazma-bot

# Проверка портов
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443
```

---

**Удачного развертывания! 🚀**
