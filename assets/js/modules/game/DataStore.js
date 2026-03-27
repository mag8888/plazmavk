/**
 * Единое место хранения данных игры
 * Централизованный DataStore для всех финансовых данных
 */
console.log('🔍 DataStore.js: Скрипт загружен, создаем класс DataStore');

class DataStore {
    constructor() {
        this.data = {
            // Основные финансовые данные
            balance: 0,
            income: 0,           // Общий доход (зарплата + пассивный доход)
            salary: 0,           // Зарплата от профессии
            passiveIncome: 0,    // Пассивный доход от активов
            expenses: 0,         // Общие расходы
            payday: 0,           // Чистый доход (PAYDAY)
            
            // Кредитная информация
            credit: 0,           // Текущий долг
            maxCredit: 0,        // Максимальный лимит кредита
            freeCredit: 0,       // Доступный лимит кредита
            
            // Детализированные расходы
            expensesBreakdown: {
                base: 0,         // Базовые расходы от профессии
                credit: 0,       // Расходы на кредит
                children: 0,     // Расходы на детей
                total: 0         // Общие расходы
            },
            
            // История операций
            transfers: [],
            
            // Игровая информация
            roomId: null,
            playerName: null,
            playerId: null,
            
            // Кэш и метаданные
            lastUpdated: null,
            isLoading: false
        };
        
        this.listeners = new Map();
        this.isInitialized = false;
        
        console.log('📊 DataStore: Инициализирован');
    }
    
