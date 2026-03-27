/**
 * Сервис хранения данных для игры "Энергия денег"
 * Обеспечивает сохранение и загрузку данных в localStorage
 */

export class StorageService {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.storagePrefix = 'energy_money_game_';
        this.isDestroyed = false;
    }

    /**
     * Инициализация сервиса хранения
     */
    async init() {
        console.log('💾 StorageService инициализирован');
        
        // Проверка доступности localStorage
        if (!this.isLocalStorageAvailable()) {
            console.warn('localStorage недоступен, используется память');
        }
    }

    /**
     * Проверка доступности localStorage
     */
    isLocalStorageAvailable() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Генерация ключа хранения
     * @param {string} key - Ключ
     */
    getStorageKey(key) {
        return `${this.storagePrefix}${key}`;
    }

    /**
     * Сохранение данных
     * @param {string} key - Ключ
     * @param {any} data - Данные
     */
    set(key, data) {
        if (this.isDestroyed) {
            console.warn('StorageService уничтожен, сохранение невозможно');
            return false;
        }

        try {
            const storageKey = this.getStorageKey(key);
            const serializedData = JSON.stringify({
                data: data,
                timestamp: Date.now(),
                version: this.getVersion()
            });
            
            localStorage.setItem(storageKey, serializedData);
            console.log(`💾 Данные сохранены: ${key}`);
            return true;
        } catch (error) {
            console.error(`💾 Ошибка сохранения данных ${key}:`, error);
            return false;
        }
    }

    /**
     * Загрузка данных
     * @param {string} key - Ключ
     * @param {any} defaultValue - Значение по умолчанию
     */
    get(key, defaultValue = null) {
        if (this.isDestroyed) {
            return defaultValue;
        }

        try {
            const storageKey = this.getStorageKey(key);
            const serializedData = localStorage.getItem(storageKey);
            
            if (!serializedData) {
                return defaultValue;
            }
            
            const parsedData = JSON.parse(serializedData);
            
            // Проверка версии
            if (parsedData.version !== this.getVersion()) {
                console.warn(`💾 Версия данных ${key} устарела, используется значение по умолчанию`);
                return defaultValue;
            }
            
            console.log(`💾 Данные загружены: ${key}`);
            return parsedData.data;
        } catch (error) {
            console.error(`💾 Ошибка загрузки данных ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Удаление данных
     * @param {string} key - Ключ
     */
    remove(key) {
        if (this.isDestroyed) {
            return false;
        }

        try {
            const storageKey = this.getStorageKey(key);
            localStorage.removeItem(storageKey);
            console.log(`💾 Данные удалены: ${key}`);
            return true;
        } catch (error) {
            console.error(`💾 Ошибка удаления данных ${key}:`, error);
            return false;
        }
    }

    /**
     * Проверка существования данных
     * @param {string} key - Ключ
     */
    has(key) {
        try {
            const storageKey = this.getStorageKey(key);
            return localStorage.getItem(storageKey) !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Очистка всех данных игры
     */
    clear() {
        if (this.isDestroyed) {
            return false;
        }

        try {
            const keys = Object.keys(localStorage);
            const gameKeys = keys.filter(key => key.startsWith(this.storagePrefix));
            
            gameKeys.forEach(key => {
                localStorage.removeItem(key);
            });
            
            console.log(`💾 Очищено ${gameKeys.length} записей`);
            return true;
        } catch (error) {
            console.error('💾 Ошибка очистки данных:', error);
            return false;
        }
    }

    /**
     * Получение версии данных
     */
    getVersion() {
        return '1.0.0';
    }

    /**
     * Сохранение состояния игры
     * @param {Object} gameState - Состояние игры
     */
    saveGameState(gameState) {
        return this.set('game_state', gameState);
    }

    /**
     * Загрузка состояния игры
     */
    loadGameState() {
        return this.get('game_state', null);
    }

    /**
     * Сохранение настроек пользователя
     * @param {Object} settings - Настройки
     */
    saveUserSettings(settings) {
        return this.set('user_settings', settings);
    }

    /**
     * Загрузка настроек пользователя
     */
    loadUserSettings() {
        return this.get('user_settings', {
            theme: 'dark',
            language: 'ru',
            soundEnabled: true,
            animationsEnabled: true
        });
    }

    /**
     * Сохранение истории игр
     * @param {Array} gameHistory - История игр
     */
    saveGameHistory(gameHistory) {
        return this.set('game_history', gameHistory);
    }

    /**
     * Загрузка истории игр
     */
    loadGameHistory() {
        return this.get('game_history', []);
    }

    /**
     * Добавление игры в историю
     * @param {Object} gameData - Данные игры
     */
    addGameToHistory(gameData) {
        const history = this.loadGameHistory();
        history.push({
            ...gameData,
            timestamp: Date.now()
        });
        
        // Ограничение размера истории
        const maxHistorySize = 50;
        if (history.length > maxHistorySize) {
            history.splice(0, history.length - maxHistorySize);
        }
        
        return this.saveGameHistory(history);
    }

    /**
     * Сохранение статистики игрока
     * @param {string} playerId - ID игрока
     * @param {Object} stats - Статистика
     */
    savePlayerStats(playerId, stats) {
        return this.set(`player_stats_${playerId}`, stats);
    }

    /**
     * Загрузка статистики игрока
     * @param {string} playerId - ID игрока
     */
    loadPlayerStats(playerId) {
        return this.get(`player_stats_${playerId}`, {
            gamesPlayed: 0,
            gamesWon: 0,
            totalEarnings: 0,
            totalSpent: 0,
            bankruptcies: 0,
            creditsTaken: 0,
            creditsPaid: 0
        });
    }

    /**
     * Сохранение достижений
     * @param {Array} achievements - Достижения
     */
    saveAchievements(achievements) {
        return this.set('achievements', achievements);
    }

    /**
     * Загрузка достижений
     */
    loadAchievements() {
        return this.get('achievements', []);
    }

    /**
     * Добавление достижения
     * @param {Object} achievement - Достижение
     */
    addAchievement(achievement) {
        const achievements = this.loadAchievements();
        
        // Проверка на дублирование
        if (achievements.find(a => a.id === achievement.id)) {
            return false;
        }
        
        achievements.push({
            ...achievement,
            unlockedAt: Date.now()
        });
        
        return this.saveAchievements(achievements);
    }

    /**
     * Сохранение временных данных
     * @param {string} key - Ключ
     * @param {any} data - Данные
     * @param {number} ttl - Время жизни в миллисекундах
     */
    setTemporary(key, data, ttl = 3600000) { // 1 час по умолчанию
        const temporaryData = {
            data: data,
            expiresAt: Date.now() + ttl
        };
        
        return this.set(`temp_${key}`, temporaryData);
    }

    /**
     * Загрузка временных данных
     * @param {string} key - Ключ
     * @param {any} defaultValue - Значение по умолчанию
     */
    getTemporary(key, defaultValue = null) {
        const temporaryData = this.get(`temp_${key}`);
        
        if (!temporaryData) {
            return defaultValue;
        }
        
        if (Date.now() > temporaryData.expiresAt) {
            this.remove(`temp_${key}`);
            return defaultValue;
        }
        
        return temporaryData.data;
    }

    /**
     * Получение размера используемого пространства
     */
    getStorageSize() {
        try {
            let totalSize = 0;
            const keys = Object.keys(localStorage);
            const gameKeys = keys.filter(key => key.startsWith(this.storagePrefix));
            
            gameKeys.forEach(key => {
                const value = localStorage.getItem(key);
                totalSize += key.length + value.length;
            });
            
            return {
                totalSize: totalSize,
                gameSize: totalSize,
                totalKeys: keys.length,
                gameKeys: gameKeys.length
            };
        } catch (error) {
            console.error('💾 Ошибка получения размера хранилища:', error);
            return { totalSize: 0, gameSize: 0, totalKeys: 0, gameKeys: 0 };
        }
    }

    /**
     * Экспорт данных игры
     */
    exportGameData() {
        try {
            const keys = Object.keys(localStorage);
            const gameKeys = keys.filter(key => key.startsWith(this.storagePrefix));
            const exportData = {};
            
            gameKeys.forEach(key => {
                exportData[key] = localStorage.getItem(key);
            });
            
            return {
                data: exportData,
                timestamp: Date.now(),
                version: this.getVersion()
            };
        } catch (error) {
            console.error('💾 Ошибка экспорта данных:', error);
            return null;
        }
    }

    /**
     * Импорт данных игры
     * @param {Object} importData - Данные для импорта
     */
    importGameData(importData) {
        try {
            if (!importData || !importData.data) {
                throw new Error('Неверный формат данных для импорта');
            }
            
            Object.keys(importData.data).forEach(key => {
                if (key.startsWith(this.storagePrefix)) {
                    localStorage.setItem(key, importData.data[key]);
                }
            });
            
            console.log('💾 Данные игры импортированы');
            return true;
        } catch (error) {
            console.error('💾 Ошибка импорта данных:', error);
            return false;
        }
    }

    /**
     * Получение статистики
     */
    getStats() {
        const storageSize = this.getStorageSize();
        
        return {
            ...storageSize,
            isAvailable: this.isLocalStorageAvailable(),
            version: this.getVersion()
        };
    }

    /**
     * Уничтожение сервиса хранения
     */
    destroy() {
        this.isDestroyed = true;
        console.log('🗑️ StorageService уничтожен');
    }
}

export default StorageService;
