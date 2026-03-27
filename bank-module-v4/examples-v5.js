/**
 * Bank Module v5 - Примеры использования
 * Демонстрация различных сценариев использования банковского модуля
 */

// ============================================================================
// БАЗОВОЕ ИСПОЛЬЗОВАНИЕ
// ============================================================================

// 1. Инициализация и открытие банка
async function basicUsage() {
    console.log('🚀 Базовое использование Bank Module v5');
    
    // Инициализация модуля
    const bankModule = await initBankModuleV5();
    
    // Открытие банка
    await openBankV5();
    
    // Получение данных
    const data = getBankDataV5();
    console.log('Данные банка:', data);
}

// ============================================================================
// РАБОТА С СОБЫТИЯМИ
// ============================================================================

// 2. Подписка на события
function eventHandling() {
    console.log('📡 Обработка событий Bank Module v5');
    
    // Получаем экземпляр модуля
    const bankModule = window.bankModuleV5;
    
    // Подписываемся на события
    bankModule.on('bank:initialized', (data) => {
        console.log('✅ Банк инициализирован:', data);
    });
    
    bankModule.on('bank:dataLoaded', (data) => {
        console.log('📊 Данные загружены:', data);
        updateGameUI(data);
    });
    
    bankModule.on('bank:error', (error) => {
        console.error('❌ Ошибка банка:', error);
        showErrorMessage(error.message);
    });
    
    bankModule.on('bank:transferCompleted', (data) => {
        console.log('💸 Перевод выполнен:', data);
        showSuccessMessage(`Перевод $${data.amount} выполнен`);
    });
    
    bankModule.on('bank:creditTaken', (data) => {
        console.log('💰 Кредит получен:', data);
        showSuccessMessage(`Кредит $${data.amount} получен`);
    });
}

// ============================================================================
// БАНКОВСКИЕ ОПЕРАЦИИ
// ============================================================================

// 3. Перевод денег
async function transferMoney() {
    console.log('💸 Перевод денег');
    
    try {
        // Получаем данные формы
        const recipientSelect = document.getElementById('recipientSelect');
        const amountInput = document.getElementById('transferAmount');
        
        const recipientIndex = parseInt(recipientSelect.value);
        const amount = parseFloat(amountInput.value);
        
        // Валидация
        if (!recipientIndex || !amount) {
            throw new Error('Заполните все поля');
        }
        
        if (amount <= 0) {
            throw new Error('Сумма должна быть положительной');
        }
        
        // Выполняем перевод
        const success = await transferMoneyV5(recipientIndex, amount);
        
        if (success) {
            // Очищаем форму
            recipientSelect.value = '';
            amountInput.value = '';
            
            // Показываем уведомление
            showSuccessMessage('Перевод выполнен успешно!');
        }
        
    } catch (error) {
        console.error('Ошибка перевода:', error);
        showErrorMessage(`Ошибка перевода: ${error.message}`);
    }
}

// 4. Запрос кредита
async function takeCredit() {
    console.log('💰 Запрос кредита');
    
    try {
        const amountInput = document.getElementById('creditAmount');
        const amount = parseFloat(amountInput.value) || 1000;
        
        // Валидация
        if (amount <= 0) {
            throw new Error('Сумма кредита должна быть положительной');
        }
        
        // Запрашиваем кредит
        const success = await requestCreditV5(amount);
        
        if (success) {
            showSuccessMessage(`Кредит $${amount} получен успешно!`);
        }
        
    } catch (error) {
        console.error('Ошибка получения кредита:', error);
        showErrorMessage(`Ошибка: ${error.message}`);
    }
}

// 5. Погашение кредита
async function repayCredit() {
    console.log('💳 Погашение кредита');
    
    try {
        const success = await payoffCreditV5();
        
        if (success) {
            showSuccessMessage('Кредит погашен успешно!');
        }
        
    } catch (error) {
        console.error('Ошибка погашения кредита:', error);
        showErrorMessage(`Ошибка: ${error.message}`);
    }
}

// ============================================================================
// ИНТЕГРАЦИЯ С ИГРОЙ
// ============================================================================

// 6. Интеграция с игровым состоянием
function integrateWithGame() {
    console.log('🎮 Интеграция с игрой');
    
    const bankModule = window.bankModuleV5;
    
    // Синхронизация с игровым состоянием
    bankModule.on('bank:dataLoaded', (data) => {
        // Обновляем игровое состояние
        if (window.gameState) {
            window.gameState.playerBalance = data.balance;
            window.gameState.playerIncome = data.income;
            window.gameState.playerExpenses = data.expenses;
        }
        
        // Обновляем UI игры
        updateGameBalance(data.balance);
        updateGameIncome(data.income);
        updateGameExpenses(data.expenses);
    });
    
    // Обработка изменений в игре
    if (window.gameState) {
        window.gameState.on('playerChanged', (player) => {
            // Обновляем данные банка при смене игрока
            bankModule.loadData(true);
        });
    }
}

