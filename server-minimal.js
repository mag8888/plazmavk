/**
 * EM1 Game Board v2.0 - Minimal Server for Railway
 * Упрощенный сервер для стабильного развертывания
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/game-board', express.static(path.join(__dirname, 'game-board')));

// In-memory storage for minimal functionality
const users = new Map();
const rooms = new Map();

// Health Check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'EM1 Game Board v2.0',
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        database: 'Memory',
        rooms: rooms.size,
        users: users.size
    });
});

// API Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'EM1 Game Board v2.0',
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        database: 'Memory',
        rooms: rooms.size,
        users: users.size
    });
});

// Registration API endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        console.log('📝 Registration request received:', req.body);
        const { username, email, password, confirmPassword } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Пароли не совпадают' });
        }

        // Check if user exists
        for (let user of users.values()) {
            if (user.email === email) {
                return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const userId = Date.now().toString();
        const newUser = {
            id: userId,
            username,
            email,
            password: hashedPassword,
            createdAt: new Date(),
            isActive: true
        };

        users.set(userId, newUser);
        console.log('✅ User created successfully:', newUser.username);

        // Generate JWT token
        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Пользователь успешно зарегистрирован',
            token,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email
            }
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
});

// Login API endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        // Find user
        let user = null;
        for (let u of users.values()) {
            if (u.email === email) {
                user = u;
                break;
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Успешный вход',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
});

// Profile API endpoint
app.get('/api/user/profile/:username', (req, res) => {
    try {
        const { username } = req.params;

        // Find user by username
        let user = null;
        for (let u of users.values()) {
            if (u.username === username) {
                user = u;
                break;
            }
        }

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            isActive: user.isActive
        });

    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({ error: 'Ошибка сервера при получении профиля' });
    }
});

// Profile page route
app.get('/game/u/:username', (req, res) => {
    res.sendFile(path.join(__dirname, 'game-board', 'profile.html'));
});

// Main routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/auth.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth.html'));
});

// Catch-all route
app.get('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'Страница не найдена',
        requested: req.path,
        availableRoutes: [
            '/',
            '/auth.html',
            '/game/u/:username',
            '/health',
            '/api/health',
            '/api/auth/register',
            '/api/auth/login',
            '/api/user/profile/:username'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🎮 EM1 Game Board v2.0 Minimal Server запущен!');
    console.log(`🚀 Сервер работает на порту ${PORT}`);
    console.log(`📱 Локальный адрес: http://localhost:${PORT}`);
    console.log(`🌐 Railway адрес: https://em1-production.up.railway.app`);
    console.log('✅ Готов к обслуживанию файлов');
    console.log('💾 Используется in-memory хранилище');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Получен сигнал SIGTERM, завершение работы...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Получен сигнал SIGINT, завершение работы...');
    process.exit(0);
});