    /**
     * Подписка на изменения данных
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);
        
        // Возвращаем функцию отписки
        return () => {
            const callbacks = this.listeners.get(key);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }
    
    /**
     * Уведомление слушателей об изменениях
     */
    notify(key, oldValue, newValue) {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(newValue, oldValue, key);
                } catch (error) {
                    console.error(`DataStore: Ошибка в callback для ${key}:`, error);
                }
            });
        }
    }
    
    /**
     * Установка значения с уведомлением
     */
    set(key, value) {
        const oldValue = this.data[key];
        this.data[key] = value;
        this.data.lastUpdated = Date.now();
        
        if (oldValue !== value) {
            this.notify(key, oldValue, value);
        }
    }
    
    /**
     * Получение значения
     */
    get(key) {
        return this.data[key];
    }
    
    /**
     * Получение всех данных
     */
    getAll() {
        return { ...this.data };
    }
    
    /**
     * Получение данных в формате, совместимом с PlayerSummary
     */
    getPlayerSummaryData() {
        return {
            balance: this.data.balance,
            income: this.data.income,
            passiveIncome: this.data.passiveIncome,
            expenses: this.data.expenses,
            payday: this.data.payday,
            credit: this.data.credit,
            maxCredit: this.data.maxCredit
        };
    }
    
    /**
     * Получение данных в формате, совместимом с банковским модулем
     */
    getBankModuleData() {
        return {
            balance: this.data.balance,
            income: this.data.income,
            passiveIncome: this.data.passiveIncome,
            expenses: this.data.expenses,
            payday: this.data.payday,
            credit: this.data.credit,
            maxCredit: this.data.maxCredit,
            freeCredit: this.data.freeCredit,
            transfers: this.data.transfers
        };
    }
    
    /**
     * Обновление нескольких значений одновременно
     */
    update(updates) {
        const changedKeys = [];
        
        Object.keys(updates).forEach(key => {
            const oldValue = this.data[key];
            const newValue = updates[key];
            this.data[key] = newValue;
            
            if (oldValue !== newValue) {
                changedKeys.push({ key, oldValue, newValue });
            }
        });
        
        this.data.lastUpdated = Date.now();
        
        // Уведомляем об изменениях
        changedKeys.forEach(({ key, oldValue, newValue }) => {
            this.notify(key, oldValue, newValue);
        });
    }
    
    /**
     * Расчет производных значений
     */
    calculateDerivedValues() {
        const { salary, passiveIncome, expensesBreakdown, credit } = this.data;
        
        // Общий доход
        const totalIncome = salary + passiveIncome;
        
        // Общие расходы
        const totalExpenses = expensesBreakdown.base + expensesBreakdown.credit + expensesBreakdown.children;
        
        // PAYDAY (чистый доход)
        const payday = Math.max(0, totalIncome - totalExpenses);
        
        // Максимальный кредит (10x от базового PAYDAY без штрафа по кредиту)
        const basePayday = Math.max(0, totalIncome - expensesBreakdown.base - expensesBreakdown.children);
        const maxCredit = Math.max(0, basePayday * 10);
        
        // Доступный кредит
        const freeCredit = Math.max(0, maxCredit - credit);
        
        // Обновляем производные значения
        this.update({
            income: totalIncome,
            expenses: totalExpenses,
            payday: payday,
            maxCredit: maxCredit,
            freeCredit: freeCredit
        });
        
        console.log('📊 DataStore: Производные значения пересчитаны', {
            income: totalIncome,
            expenses: totalExpenses,
            payday: payday,
            maxCredit: maxCredit,
            freeCredit: freeCredit
        });
    }
    
    /**
     * Обновление расходов
     */
    updateExpenses(expensesData) {
        this.update({
            expensesBreakdown: {
                base: expensesData.base || 0,
                credit: expensesData.credit || 0,
                children: expensesData.children || 0,
                total: (expensesData.base || 0) + (expensesData.credit || 0) + (expensesData.children || 0)
            }
        });
        
        this.calculateDerivedValues();
    }
    
    /**
     * Обновление кредита
     */
    updateCredit(creditAmount) {
        this.set('credit', creditAmount);
        
        // Пересчитываем расходы на кредит
        const creditPenalty = Math.floor(creditAmount / 1000) * 100;
        this.updateExpenses({
            ...this.data.expensesBreakdown,
            credit: creditPenalty
        });
    }
    
    /**
     * Обновление пассивного дохода
     */
    updatePassiveIncome(amount) {
        this.set('passiveIncome', amount);
        this.calculateDerivedValues();
    }
    
    /**
     * Обновление зарплаты
     */
    updateSalary(amount) {
        this.set('salary', amount);
        this.calculateDerivedValues();
    }
    
    /**
     * Обновление баланса
     */
    updateBalance(amount) {
        this.set('balance', amount);
    }
    
    /**
     * Обновление истории переводов
     */
    updateTransfers(transfers) {
        this.set('transfers', transfers || []);
    }
    
    /**
     * Установка игровой информации
     */
    setGameInfo(roomId, playerName, playerId) {
        this.update({
            roomId,
            playerName,
            playerId
        });
    }
    
    /**
     * Установка состояния загрузки
     */
    setLoading(isLoading) {
        this.set('isLoading', isLoading);
    }
    
    /**
     * Проверка инициализации
     */
    isReady() {
        return this.isInitialized && this.data.roomId && this.data.playerName;
    }
    
    /**
     * Инициализация
     */
    initialize() {
        this.isInitialized = true;
        this.data.lastUpdated = Date.now();
        console.log('📊 DataStore: Инициализирован и готов к работе', {
            isInitialized: this.isInitialized,
            isReady: this.isReady(),
            data: this.getAll()
        });
    }
    
    /**
     * Сброс данных
     */
    reset() {
        this.data = {
            balance: 0,
            income: 0,
            salary: 0,
            passiveIncome: 0,
            expenses: 0,
            payday: 0,
            credit: 0,
            maxCredit: 0,
            freeCredit: 0,
            expensesBreakdown: {
                base: 0,
                credit: 0,
                children: 0,
                total: 0
            },
            transfers: [],
            roomId: null,
            playerName: null,
            playerId: null,
            lastUpdated: null,
            isLoading: false
        };
        
        this.isInitialized = false;
        console.log('📊 DataStore: Данные сброшены');
    }
    
    /**
     * Получение отладочной информации
     */
    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            isReady: this.isReady(),
            lastUpdated: this.data.lastUpdated,
            listenersCount: Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0),
            data: this.getAll()
        };
    }
}

// Создаем глобальный экземпляр
window.dataStore = new DataStore();

// Принудительно инициализируем DataStore
if (window.dataStore) {
    window.dataStore.initialize();
    console.log('📊 DataStore: Глобальный экземпляр создан и инициализирован', {
        dataStore: window.dataStore,
        isReady: window.dataStore?.isReady?.() || false,
        data: window.dataStore?.getAll?.() || 'N/A'
    });
} else {
    console.error('❌ DataStore: Не удалось создать глобальный экземпляр');
}

export default DataStore;
