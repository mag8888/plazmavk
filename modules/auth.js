/**
 * Auth Module - микромодуль авторизации и профиля
 * Регистрирует все маршруты авторизации и профиля
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function registerAuthModule({ app, db, jwtSecret, roomState }) {
    if (!app || !db || !jwtSecret) {
        throw new Error('Auth module requires app, db, and jwtSecret parameters');
    }
    
    // Получаем функции для работы с пользователями в памяти
    const { addUserToMemory, getUserFromMemory, getUserByEmailFromMemory, updateUserInMemory } = roomState || {};

    // Генерация Refresh Token (для долгосрочной авторизации)
    function generateRefreshToken(userId, jwtSecret) {
        return jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' }); // Refresh token действует 7 дней
    }

    // Middleware для проверки JWT токена
    function authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        console.log(`🔍 Auth check: origin=${req.headers.origin}, authHeader=${authHeader ? 'present' : 'missing'}, token=${token ? 'present' : 'missing'}`);

        if (!token) {
            console.log('❌ No token provided');
            return res.status(401).json({ message: 'Токен доступа отсутствует' });
        }

        try {
            const payload = jwt.verify(token, jwtSecret);
            req.user = payload;
            return next();
        } catch (error) {
            console.error('JWT verification failed:', error.message, 'Token:', token.substring(0, 20) + '...');
            if (error.name === 'JsonWebTokenError') {
                return res.status(403).json({ message: 'Недействительный токен' });
            } else if (error.name === 'TokenExpiredError') {
                return res.status(403).json({ message: 'Токен истек' });
            } else {
                return res.status(403).json({ message: 'Ошибка проверки токена' });
            }
        }
    }

    // Функция для очистки данных пользователя
    function sanitizeUser(user) {
        if (!user) {
            return null;
        }
        const plain = typeof user.toObject === 'function' ? user.toObject() : user;
        return {
            id: plain._id ? plain._id.toString() : plain.id,
            telegram_id: plain.telegram_id || null,
            username: plain.username || '',
            first_name: plain.first_name || '',
            last_name: plain.last_name || '',
            email: plain.email || '',
            balance: plain.balance ?? 0,
            level: plain.level ?? 1,
            experience: plain.experience ?? 0,
            games_played: plain.games_played ?? 0,
            wins_count: plain.wins_count ?? 0,
            referrals_count: plain.referrals_count ?? 0,
            referral_code: plain.referral_code || null,
            referral_earnings: plain.referral_earnings ?? 0,
            is_active: plain.is_active ?? true,
            created_at: plain.created_at,
            updated_at: plain.updated_at
        };
    }

    // Регистрация пользователя (username обязателен)
    app.post('/api/auth/register', async (req, res) => {
        const { email, password, username, first_name, last_name, referral_code } = req.body || {};
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email и пароль обязательны' });
        }
        if (!username || String(username).trim().length < 3) {
            return res.status(400).json({ message: 'Имя пользователя (username) обязательно и должно быть не короче 3 символов' });
        }

        // Проверка уникальности username
        const existingByUsername = await db.getUserByUsername(username);
        if (existingByUsername) {
            return res.status(409).json({ message: 'Это имя пользователя уже занято' });
        }

        try {
            // Проверяем, существует ли пользователь
            const existingUser = await db.getUserByEmail(email);
            if (existingUser) {
                return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
            }

            // Хешируем пароль
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            // Создаем нового пользователя с хешем
            const newUser = await db.createUser({
                email,
                password: passwordHash,
                username: String(username).trim(),
                first_name: first_name || '',
                last_name: last_name || '',
                balance: 10000,
                level: 1,
                experience: 0,
                games_played: 0,
                wins_count: 0,
                referrals_count: 0,
                referral_earnings: 0,
                is_active: true
            });
            
            // Сохраняем пользователя в память
            if (addUserToMemory) {
                addUserToMemory(newUser);
            }

            // Генерируем JWT токен
            const accessToken = jwt.sign(
                { userId: newUser.id, email: newUser.email }, 
                jwtSecret, 
                { expiresIn: '24h' }
            );
            const refreshToken = generateRefreshToken(newUser.id, jwtSecret);

            res.status(201).json({
                message: 'Пользователь успешно зарегистрирован',
                accessToken,
                refreshToken,
                expiresIn: '24h',
                user: sanitizeUser(newUser)
            });

        } catch (error) {
            console.error('Ошибка регистрации:', error);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    });

    // Вход пользователя
    app.post('/api/auth/login', async (req, res) => {
        const { email, password, rememberMe } = req.body || {};
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email и пароль обязательны' });
        }

        try {
            console.log(`🔍 Попытка входа для email: ${email}`);
            
            // Сначала проверяем пользователя в памяти по email
            let user = getUserByEmailFromMemory ? getUserByEmailFromMemory(email) : null;
            console.log(`🔍 Поиск в памяти: ${user ? 'найден' : 'не найден'}`);
            
            // Если не найден в памяти, загружаем из базы данных
            if (!user) {
                console.log('🔍 Поиск в базе данных...');
                user = await db.getUserByEmail(email);
                if (user && addUserToMemory) {
                    console.log('💾 Сохраняем пользователя в память');
                    addUserToMemory(user);
                }
            }
            
            if (!user) {
                console.log('❌ Пользователь не найден ни в памяти, ни в базе данных');
                return res.status(401).json({ message: 'Пользователь не найден' });
            }
            
            console.log(`✅ Пользователь найден: ${user.email} (ID: ${user.id})`);

            // Проверяем пароль (учитываем legacy-пользователей с незахешированным паролем)
            const passwordsMatch = user.password && user.password.startsWith('$2')
                ? await bcrypt.compare(password, user.password)
                : user.password === password;
            if (!passwordsMatch) {
                return res.status(401).json({ message: 'Неверный пароль' });
            }

            // Проверяем активность аккаунта
            if (!user.is_active) {
                return res.status(401).json({ message: 'Аккаунт заблокирован' });
            }

            // Генерируем JWT токен
            const accessToken = jwt.sign(
                { userId: user.id, email: user.email }, 
                jwtSecret, 
                { expiresIn: '24h' }
            );
            const refreshToken = generateRefreshToken(user.id, jwtSecret);

            res.json({
                message: 'Успешный вход',
                accessToken,
                refreshToken,
                expiresIn: '24h',
                user: sanitizeUser(user)
            });

        } catch (error) {
            console.error('Ошибка авторизации:', error);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    });

    // Эндпоинт для обновления токена
    app.post('/api/auth/refresh-token', async (req, res) => {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh токен отсутствует' });
        }

        try {
            const payload = jwt.verify(refreshToken, jwtSecret);
            const userId = payload.userId;

            // Проверяем, существует ли пользователь
            let user = getUserFromMemory ? getUserFromMemory(userId) : null;
            if (!user) {
                user = await db.getUserById(userId);
                if (user && addUserToMemory) {
                    addUserToMemory(user);
                }
            }

            if (!user) {
                return res.status(401).json({ message: 'Пользователь не найден' });
            }

            // Генерируем новый Access Token
            const newAccessToken = jwt.sign(
                { userId: user.id, email: user.email },
                jwtSecret,
                { expiresIn: '24h' }
            );

            // Генерируем новый Refresh Token (для ротации)
            const newRefreshToken = generateRefreshToken(user.id, jwtSecret);

            res.json({
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresIn: '24h',
                message: 'Токены успешно обновлены'
            });

        } catch (error) {
            console.error('Refresh token verification failed:', error.message);
            if (error.name === 'JsonWebTokenError') {
                return res.status(403).json({ message: 'Недействительный refresh токен' });
            } else if (error.name === 'TokenExpiredError') {
                return res.status(403).json({ message: 'Refresh токен истек' });
            } else {
                return res.status(403).json({ message: 'Ошибка проверки refresh токена' });
            }
        }
    });

    // Получение профиля пользователя (при отсутствии username — автозаполнение из email)
    app.get('/api/user/profile', authenticateToken, async (req, res) => {
        try {
            // Сначала проверяем пользователя в памяти
            let user = getUserFromMemory ? getUserFromMemory(req.user.userId) : null;
            
            // Если не найден в памяти, загружаем из базы данных
            if (!user) {
                user = await db.getUserById(req.user.userId);
                if (user && addUserToMemory) {
                    addUserToMemory(user);
                }
            }
            
            if (!user) {
                return res.status(404).json({ message: 'Пользователь не найден' });
            }

            // Если у пользователя пустой username — создаем дефолтный и сохраняем
            if (!user.username || String(user.username).trim() === '') {
                const fallback = (user.email || 'user').split('@')[0];
                try {
                    const updated = await db.updateUser(user.id, { username: fallback });
                    if (updateUserInMemory && updated) {
                        updateUserInMemory(user.id, updated);
                        user = updated;
                    } else {
                        user.username = fallback;
                    }
                } catch (e) {
                    // Не блокируем ответ профиля, просто логируем
                    console.warn('Failed to backfill username for user:', user.id, e?.message);
                }
            }

            res.json(sanitizeUser(user));
        } catch (error) {
            console.error('Ошибка получения профиля:', error);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    });

    // Получение статистики пользователя
    app.get('/api/user/stats', authenticateToken, async (req, res) => {
        try {
            const user = await db.getUserById(req.user.userId);
            if (!user) {
                return res.status(404).json({ message: 'Пользователь не найден' });
            }
            
            res.json({
                games_played: user.games_played || 0,
                wins_count: user.wins_count || 0,
                level: user.level || 1,
                experience: user.experience || 0,
                balance: user.balance || 0
            });
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    });

    // Обновление профиля пользователя
    app.put('/api/user/profile', authenticateToken, async (req, res) => {
        try {
            const { username, first_name, last_name } = req.body || {};
            const userId = req.user.userId;

            // Если меняем username — проверяем уникальность
            if (username && String(username).trim().length >= 3) {
                const existing = await db.getUserByUsername(username);
                if (existing && String(existing.id) !== String(userId)) {
                    return res.status(409).json({ message: 'Это имя пользователя уже занято' });
                }
            }

            const updatedUser = await db.updateUser(userId, {
                username: username || undefined,
                first_name: first_name || '',
                last_name: last_name || ''
            });

            if (!updatedUser) {
                return res.status(404).json({ message: 'Пользователь не найден' });
            }
            
            // Обновляем пользователя в памяти
            if (updateUserInMemory) {
                updateUserInMemory(userId, updatedUser);
            }

            res.json({
                message: 'Профиль обновлен',
                user: sanitizeUser(updatedUser)
            });

        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    });

    // Выход пользователя (опционально, так как JWT stateless)
    app.post('/api/auth/logout', authenticateToken, (req, res) => {
        res.json({ message: 'Успешный выход' });
    });

    return { sanitizeUser, authenticateToken };
}

module.exports = registerAuthModule;