/**
 * Адаптер для интеграции DataStore с существующим кодом
 * Обеспечивает совместимость с текущими модулями
 */
console.log('🔍 DataStoreAdapter.js: Скрипт загружен, создаем класс DataStoreAdapter');

class DataStoreAdapter {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.setupCompatibility();
    }
    
    /**
     * Настройка совместимости с существующими модулями
     */
    setupCompatibility() {
        // Создаем глобальные переменные для совместимости
        this.updateGlobalVariables();
        
        // Подписываемся на изменения для обновления глобальных переменных
        this.dataStore.subscribe('balance', () => this.updateGlobalVariables());
        this.dataStore.subscribe('income', () => this.updateGlobalVariables());
        this.dataStore.subscribe('expenses', () => this.updateGlobalVariables());
        this.dataStore.subscribe('credit', () => this.updateGlobalVariables());
        this.dataStore.subscribe('payday', () => this.updateGlobalVariables());
    }
    
    /**
     * Обновление глобальных переменных для совместимости
     */
    updateGlobalVariables() {
        const data = this.dataStore.getAll();
        
        // Обновляем глобальные переменные
        window.currentBalance = data.balance;
        window.monthlyIncome = data.income;
        window.monthlyExpenses = data.expenses;
        window.totalCredit = data.credit;
        window.creditPayment = data.expensesBreakdown.credit;
        window.expensesBreakdown = data.expensesBreakdown;
        
        console.log('🔄 DataStoreAdapter: Глобальные переменные обновлены', {
            currentBalance: window.currentBalance,
            monthlyIncome: window.monthlyIncome,
            monthlyExpenses: window.monthlyExpenses,
            totalCredit: window.totalCredit
        });
    }
    
    /**
     * Синхронизация данных из банковского модуля
     */
    syncFromBankModule(bankData) {
        if (!bankData) return;
        
        console.log('🔄 DataStoreAdapter: Синхронизация из банковского модуля', bankData);
        
        // Обновляем основные данные
        this.dataStore.update({
            balance: bankData.balance || 0,
            income: bankData.income || 0,
            passiveIncome: bankData.passiveIncome || 0,
            expenses: bankData.expenses || 0,
            payday: bankData.payday || 0,
            credit: bankData.credit || 0,
            maxCredit: bankData.maxCredit || 0,
            transfers: bankData.transfers || []
        });
        
        // Пересчитываем производные значения
        this.dataStore.calculateDerivedValues();
        
        console.log('🔄 DataStoreAdapter: Синхронизация завершена', this.dataStore.getAll());
    }
    
    /**
     * Синхронизация данных из сервера
     */
    syncFromServer(serverData) {
        if (!serverData) return;
        
        console.log('🔄 DataStoreAdapter: Синхронизация с сервера', serverData);
        
        // Обновляем данные игрока
        if (serverData.player) {
            this.dataStore.update({
                salary: serverData.player.profession?.salary || 0,
                passiveIncome: serverData.player.passiveIncome || 0,
                balance: serverData.player.cash || 0
            });
        }
        
        // Обновляем кредитную информацию
        if (serverData.credit) {
            this.dataStore.updateCredit(serverData.credit.amount || 0);
        }
        
        // Обновляем баланс
        if (serverData.balance) {
            this.dataStore.updateBalance(serverData.balance.amount || 0);
        }
        
        // Обновляем финансовые данные
        if (serverData.financials) {
            this.dataStore.updateExpenses({
                base: serverData.financials.baseExpenses || 0,
                credit: serverData.financials.creditPenalty || 0,
                children: serverData.financials.childrenExpenses || 0
            });
        }
        
        // Пересчитываем производные значения
        this.dataStore.calculateDerivedValues();
    }
    
    /**
     * Получение данных в формате, совместимом с банковским модулем
     */
    getBankModuleData() {
        const data = this.dataStore.getAll();
        
        return {
            balance: data.balance,
            income: data.income,
            passiveIncome: data.passiveIncome,
            expenses: data.expenses,
            payday: data.payday,
            credit: data.credit,
            maxCredit: data.maxCredit,
            freeCredit: data.freeCredit,
            transfers: data.transfers
        };
    }
    
    /**
     * Получение данных в формате, совместимом с PlayerSummary
     */
    getPlayerSummaryData() {
        const data = this.dataStore.getAll();
        
        return {
            balance: data.balance,
            income: data.income,
            passiveIncome: data.passiveIncome,
            expenses: data.expenses,
            payday: data.payday,
            credit: data.credit,
            maxCredit: data.maxCredit
        };
    }
    
    /**
     * Получение данных в формате, совместимом с integration.js
     */
    getIntegrationData() {
        const data = this.dataStore.getAll();
        
        return {
            balance: data.balance,
            income: data.income,
            expenses: data.expenses,
            credit: data.credit,
            payday: data.payday
        };
    }
    
    /**
     * Обновление UI элементов
     */
    updateUI() {
        const data = this.dataStore.getAll();
        
        // Обновляем элементы внешней панели банка
        this.updateExternalPanel(data);
        
        // Обновляем PlayerSummary
        this.updatePlayerSummary(data);
        
        // Обновляем банковский модуль
        this.updateBankModule(data);
    }
    
    /**
     * Обновление внешней панели банка
     */
    updateExternalPanel(data) {
        const incomeEl = document.getElementById('incomeValue');
        const expenseEl = document.getElementById('expenseValue');
        const paydayEl = document.getElementById('paydayValue');
        const loanEl = document.getElementById('loanValue');
        const passiveIncomeEl = document.getElementById('passiveIncomeValue');
        
        if (incomeEl) {
            incomeEl.textContent = `$${data.income.toLocaleString()}`;
        }
        if (expenseEl) {
            expenseEl.textContent = `$${data.expenses.toLocaleString()}`;
        }
        if (paydayEl) {
            paydayEl.textContent = `$${data.payday.toLocaleString()}/мес`;
        }
        if (loanEl) {
            loanEl.textContent = `$${data.credit.toLocaleString()}`;
        }
        if (passiveIncomeEl) {
            passiveIncomeEl.textContent = `$${data.passiveIncome.toLocaleString()}`;
        }
        
        console.log('🎨 DataStoreAdapter: Внешняя панель обновлена', {
            income: data.income,
            expenses: data.expenses,
            payday: data.payday,
            credit: data.credit,
            passiveIncome: data.passiveIncome
        });
    }
    
    /**
     * Обновление PlayerSummary
     */
    updatePlayerSummary(data) {
        // Ищем PlayerSummary в глобальных модулях игры
        if (window.gameState && window.gameState.modules) {
            const playerSummary = window.gameState.modules.find(module => 
                module.constructor.name === 'PlayerSummary'
            );
            if (playerSummary && typeof playerSummary.render === 'function') {
                playerSummary.render();
            }
        }
        
        console.log('🎨 DataStoreAdapter: PlayerSummary обновлен');
    }
    
    /**
     * Обновление банковского модуля
     */
    updateBankModule(data) {
        if (window.bankModuleV4 && typeof window.bankModuleV4.updateUI === 'function') {
            window.bankModuleV4.updateUI();
        }
        
        console.log('🎨 DataStoreAdapter: Банковский модуль обновлен');
    }
    
    /**
     * Инициализация с игровой информацией
     */
    initialize(roomId, playerName, playerId) {
        this.dataStore.setGameInfo(roomId, playerName, playerId);
        this.dataStore.initialize();
        
        console.log('🚀 DataStoreAdapter: Инициализирован', { roomId, playerName, playerId });
    }
    
    /**
     * Получение отладочной информации
     */
    getDebugInfo() {
        return {
            dataStore: this.dataStore.getDebugInfo(),
            globalVariables: {
                currentBalance: window.currentBalance,
                monthlyIncome: window.monthlyIncome,
                monthlyExpenses: window.monthlyExpenses,
                totalCredit: window.totalCredit
            }
        };
    }
}

// Создаем глобальный экземпляр адаптера
window.dataStoreAdapter = new DataStoreAdapter(window.dataStore);

// Принудительно инициализируем DataStoreAdapter
if (window.dataStoreAdapter) {
    window.dataStoreAdapter.initialize();
    console.log('🔄 DataStoreAdapter: Глобальный экземпляр создан и инициализирован', {
        dataStoreAdapter: window.dataStoreAdapter,
        isReady: window.dataStoreAdapter?.isReady?.() || false,
        dataStore: window.dataStore
    });
} else {
    console.error('❌ DataStoreAdapter: Не удалось создать глобальный экземпляр');
}

export default DataStoreAdapter;
