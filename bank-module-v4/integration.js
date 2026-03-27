/**
 * Bank Module v4 - Integration with table.html
 * Интеграция нового банковского модуля с игровым полем
 * Теперь использует единый DataStore для всех данных
 */

// Переменные для совместимости (если они еще не объявлены)
if (typeof window.currentBalance === 'undefined') window.currentBalance = 0;
if (typeof window.monthlyIncome === 'undefined') window.monthlyIncome = 0;
if (typeof window.monthlyExpenses === 'undefined') window.monthlyExpenses = 0;
if (typeof window.totalCredit === 'undefined') window.totalCredit = 0;
if (typeof window.creditPayment === 'undefined') window.creditPayment = 0;
if (typeof window.expensesBreakdown === 'undefined') window.expensesBreakdown = { base: 0, credit: 0 };

// Локальные ссылки для удобства (без объявления новых переменных)
// Используем прямое обращение к window объекту

/**
 * Синхронизация данных из банковского модуля v4
 * Теперь использует единый DataStore
 */
function syncDataFromBankV4() {
    if (!bankModuleV4) return;
    
    const data = bankModuleV4.getData();
    
    // Используем DataStore для синхронизации
    if (window.dataStoreAdapter) {
        window.dataStoreAdapter.syncFromBankModule(data);
        window.dataStoreAdapter.updateUI();
        
    // Дополнительно обновляем глобальные переменные для совместимости
    window.currentBalance = data.balance || 0;
    window.monthlyIncome = data.income || 0;
    window.monthlyExpenses = data.expenses || 0;
    window.totalCredit = data.credit || 0;

    // Принудительно обновляем отображение
    updateBalanceDisplay();
    updateFinancesDisplay();
    updateCreditDisplay();
    updatePlayerSummary();
    
    // Дополнительно обновляем bankBalanceValue напрямую
    const bankBalanceEl = document.getElementById('bankBalanceValue');
    if (bankBalanceEl) {
        bankBalanceEl.textContent = `$${(data.balance || 0).toLocaleString()}`;
        console.log('✅ bankBalanceValue обновлен напрямую:', bankBalanceEl.textContent);
    }
    } else {
        // Fallback к старой логике, если DataStore недоступен
        window.currentBalance = data.balance;
        window.monthlyIncome = data.income;
        window.monthlyExpenses = data.expenses;
        window.totalCredit = data.credit;
        
        updateBalanceDisplay();
        updateFinancesDisplay();
        updateCreditDisplay();
        updatePlayerSummary();
    }
    
    console.log('🔄 Данные синхронизированы из BankModuleV4:', data);
}

/**
 * Обновление баланса в table.html
 */
function updateBalanceDisplay() {
    const bankBalanceEl = document.getElementById('bankBalanceValue');
    
    console.log('💰 updateBalanceDisplay:', {
        bankBalanceEl: !!bankBalanceEl,
        currentBalance: window.currentBalance,
        elementId: 'bankBalanceValue'
    });
    
    if (bankBalanceEl) {
        bankBalanceEl.textContent = `$${window.currentBalance.toLocaleString()}`;
        console.log('✅ Баланс обновлен в DOM (bankBalanceValue):', bankBalanceEl.textContent);
    } else {
        console.warn('⚠️ Элемент bankBalanceValue не найден');
    }
    
    // Обновляем в банковском модуле
    if (bankModuleV4) {
        bankModuleV4.updateUI();
    }
}

/**
 * Обновление финансов в table.html
 */
