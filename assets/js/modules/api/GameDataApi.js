// API для загрузки игровых данных с сервера
class GameDataApi {
    constructor() {
        this.baseUrl = window.location.origin;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    }

    // Базовый метод для HTTP запросов
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`❌ API Error for ${endpoint}:`, error);
            throw error;
        }
    }

    // Получить данные игроков
    async getPlayersData(roomId = null) {
        const cacheKey = `players_${roomId || 'default'}`;
        
        // Проверяем кэш
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📊 GameDataApi: Using cached players data');
                return cached.data;
            }
        }

        try {
            const endpoint = roomId ? `/api/rooms/${roomId}/players` : '/api/players';
            const data = await this.request(endpoint);
            
            // Кэшируем данные
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            
            console.log('📊 GameDataApi: Loaded players data from server:', data.length, 'players');
            return data;
        } catch (error) {
            console.warn('⚠️ GameDataApi: Failed to load players data, using fallback');
            return this.getFallbackPlayersData();
        }
    }

    // Получить данные профессий
    async getProfessionsData() {
        const cacheKey = 'professions';
        
        // Проверяем кэш
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📊 GameDataApi: Using cached professions data');
                return cached.data;
            }
        }

        try {
            const data = await this.request('/api/professions');
            
            // Кэшируем данные
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            
            console.log('📊 GameDataApi: Loaded professions data from server:', data.length, 'professions');
            return data;
        } catch (error) {
            console.warn('⚠️ GameDataApi: Failed to load professions data, using fallback');
            return this.getFallbackProfessionsData();
        }
    }

    // Получить данные сделок
    async getDealsData() {
        const cacheKey = 'deals';
        
        // Проверяем кэш
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📊 GameDataApi: Using cached deals data');
                return cached.data;
            }
        }

        try {
            const data = await this.request('/api/deals');
            
            // Кэшируем данные
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            
            console.log('📊 GameDataApi: Loaded deals data from server:', data);
            return data;
        } catch (error) {
            console.warn('⚠️ GameDataApi: Failed to load deals data, using fallback');
            return this.getFallbackDealsData();
        }
    }

    // Получить данные банковских операций
    async getBankData(playerId = null) {
        const cacheKey = `bank_${playerId || 'default'}`;
        
        // Проверяем кэш
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📊 GameDataApi: Using cached bank data');
                return cached.data;
            }
        }

        try {
            const endpoint = playerId ? `/api/players/${playerId}/bank` : '/api/bank';
            const data = await this.request(endpoint);
            
            // Кэшируем данные
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            
            console.log('📊 GameDataApi: Loaded bank data from server:', data);
            return data;
        } catch (error) {
            console.warn('⚠️ GameDataApi: Failed to load bank data, using fallback');
            return this.getFallbackBankData();
        }
    }

    // Fallback данные для игроков
    getFallbackPlayersData() {
        return [
            {
                id: 'player_1',
                name: 'Алексей',
                profession: { name: 'Предприниматель', salary: 10000, expenses: 6200 },
                cash: 10000,
                assets: 0,
                income: 10000,
                expenses: 6200,
                isHost: true,
                isReady: true
            },
            {
                id: 'player_2',
                name: 'Мария',
                profession: { name: 'Предприниматель', salary: 10000, expenses: 6200 },
                cash: 10000,
                assets: 0,
                income: 10000,
                expenses: 6200,
                isHost: false,
                isReady: true
            }
        ];
    }

    // Fallback данные для профессий
    getFallbackProfessionsData() {
        return [
            {
                id: 'entrepreneur',
                name: 'Предприниматель',
                description: 'Владелец бизнеса',
                salary: 10000,
                expenses: 6200,
                cashFlow: 3800,
                color: '#00ff96',
                icon: '🚀'
            },
            {
                id: 'doctor',
                name: 'Врач',
                description: 'Специалист в области медицины',
                salary: 8000,
                expenses: 4500,
                cashFlow: 3500,
                color: '#ff6b6b',
                icon: '👨‍⚕️'
            }
        ];
    }

    // Fallback данные для сделок
    getFallbackDealsData() {
        return {
            big: [
                { id: 1, name: 'Отель на берегу моря', cost: 500000, income: 25000, type: 'real_estate', icon: '🏨' }
            ],
            small: [
                { id: 1, name: 'Кофейня', cost: 50000, income: 3000, type: 'business', icon: '☕' }
            ],
            market: [
                { id: 1, name: 'Акции Apple', cost: 10000, income: 500, type: 'stocks', icon: '📈' }
            ],
            expenses: [
                { id: 1, name: 'Налоги', cost: 1300, type: 'tax', icon: '📊' }
            ]
        };
    }

    // Fallback данные для банка
    getFallbackBankData() {
        return {
            credits: [
                { type: 'personal', amount: 50000, rate: 15, term: 36 },
                { type: 'business', amount: 100000, rate: 12, term: 60 }
            ],
            investments: [
                { type: 'stocks', minAmount: 1000, expectedReturn: 12, risk: 'high' },
                { type: 'bonds', minAmount: 5000, expectedReturn: 6, risk: 'low' }
            ]
        };
    }

    // Очистить кэш
    clearCache() {
        this.cache.clear();
        console.log('📊 GameDataApi: Cache cleared');
    }

    // Очистить кэш для конкретного ключа
    clearCacheKey(key) {
        this.cache.delete(key);
        console.log('📊 GameDataApi: Cache cleared for key:', key);
    }

    // Получить статистику кэша
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            entries: Array.from(this.cache.entries()).map(([key, value]) => ({
                key,
                age: Date.now() - value.timestamp,
                size: JSON.stringify(value.data).length
            }))
        };
    }
}

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
    window.GameDataApi = GameDataApi;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 GameDataApi: DOM loaded, initializing...');
    if (!window.gameDataApi) {
        console.log('📊 GameDataApi: Creating new instance...');
        window.gameDataApi = new GameDataApi();
    } else {
        console.log('📊 GameDataApi: Already exists, skipping initialization');
    }
});
