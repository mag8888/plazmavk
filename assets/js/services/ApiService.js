/**
 * API сервис для игры "Энергия денег"
 * Обеспечивает взаимодействие с сервером
 */

export class ApiService {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.baseURL = this.getBaseURL();
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        this.requestQueue = [];
        this.isOnline = navigator.onLine;
        this.isDestroyed = false;
    }

    /**
     * Инициализация API сервиса
     */
    async init() {
        console.log('🌐 ApiService инициализирован');
        
        // Подписка на события онлайн/оффлайн
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processQueuedRequests();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    /**
     * Получение базового URL
     */
    getBaseURL() {
        // В продакшене используем Railway
        if (window.location.hostname === 'em1-production.up.railway.app') {
            return 'https://em1-production.up.railway.app';
        }
        
        // В разработке используем локальный сервер
        return window.location.origin;
    }

    /**
     * Выполнение HTTP запроса
     * @param {string} endpoint - Конечная точка
     * @param {Object} options - Опции запроса
     */
    async request(endpoint, options = {}) {
        if (this.isDestroyed) {
            console.warn('ApiService уничтожен, запрос невозможен');
            return null;
        }

        const url = `${this.baseURL}${endpoint}`;
        const requestOptions = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...options.headers
            },
            credentials: 'include',
            mode: 'cors'
        };

        // Добавление авторизации если доступна
        const user = this.getCurrentUser();
        if (user && user.id) {
            requestOptions.headers['X-User-ID'] = user.id;
        }

        try {
            console.log(`🌐 API запрос: ${requestOptions.method || 'GET'} ${url}`);
            
            const response = await fetch(url, requestOptions);
            
            // Обработка ответа
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Парсинг JSON
            const data = await response.json();
            
            console.log(`🌐 API ответ: ${url}`, data);
            return data;
            
        } catch (error) {
            console.error(`🌐 API ошибка: ${url}`, error);
            
            // Если оффлайн, добавляем в очередь
            if (!this.isOnline) {
                this.addToQueue(endpoint, options);
            }
            
            throw error;
        }
    }

    /**
     * GET запрос
     * @param {string} endpoint - Конечная точка
     * @param {Object} params - Параметры запроса
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(url, { method: 'GET' });
    }

    /**
     * POST запрос
     * @param {string} endpoint - Конечная точка
     * @param {Object} data - Данные для отправки
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT запрос
     * @param {string} endpoint - Конечная точка
     * @param {Object} data - Данные для отправки
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE запрос
     * @param {string} endpoint - Конечная точка
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    /**
     * Получение информации о комнате
     * @param {string} roomId - ID комнаты
     */
    async getRoom(roomId) {
        try {
            return await this.get(`/api/rooms/${roomId}`);
        } catch (error) {
            console.error('Ошибка получения комнаты:', error);
            throw error;
        }
    }

    /**
     * Получение информации о пользователе
     * @param {string} userId - ID пользователя
     */
    async getUser(userId) {
        try {
            return await this.get(`/api/users/${userId}`);
        } catch (error) {
            console.error('Ошибка получения пользователя:', error);
            throw error;
        }
    }

    /**
     * Обновление баланса пользователя
     * @param {string} userId - ID пользователя
     * @param {number} amount - Сумма изменения
     * @param {string} description - Описание операции
     */
    async updateBalance(userId, amount, description) {
        try {
            return await this.post('/api/users/balance', {
                user_id: userId,
                amount: amount,
                description: description,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Ошибка обновления баланса:', error);
            throw error;
        }
    }

    /**
     * Получение истории транзакций
     * @param {string} userId - ID пользователя
     * @param {number} limit - Лимит записей
     */
    async getTransactionHistory(userId, limit = 50) {
        try {
            return await this.get(`/api/users/${userId}/transactions`, { limit });
        } catch (error) {
            console.error('Ошибка получения истории транзакций:', error);
            throw error;
        }
    }

    /**
     * Создание кредита
     * @param {string} userId - ID пользователя
     * @param {number} amount - Сумма кредита
     */
    async createCredit(userId, amount) {
        try {
            return await this.post('/api/credits', {
                user_id: userId,
                amount: amount,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Ошибка создания кредита:', error);
            throw error;
        }
    }

    /**
     * Погашение кредита
     * @param {string} userId - ID пользователя
     * @param {number} amount - Сумма погашения
     */
    async payCredit(userId, amount) {
        try {
            return await this.post('/api/credits/pay', {
                user_id: userId,
                amount: amount,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Ошибка погашения кредита:', error);
            throw error;
        }
    }

    /**
     * Перевод между игроками
     * @param {string} fromUserId - ID отправителя
     * @param {string} toUserId - ID получателя
     * @param {number} amount - Сумма перевода
     * @param {string} description - Описание
     */
    async transferMoney(fromUserId, toUserId, amount, description) {
        try {
            return await this.post('/api/transfers', {
                from_user_id: fromUserId,
                to_user_id: toUserId,
                amount: amount,
                description: description,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Ошибка перевода:', error);
            throw error;
        }
    }

    /**
     * Сохранение состояния игры
     * @param {string} roomId - ID комнаты
     * @param {Object} gameState - Состояние игры
     */
    async saveGameState(roomId, gameState) {
        try {
            return await this.put(`/api/rooms/${roomId}/state`, {
                state: gameState,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Ошибка сохранения состояния игры:', error);
            throw error;
        }
    }

    /**
     * Получение состояния игры
     * @param {string} roomId - ID комнаты
     */
    async getGameState(roomId) {
        try {
            return await this.get(`/api/rooms/${roomId}/state`);
        } catch (error) {
            console.error('Ошибка получения состояния игры:', error);
            throw error;
        }
    }

    /**
     * Отправка сообщения в чат
     * @param {string} roomId - ID комнаты
     * @param {string} message - Сообщение
     */
    async sendMessage(roomId, message) {
        try {
            return await this.post(`/api/rooms/${roomId}/messages`, {
                message: message,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            throw error;
        }
    }

    /**
     * Получение сообщений чата
     * @param {string} roomId - ID комнаты
     * @param {number} limit - Лимит сообщений
     */
    async getMessages(roomId, limit = 50) {
        try {
            return await this.get(`/api/rooms/${roomId}/messages`, { limit });
        } catch (error) {
            console.error('Ошибка получения сообщений:', error);
            throw error;
        }
    }

    /**
     * Проверка статуса сервера
     */
    async checkServerStatus() {
        try {
            const response = await this.get('/api/health');
            return response.status === 'ok';
        } catch (error) {
            console.error('Ошибка проверки статуса сервера:', error);
            return false;
        }
    }

    /**
     * Получение текущего пользователя
     */
    getCurrentUser() {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('Ошибка получения текущего пользователя:', error);
            return null;
        }
    }

    /**
     * Добавление запроса в очередь
     * @param {string} endpoint - Конечная точка
     * @param {Object} options - Опции запроса
     */
    addToQueue(endpoint, options) {
        this.requestQueue.push({
            endpoint,
            options,
            timestamp: Date.now()
        });
        
        console.log(`🌐 Запрос добавлен в очередь: ${endpoint}`);
    }

    /**
     * Обработка запросов из очереди
     */
    async processQueuedRequests() {
        if (this.requestQueue.length === 0) {
            return;
        }
        
        console.log(`🌐 Обработка ${this.requestQueue.length} запросов из очереди`);
        
        const requests = [...this.requestQueue];
        this.requestQueue = [];
        
        for (const request of requests) {
            try {
                await this.request(request.endpoint, request.options);
                console.log(`🌐 Запрос из очереди выполнен: ${request.endpoint}`);
            } catch (error) {
                console.error(`🌐 Ошибка выполнения запроса из очереди: ${request.endpoint}`, error);
                // Возвращаем в очередь если ошибка
                this.requestQueue.push(request);
            }
        }
    }

    /**
     * Получение статистики
     */
    getStats() {
        return {
            baseURL: this.baseURL,
            isOnline: this.isOnline,
            queuedRequests: this.requestQueue.length,
            hasCurrentUser: !!this.getCurrentUser()
        };
    }

    /**
     * Уничтожение API сервиса
     */
    destroy() {
        this.requestQueue = [];
        this.isDestroyed = true;
        console.log('🗑️ ApiService уничтожен');
    }
}

export default ApiService;
