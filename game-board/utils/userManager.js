/**
 * UserManager - Единая система управления пользователями
 * Обеспечивает единый ID для каждого пользователя во всех системах
 */

class UserManager {
    constructor() {
        this.users = new Map(); // Кэш пользователей по email
    }

    /**
     * Генерирует уникальный ID на основе email пользователя
     * @param {string} email - Email пользователя
     * @returns {string} Уникальный ID пользователя
     */
    generateUserId(email) {
        if (!email) {
            throw new Error('Email обязателен для генерации ID пользователя');
        }
        
        // Создаем хэш на основе email для стабильного ID
        const hash = this.simpleHash(email.toLowerCase().trim());
        return `user_${hash}`;
    }

    /**
     * Простая хэш-функция для генерации стабильного ID
     * @param {string} str - Строка для хэширования
     * @returns {string} Хэш
     */
    simpleHash(str) {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return Math.abs(hash).toString(36);
    }

    /**
     * Регистрирует пользователя с единым ID
     * @param {Object} userData - Данные пользователя
     * @param {string} userData.email - Email пользователя
     * @param {string} userData.username - Имя пользователя
     * @param {string} [userData.first_name] - Имя
     * @param {string} [userData.last_name] - Фамилия
     * @returns {Object} Пользователь с единым ID
     */
    registerUser(userData) {
        const { email, username, first_name, last_name } = userData;
        
        if (!email) {
            throw new Error('Email обязателен для регистрации');
        }

        const userId = this.generateUserId(email);
        
        // Проверяем, не зарегистрирован ли уже пользователь
        if (this.users.has(userId)) {
            const existingUser = this.users.get(userId);
            console.log(`👤 Пользователь уже зарегистрирован: ${existingUser.username} (${existingUser.email}) ID: ${existingUser.id}`);
            return existingUser;
        }

        const user = {
            id: userId,
            email: email.toLowerCase().trim(),
            username: username || email.split('@')[0],
            first_name: first_name || username || email.split('@')[0],
            last_name: last_name || '',
            registeredAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            socketConnections: new Set(), // Множество активных соединений
            isOnline: false
        };

        this.users.set(userId, user);
        console.log(`👤 Новый пользователь зарегистрирован: ${user.username} (${user.email}) ID: ${user.id}`);
        
        return user;
    }

    /**
     * Получает пользователя по ID
     * @param {string} userId - ID пользователя
     * @returns {Object|null} Пользователь или null
     */
    getUserById(userId) {
        return this.users.get(userId) || null;
    }

    /**
     * Получает пользователя по email
     * @param {string} email - Email пользователя
     * @returns {Object|null} Пользователь или null
     */
    getUserByEmail(email) {
        const userId = this.generateUserId(email);
        return this.users.get(userId) || null;
    }

    /**
     * Обновляет информацию о пользователе
     * @param {string} userId - ID пользователя
     * @param {Object} updates - Обновления
     */
    updateUser(userId, updates) {
        const user = this.users.get(userId);
        if (user) {
            Object.assign(user, updates);
            user.lastSeen = new Date().toISOString();
        }
    }

    /**
     * Добавляет WebSocket соединение к пользователю
     * @param {string} userId - ID пользователя
     * @param {string} socketId - ID WebSocket соединения
     */
    addSocketConnection(userId, socketId) {
        const user = this.users.get(userId);
        if (user) {
            user.socketConnections.add(socketId);
            user.isOnline = user.socketConnections.size > 0;
            user.lastSeen = new Date().toISOString();
        }
    }

    /**
     * Удаляет WebSocket соединение от пользователя
     * @param {string} userId - ID пользователя
     * @param {string} socketId - ID WebSocket соединения
     */
    removeSocketConnection(userId, socketId) {
        const user = this.users.get(userId);
        if (user) {
            user.socketConnections.delete(socketId);
            user.isOnline = user.socketConnections.size > 0;
            user.lastSeen = new Date().toISOString();
        }
    }

    /**
     * Получает всех онлайн пользователей
     * @returns {Array} Массив онлайн пользователей
     */
    getOnlineUsers() {
        return Array.from(this.users.values()).filter(user => user.isOnline);
    }

    /**
     * Получает общее количество пользователей
     * @returns {number} Количество пользователей
     */
    getUserCount() {
        return this.users.size;
    }

    /**
     * Получает общее количество онлайн пользователей
     * @returns {number} Количество онлайн пользователей
     */
    getOnlineUserCount() {
        return this.getOnlineUsers().length;
    }

    /**
     * Валидирует данные пользователя
     * @param {Object} userData - Данные пользователя
     * @returns {Object} Валидированные данные
     */
    validateUserData(userData) {
        const { email, username } = userData;
        
        if (!email || typeof email !== 'string') {
            throw new Error('Email обязателен и должен быть строкой');
        }

        if (!this.isValidEmail(email)) {
            throw new Error('Некорректный формат email');
        }

        return {
            email: email.toLowerCase().trim(),
            username: username || email.split('@')[0],
            first_name: userData.first_name || username || email.split('@')[0],
            last_name: userData.last_name || ''
        };
    }

    /**
     * Проверяет валидность email
     * @param {string} email - Email для проверки
     * @returns {boolean} Валидность email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Очищает неактивных пользователей (опционально)
     * @param {number} maxInactiveHours - Максимальное время неактивности в часах
     */
    cleanupInactiveUsers(maxInactiveHours = 24) {
        const cutoffTime = new Date(Date.now() - maxInactiveHours * 60 * 60 * 1000);
        let removedCount = 0;

        for (const [userId, user] of this.users.entries()) {
            if (!user.isOnline && new Date(user.lastSeen) < cutoffTime) {
                this.users.delete(userId);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            console.log(`🧹 Удалено ${removedCount} неактивных пользователей`);
        }
    }

    /**
     * Получает статистику пользователей
     * @returns {Object} Статистика
     */
    getStats() {
        const onlineUsers = this.getOnlineUsers();
        return {
            total: this.users.size,
            online: onlineUsers.length,
            offline: this.users.size - onlineUsers.length,
            topUsers: onlineUsers
                .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
                .slice(0, 10)
                .map(user => ({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    lastSeen: user.lastSeen,
                    connections: user.socketConnections.size
                }))
        };
    }
}

// Создаем единственный экземпляр
const userManager = new UserManager();

module.exports = userManager;