// 7. Автоматическое обновление данных
function setupAutoRefresh() {
    console.log('🔄 Настройка автоматического обновления');
    
    const bankModule = window.bankModuleV5;
    
    // Обновляем данные каждые 30 секунд
    setInterval(() => {
        if (bankModule && bankModule.state.isInitialized) {
            bankModule.loadData();
        }
    }, 30000);
    
    // Обновляем при фокусе на окне
    window.addEventListener('focus', () => {
        if (bankModule && bankModule.state.isInitialized) {
            bankModule.loadData(true);
        }
    });
}

// ============================================================================
// КАСТОМИЗАЦИЯ UI
// ============================================================================

// 8. Кастомные стили
function customizeUI() {
    console.log('🎨 Кастомизация UI');
    
    // Добавляем кастомные CSS переменные
    const root = document.documentElement;
    root.style.setProperty('--bank-primary', '#ff6b6b');
    root.style.setProperty('--bank-success', '#4ecdc4');
    root.style.setProperty('--bank-danger', '#ff6b6b');
    
    // Добавляем кастомные классы
    const modal = document.getElementById('bankModal');
    if (modal) {
        modal.classList.add('custom-theme');
    }
}

// 9. Кастомные обработчики
function setupCustomHandlers() {
    console.log('⚙️ Настройка кастомных обработчиков');
    
    // Кастомный обработчик для кнопки перевода
    const transferBtn = document.getElementById('transferBtn');
    if (transferBtn) {
        transferBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await transferMoney();
        });
    }
    
    // Кастомный обработчик для кнопки кредита
    const creditBtn = document.getElementById('takeCreditBtn');
    if (creditBtn) {
        creditBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await takeCredit();
        });
    }
    
    // Кастомный обработчик для кнопки погашения
    const payoffBtn = document.getElementById('payoffCreditBtn');
    if (payoffBtn) {
        payoffBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await repayCredit();
        });
    }
}

// ============================================================================
// ОТЛАДКА И МОНИТОРИНГ
// ============================================================================

// 10. Отладочные функции
function setupDebugging() {
    console.log('🐛 Настройка отладки');
    
    // Включаем отладочный режим
    localStorage.setItem('bank-debug', 'true');
    
    const bankModule = window.bankModuleV5;
    
    // Добавляем отладочные обработчики
    bankModule.on('bank:initialized', () => {
        console.log('🏦 Bank Module v5 Debug: Initialized');
        console.log('State:', bankModule.state);
        console.log('Data:', bankModule.data);
    });
    
    bankModule.on('bank:dataLoaded', (data) => {
        console.log('🏦 Bank Module v5 Debug: Data loaded');
        console.log('Balance:', data.balance);
        console.log('Income:', data.income);
        console.log('Expenses:', data.expenses);
    });
    
    bankModule.on('bank:error', (error) => {
        console.error('🏦 Bank Module v5 Debug: Error');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
    });
    
    // Добавляем глобальные функции для отладки
    window.debugBank = {
        getState: () => bankModule.state,
        getData: () => bankModule.data,
        getPlayers: () => bankModule.players,
        forceReload: () => bankModule.loadData(true),
        clearCache: () => {
            bankModule.cache.data = null;
            bankModule.cache.timestamp = 0;
        }
    };
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

// Вспомогательные функции для UI
function updateGameUI(data) {
    // Обновляем элементы игры
    const balanceEl = document.getElementById('gameBalance');
    if (balanceEl) {
        balanceEl.textContent = `$${data.balance.toLocaleString()}`;
    }
}

function updateGameBalance(balance) {
    console.log('💰 Обновление баланса игры:', balance);
}

function updateGameIncome(income) {
    console.log('📈 Обновление дохода игры:', income);
}

function updateGameExpenses(expenses) {
    console.log('📉 Обновление расходов игры:', expenses);
}

function showSuccessMessage(message) {
    // Показываем уведомление об успехе
    console.log('✅', message);
    // Здесь можно добавить toast уведомления
}

function showErrorMessage(message) {
    // Показываем уведомление об ошибке
    console.error('❌', message);
    // Здесь можно добавить toast уведомления
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИМЕРОВ
// ============================================================================

// Инициализация всех примеров
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Инициализация примеров Bank Module v5');
    
    // Ждем загрузки модуля
    setTimeout(() => {
        eventHandling();
        integrateWithGame();
        setupAutoRefresh();
        customizeUI();
        setupCustomHandlers();
        setupDebugging();
        
        console.log('✅ Все примеры инициализированы');
    }, 1000);
});

// Экспорт функций для использования в других модулях
window.BankExamples = {
    basicUsage,
    transferMoney,
    takeCredit,
    repayCredit,
    customizeUI,
    setupDebugging
};
