/**
 * ApiClient - единый клиент для работы с API
 */
class ApiClient {
    constructor(baseUrl = window.location.origin) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        this.timeout = 10000;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    /**
     * Базовый метод для HTTP запросов
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            method: 'GET',
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...this.getAuthHeaders(),
                ...(options.headers || {})
            }
        };

        // Добавляем timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        config.signal = controller.signal;

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await this.parseError(response);
                throw error;
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            throw error;
        }
    }

    /**
     * GET запрос
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    /**
     * POST запрос
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT запрос
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE запрос
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    /**
     * Получение заголовков авторизации
     */
    getAuthHeaders() {
        const token = this.getAuthToken();
        if (token) {
            return { 'Authorization': `Bearer ${token}` };
        }
        return {};
    }

    /**
     * Получение токена авторизации
     */
    getAuthToken() {
        return localStorage.getItem('authToken');
    }

    /**
     * Установка токена авторизации
     */
    setAuthToken(token) {
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    /**
     * Парсинг ошибок
     */
    async parseError(response) {
        try {
            const data = await response.json();
            return new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
        } catch {
            return new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    }

    /**
     * Авторизация
     */
    async login(email, password, rememberMe = false) {
        const response = await this.post('/api/auth/login', {
            email,
            password,
            rememberMe
        });

        if (response.accessToken) {
            this.setAuthToken(response.accessToken);
        }

        return response;
    }

    /**
     * Выход из системы
     */
    logout() {
        this.setAuthToken(null);
    }

    /**
     * Получение профиля пользователя
     */
    async getProfile() {
        return this.get('/api/user/profile');
    }

    /**
     * Получение статистики пользователя
     */
    async getStats() {
        return this.get('/api/user/stats');
    }

    /**
     * Получение списка комнат
     */
    async getRooms() {
        const response = await this.get('/api/rooms');
        return response.rooms || [];
    }

    /**
     * Создание комнаты
     */
    async createRoom(roomData) {
        const response = await this.post('/api/rooms', roomData);
        return response.room;
    }

    /**
     * Получение информации о комнате
     */
    async getRoom(roomId) {
        const response = await this.get(`/api/rooms/${roomId}`);
        return response.room;
    }

    /**
     * Присоединение к комнате
     */
    async joinRoom(roomId, playerData = {}) {
        const response = await this.post(`/api/rooms/${roomId}/join`, playerData);
        return response;
    }

    /**
     * Выход из комнаты
     */
    async leaveRoom(roomId) {
        const response = await this.post(`/api/rooms/${roomId}/leave`);
        return response;
    }

    /**
     * Выбор мечты
     */
    async selectDream(roomId, dreamId) {
        const response = await this.post(`/api/rooms/${roomId}/dream`, { dream_id: dreamId });
        return response.room;
    }

    /**
     * Выбор токена
     */
    async selectToken(roomId, tokenId) {
        const response = await this.post(`/api/rooms/${roomId}/token`, { token_id: tokenId });
        return response.room;
    }

    /**
     * Переключение статуса готовности
     */
    async toggleReady(roomId) {
        const response = await this.post(`/api/rooms/${roomId}/ready`);
        return response.room;
    }

    /**
     * Запуск игры
     */
    async startGame(roomId) {
        const response = await this.post(`/api/rooms/${roomId}/start`);
        return response.room;
    }

    /**
     * Получение состояния игры
     */
    async getGameState(roomId) {
        const response = await this.get(`/api/rooms/${roomId}/game-state`);
        return response.state;
    }

    /**
     * Бросок кубика
     */
    async rollDice(roomId) {
        const response = await this.post(`/api/rooms/${roomId}/roll`);
        return response;
    }

    /**
     * Выбор сделки
     */
    async chooseDeal(roomId, size) {
        const response = await this.post(`/api/rooms/${roomId}/deals/choose`, { size });
        return response;
    }

    /**
     * Разрешение сделки
     */
    async resolveDeal(roomId, action) {
        const response = await this.post(`/api/rooms/${roomId}/deals/resolve`, { action });
        return response;
    }

    /**
     * Завершение хода
     */
    async endTurn(roomId) {
        const response = await this.post(`/api/rooms/${roomId}/end-turn`);
        return response.state;
    }

    /**
     * Проверка здоровья API
     */
    async healthCheck() {
        return this.get('/api/health');
    }
}

// Экспорт в window для глобального доступа
window.ApiClient = ApiClient;