function updateFinancesDisplay() {
    // Обновляем элементы внешней панели банка
    const incomeEl = document.getElementById('incomeValue');
    const expenseEl = document.getElementById('expenseValue');
    const paydayEl = document.getElementById('paydayValue');
    const loanEl = document.getElementById('loanValue');
    
    if (incomeEl) {
        incomeEl.textContent = `$${window.monthlyIncome.toLocaleString()}`;
    }
    if (expenseEl) {
        expenseEl.textContent = `$${window.monthlyExpenses.toLocaleString()}`;
    }
    if (paydayEl) {
        const payday = Math.max(0, window.monthlyIncome - window.monthlyExpenses);
        paydayEl.textContent = `$${payday.toLocaleString()}/мес`;
    }
    if (loanEl) {
        loanEl.textContent = `$${window.totalCredit.toLocaleString()}`;
    }
    
    console.log(`💰 PAYDAY: доход $${window.monthlyIncome.toLocaleString()} - расходы $${window.monthlyExpenses.toLocaleString()} = $${Math.max(0, window.monthlyIncome - window.monthlyExpenses).toLocaleString()}`);
}

/**
 * Обновление кредита в table.html
 */
function updateCreditDisplay() {
    const creditEl = document.getElementById('currentCredit');
    if (creditEl) {
        creditEl.textContent = `$${window.totalCredit.toLocaleString()}`;
    }
    
    const maxCreditEl = document.getElementById('maxCredit');
    if (maxCreditEl) {
        const maxCredit = Math.max(0, window.monthlyIncome * 10);
        maxCreditEl.textContent = `$${maxCredit.toLocaleString()}`;
    }
}

/**
 * Обновление PlayerSummary из банковского модуля
 */
function updatePlayerSummary() {
    // Ищем PlayerSummary в глобальных модулях игры
    if (window.gameState && window.gameState.modules) {
        const playerSummary = window.gameState.modules.find(module => 
            module.constructor.name === 'PlayerSummary'
        );
        if (playerSummary && typeof playerSummary.render === 'function') {
            playerSummary.render();
        }
    }
    
    // Обновляем пассивный доход отдельно, если элемент существует
    const passiveIncomeEl = document.getElementById('passiveIncomeValue');
    if (passiveIncomeEl && bankModuleV4) {
        const data = bankModuleV4.getData();
        passiveIncomeEl.textContent = `$${(data.passiveIncome || 0).toLocaleString()}`;
    }
}

/**
 * Добавление баланса (совместимость с table.html)
 */
async function addBalance(amount, description) {
    console.log(`💰 Добавление баланса: $${amount.toLocaleString()} - ${description}`);
    
    // Обновляем глобальную переменную
    window.currentBalance += amount;
    
    // Обновляем отображение
    updateBalanceDisplay();
    
    // Синхронизируем с банковским модулем
    if (bankModuleV4) {
        await bankModuleV4.loadData();
    }
}

/**
 * Вычитание баланса (совместимость с table.html)
 */
async function subtractBalance(amount, description) {
    console.log(`💸 Вычитание баланса: $${amount.toLocaleString()} - ${description}`);
    
    // Обновляем глобальную переменную
    window.currentBalance = Math.max(0, window.currentBalance - amount);
    
    // Обновляем отображение
    updateBalanceDisplay();
    
    // Синхронизируем с банковским модулем
    if (bankModuleV4) {
        await bankModuleV4.loadData();
    }
}

/**
 * Добавление месячного дохода (совместимость с table.html)
 */
function addMonthlyIncome(amount, description) {
    console.log(`📈 Добавление месячного дохода: $${amount.toLocaleString()} - ${description}`);
    
    window.monthlyIncome += amount;
    
    // Обновляем отображение
    updateFinancesDisplay();
    updateCreditDisplay();
    
    // Синхронизируем с банковским модулем
    if (bankModuleV4) {
        bankModuleV4.loadData();
    }
}

/**
 * Запрос кредита (совместимость с table.html)
 */
async function requestCreditLocal(amount = 1000) {
    console.log(`📄 Запрос кредита: $${amount.toLocaleString()}`);
    
    if (bankModuleV4) {
        const success = await bankModuleV4.requestCredit(amount);
        if (success) {
            // Синхронизируем данные
            syncDataFromBankV4();
        }
        return success;
    }
    
    return false;
}

/**
 * Погашение кредита (совместимость с table.html)
 */
async function payoffCredit() {
    console.log('📄 Погашение кредита');
    
    if (bankModuleV4) {
        const success = await bankModuleV4.payoffCredit();
        if (success) {
            // Синхронизируем данные
            syncDataFromBankV4();
        }
        return success;
    }
    
    return false;
}

/**
 * Открытие банка (совместимость с table.html)
 */
async function openBankModal() {
    console.log('🏦 Открытие банковского модального окна');
    
    // Ждем DataStore перед инициализацией BankModuleV4
    if (!window.dataStore) {
        console.log('⏳ Ожидаем загрузки DataStore для открытия банка...');
        await new Promise(resolve => {
            const checkDataStore = () => {
                if (window.dataStore) {
                    resolve();
                } else {
                    setTimeout(checkDataStore, 100);
                }
            };
            checkDataStore();
        });
    }
    
    if (!bankModuleV4 && typeof window.initBankModuleV4 === 'function') {
        await window.initBankModuleV4();
    }
    
    if (bankModuleV4) {
        bankModuleV4.openBank();
    }
}

/**
 * Закрытие банка (совместимость с table.html)
 */
function closeBankModal() {
    console.log('🏦 Закрытие банковского модального окна');
    
    if (bankModuleV4) {
        bankModuleV4.closeBank();
    }
}

/**
 * Инициализация финансов (совместимость с table.html)
 */
function initializeFinances() {
    console.log('💰 Инициализация финансов');
    
    // Инициализируем переменные
    window.currentBalance = window.currentBalance || 0;
    window.monthlyIncome = window.monthlyIncome || 0;
    window.monthlyExpenses = window.monthlyExpenses || 0;
    window.totalCredit = window.totalCredit || 0;
    window.creditPayment = window.creditPayment || 0;
    
    if (!window.expensesBreakdown) {
        window.expensesBreakdown = { base: 0, credit: 0 };
    }
    
    // Синхронизируем с банковским модулем
    if (bankModuleV4) {
        syncDataFromBankV4();
    }
    
    // Обновляем отображение
    updateBalanceDisplay();
    updateFinancesDisplay();
    updateCreditDisplay();
}

/**
 * Безопасный вызов банковских функций
 */
function safeCallBankFunction(functionName, ...args) {
    try {
        if (window[functionName] && typeof window[functionName] === 'function') {
            return window[functionName](...args);
        } else {
            console.warn(`Банковская функция ${functionName} не найдена`);
            return null;
        }
    } catch (error) {
        console.error(`Ошибка при вызове банковской функции ${functionName}:`, error);
        return null;
    }
}

// Экспорт функций в глобальную область для совместимости
// Переменные уже объявлены выше

window.updateBalanceDisplay = updateBalanceDisplay;
window.updateFinancesDisplay = updateFinancesDisplay;
window.updateCreditDisplay = updateCreditDisplay;
window.updatePlayerSummary = updatePlayerSummary;
window.addBalance = addBalance;
window.subtractBalance = subtractBalance;
window.addMonthlyIncome = addMonthlyIncome;
window.requestCreditLocal = requestCreditLocal;
window.payoffCredit = payoffCredit;
window.openBankModal = openBankModal;
window.closeBankModal = closeBankModal;
window.initializeFinances = initializeFinances;
window.safeCallBankFunction = safeCallBankFunction;
window.syncDataFromBankV4 = syncDataFromBankV4;

// Инициализация DataStore при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    if (window.dataStore) {
        console.log('📊 DataStore: Инициализация при загрузке страницы');
        window.dataStore.initialize();
    }
});

// Автоматическая синхронизация каждые 10 секунд
setInterval(async () => {
    if (bankModuleV4) {
        syncDataFromBankV4();
    } else if (typeof window.initBankModuleV4 === 'function') {
        // Попытка инициализации, если модуль не загружен
        try {
            await window.initBankModuleV4();
        } catch (error) {
            console.warn('⚠️ Не удалось инициализировать BankModuleV4:', error);
        }
    }
}, 10000);

console.log('🔗 Bank Module v4 Integration загружен');
