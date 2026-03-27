/**
 * Bank Module v5 - Refactored and Optimized
 * Полностью переработанный банковский модуль с улучшенной архитектурой
 * VERSION: 5.0-OPTIMIZED
 */

// Константы
const BANK_CONSTANTS = {
    CACHE_TTL: 5000, // 5 секунд
    SYNC_INTERVAL: 10000, // 10 секунд
    DEBOUNCE_DELAY: 150, // 150ms
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 секунда
    DEFAULT_CREDIT_MULTIPLIER: 10,
    CREDIT_PAYDAY_REDUCTION: 100, // $100 за каждые $1000 кредита
    UI_UPDATE_DEBOUNCE: 100
};

const BANK_EVENTS = {
    INITIALIZED: 'bank:initialized',
    DATA_LOADED: 'bank:dataLoaded',
    UI_UPDATED: 'bank:uiUpdated',
    ERROR: 'bank:error',
    TRANSFER_COMPLETED: 'bank:transferCompleted',
    CREDIT_TAKEN: 'bank:creditTaken',
    CREDIT_REPAID: 'bank:creditRepaid'
};

const BANK_SELECTORS = {
    MODAL: '#bankModal',
    BALANCE: '#currentBalance',
    SALARY: '#salaryAmount',
    PASSIVE_INCOME: '#passiveIncomeAmount',
    BASE_EXPENSES: '#baseExpensesAmount',
    CHILDREN_EXPENSES: '#childrenExpensesAmount',
    TOTAL_EXPENSES: '#totalExpensesAmount',
    NET_INCOME: '#netIncomeAmount',
    PAYDAY: '#paydayAmount',
    CURRENT_DEBT: '#currentDebt',
    AVAILABLE_LIMIT: '#availableLimit',
    MAX_LIMIT: '#maxLimit',
    FREE_LIMIT: '#freeLimit',
    RECIPIENT_SELECT: '#recipientSelect',
    TRANSFER_AMOUNT: '#transferAmount',
    CREDIT_AMOUNT: '#creditAmount',
    HISTORY_COUNT: '#historyCount',
    TRANSFERS_HISTORY: '#transfersHistory'
};

/**
 * Утилиты для работы с данными
 */
class BankUtils {
    static formatCurrency(amount) {
        return `$${Number(amount).toLocaleString()}`;
    }

    static formatTime(timestamp) {
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '—';
        
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
        return date.toLocaleDateString();
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static retry(fn, retries = BANK_CONSTANTS.MAX_RETRIES, delay = BANK_CONSTANTS.RETRY_DELAY) {
        return new Promise((resolve, reject) => {
            const attempt = (attemptNumber) => {
                fn()
                    .then(resolve)
                    .catch((error) => {
                        if (attemptNumber < retries) {
                            setTimeout(() => attempt(attemptNumber + 1), delay);
                        } else {
                            reject(error);
                        }
                    });
            };
            attempt(1);
        });
    }

    static generateUniqueKey(transfer) {
        return `${transfer.amount}_${transfer.description || transfer.reason}_${transfer.timestamp}`;
    }

    static filterDuplicateTransfers(transfers) {
        const seen = new Set();
        return transfers.filter(transfer => {
            const key = this.generateUniqueKey(transfer);
            if (seen.has(key)) return false;
            
            // Исключаем отрицательные записи "стартовые сбережения"
            const isNegativeStartingSavings = 
                (transfer.description || transfer.reason) === 'стартовые сбережения' && 
                Number(transfer.amount) < 0;
            
            if (isNegativeStartingSavings) return false;
            
            seen.add(key);
            return true;
        });
    }
}

/**
 * Менеджер для работы с API
 */
class BankApiManager {
    constructor() {
        this.baseUrl = window.location.origin;
    }

    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            console.error('❌ BankApiManager: API Request Error:', error);
            throw error;
        }
    }

    async getRoomData(roomId, userId) {
        return this.makeRequest(`/api/rooms/${roomId}?user_id=${userId}`);
    }

    async getBankData(playerName, roomId) {
        const encodedName = encodeURIComponent(playerName);
        const [balanceRes, financialsRes, historyRes, creditRes] = await Promise.all([
            this.makeRequest(`/api/bank/balance/${encodedName}/${roomId}`),
            this.makeRequest(`/api/bank/financials/${encodedName}/${roomId}`),
            this.makeRequest(`/api/bank/history/${roomId}`),
            this.makeRequest(`/api/bank/credit/status/${encodedName}/${roomId}`)
        ]);

        return Promise.all([
            balanceRes.json(),
            financialsRes.json(),
            historyRes.json(),
            creditRes.json()
        ]);
    }

    async takeCredit(playerName, roomId, amount) {
        return this.makeRequest('/api/bank/credit/take', {
            method: 'POST',
            body: JSON.stringify({ username: playerName, roomId, amount })
        });
    }

    async repayCredit(playerName, roomId, amount) {
        return this.makeRequest('/api/bank/credit/repay', {
            method: 'POST',
            body: JSON.stringify({ username: playerName, roomId, amount })
        });
    }

    async transferMoney(from, to, amount, roomId) {
        return this.makeRequest('/api/bank/transfer', {
            method: 'POST',
            body: JSON.stringify({ from, to, amount, roomId })
        });
    }
}

/**
 * Менеджер для работы с UI
 */
class BankUIManager {
    constructor() {
        this.elements = new Map();
        this.updateUIDebounced = BankUtils.debounce(this.updateUI.bind(this), BANK_CONSTANTS.UI_UPDATE_DEBOUNCE);
    }

    getElement(selector) {
        if (!this.elements.has(selector)) {
            const element = document.querySelector(selector);
            this.elements.set(selector, element);
        }
        return this.elements.get(selector);
    }

    updateElement(selector, content, property = 'textContent') {
        const element = this.getElement(selector);
        if (element) {
            element[property] = content;
        }
    }

    updateBalance(balance) {
        this.updateElement(BANK_SELECTORS.BALANCE, BankUtils.formatCurrency(balance));
    }

    updateFinancialDetails(data) {
        // Показываем базовую зарплату $10,000
        this.updateElement(BANK_SELECTORS.SALARY, BankUtils.formatCurrency(10000));
        this.updateElement(BANK_SELECTORS.PASSIVE_INCOME, BankUtils.formatCurrency(0)); // Пока нет пассивного дохода
        this.updateElement(BANK_SELECTORS.BASE_EXPENSES, BankUtils.formatCurrency(data.expenses));
        
        // Показываем платежи по кредитам
        const creditPayment = data.creditPayment || 0;
        this.updateElement('#creditPaymentAmount', BankUtils.formatCurrency(creditPayment));
        this.updateElement(BANK_SELECTORS.CHILDREN_EXPENSES, BankUtils.formatCurrency(0)); // Пока нет расходов на детей
        this.updateElement(BANK_SELECTORS.TOTAL_EXPENSES, BankUtils.formatCurrency(data.expenses));
        this.updateElement(BANK_SELECTORS.NET_INCOME, BankUtils.formatCurrency(data.payday));
        this.updateElement(BANK_SELECTORS.PAYDAY, `${BankUtils.formatCurrency(data.payday)}/мес`);
        
        // Обновляем общий доход
        const totalIncome = 10000 + (data.passiveIncome || 0);
        this.updateElement('#totalIncomeAmount', BankUtils.formatCurrency(totalIncome));
        
        // Обновляем детали доходов (активы)
        this.updateAssetsIncome(data.assets || []);
        
        // Обновляем детали расходов (из карточки профессии)
        this.updateProfessionExpenses(data.profession || {});
    }
    
    updateAssetsIncome(assets) {
        const container = document.getElementById('assetsIncomeList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (assets.length === 0) {
            container.innerHTML = '<div class="asset-income-item"><span class="asset-name">Нет активов</span><span class="asset-income">$0</span></div>';
            return;
        }
        
        assets.forEach(asset => {
            const item = document.createElement('div');
            item.className = 'asset-income-item';
            item.innerHTML = `
                <span class="asset-name">${asset.name || 'Актив'}</span>
                <span class="asset-income">$${(asset.income || 0).toLocaleString()}</span>
            `;
            container.appendChild(item);
        });
    }
    
    updateProfessionExpenses(profession) {
        const container = document.getElementById('professionExpensesList');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Добавляем детали расходов из карточки профессии
        const expenses = [
            { name: 'Налоги', amount: profession.taxes || 1300 },
            { name: 'Прочие расходы', amount: profession.otherExpenses || 1500 },
            { name: 'Кредит на авто', amount: profession.carLoan || 700 },
            { name: 'Образовательный кредит', amount: profession.educationLoan || 500 },
            { name: 'Ипотека', amount: profession.mortgage || 1200 },
            { name: 'Кредитные карты', amount: profession.creditCards || 1000 }
        ];
        
        expenses.forEach(expense => {
            if (expense.amount > 0) {
                const item = document.createElement('div');
                item.className = 'profession-expense-item';
                item.innerHTML = `
                    <span class="expense-name">${expense.name}</span>
                    <span class="expense-amount">$${expense.amount.toLocaleString()}</span>
                `;
                container.appendChild(item);
            }
        });
    }

    updateCreditInfo(data) {
        this.updateElement(BANK_SELECTORS.CURRENT_DEBT, BankUtils.formatCurrency(data.credit));
        
        const available = Math.max(0, data.maxCredit - data.credit);
        this.updateElement(BANK_SELECTORS.AVAILABLE_LIMIT, BankUtils.formatCurrency(available));
        this.updateElement(BANK_SELECTORS.MAX_LIMIT, BankUtils.formatCurrency(data.maxCredit));
        this.updateElement(BANK_SELECTORS.FREE_LIMIT, BankUtils.formatCurrency(available));
    }

    updateTransfersHistory(transfers) {
        const historyContainer = this.getElement(BANK_SELECTORS.TRANSFERS_HISTORY);
        if (!historyContainer) return;

        historyContainer.innerHTML = '';

        if (!transfers.length) {
            historyContainer.innerHTML = '<div class="transfer-empty">Нет операций</div>';
            return;
        }

        const uniqueTransfers = BankUtils.filterDuplicateTransfers(transfers);
        const sortedTransfers = uniqueTransfers.sort((a, b) => 
            new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
        );

        sortedTransfers.forEach(transfer => {
            const transferEl = this.createTransferElement(transfer);
            historyContainer.appendChild(transferEl);
        });

        this.updateElement(BANK_SELECTORS.HISTORY_COUNT, uniqueTransfers.length);
    }

    createTransferElement(transfer) {
        const element = document.createElement('div');
        element.className = 'transfer-item';

        const rawAmount = Number(transfer?.amount || 0);
        const type = transfer?.type || '';
        const from = transfer?.from || transfer?.sender || 'Банк';
        const to = transfer?.to || transfer?.recipient || '';

        const isNotification = type === 'notification';
        const isCreditTake = type === 'credit_take';
        const isCreditRepay = type === 'credit_repay';

        const isReceived = isNotification ? rawAmount >= 0 : to === this.playerName;
        const amountClass = isReceived ? 'received' : 'sent';
        const absoluteAmount = Math.abs(rawAmount);
        const amountPrefix = isReceived ? '+' : '-';
        const displayAmount = `${amountPrefix}${BankUtils.formatCurrency(absoluteAmount)}`;

        let description = transfer?.reason || transfer?.description || '';
        if (!description) {
            if (isCreditTake) description = 'Кредит от банка';
            else if (isCreditRepay) description = 'Погашение кредита';
            else if (isNotification) description = isReceived ? 'Поступление' : 'Списание';
            else if (isReceived) description = `Получено от ${from}`;
            else description = `Перевод ${to || 'Банк'}`;
        }

        const timeLabel = transfer?.timestamp ? BankUtils.formatTime(transfer.timestamp) : '—';

        element.innerHTML = `
            <div class="transfer-amount ${amountClass}">${displayAmount}</div>
            <div class="transfer-description">${description}</div>
            <div class="transfer-time">${timeLabel}</div>
        `;

        return element;
    }

    initRecipientsList(players, currentPlayerName) {
        const recipientSelect = this.getElement(BANK_SELECTORS.RECIPIENT_SELECT);
        if (!recipientSelect) return;

        recipientSelect.innerHTML = '<option value="">Выберите получателя</option>';

        if (players && players.length > 0) {
            players.forEach((player, index) => {
                if (player.name !== currentPlayerName) {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = player.name;
                    recipientSelect.appendChild(option);
                }
            });
        }
    }

    updateUI(data) {
        this.updateBalance(data.balance);
        this.updateFinancialDetails(data);
        this.updateCreditInfo(data);
        this.updateTransfersHistory(data.transfers);
    }
}

/**
 * Основной класс банковского модуля v5
 */
class BankModuleV5 {
    constructor() {
        this.roomId = null;
        this.userId = null;
        this.playerName = null;
        this.playerIndex = 0;
        this.players = [];
        
        this.data = {
            balance: 0,
            income: 0,
            expenses: 0,
            credit: 0,
            maxCredit: 0,
            payday: 0,
            transfers: []
        };

        this.state = {
            isInitialized: false,
            isInitializing: false,
            isLoading: false,
            lastLoadTime: 0
        };

        this.cache = {
            data: null,
            timestamp: 0,
            ttl: BANK_CONSTANTS.CACHE_TTL
        };

        this.apiManager = new BankApiManager();
        this.uiManager = new BankUIManager();
        this.syncInterval = null;
        this.loadDebounceTimer = null;
        this.listeners = new Map();

        this.init();
    }

    async init() {
        if (this.state.isInitialized || this.state.isInitializing) {
            return this.state.isInitialized;
        }

        this.state.isInitializing = true;

        try {
            await this.initializeIdentifiers();
            await this.loadData(true);
            this.startAutoSync();
            
            this.state.isInitialized = true;
            this.emit(BANK_EVENTS.INITIALIZED);
            
            return true;
        } catch (error) {
            this.emit(BANK_EVENTS.ERROR, error);
            return false;
        } finally {
            this.state.isInitializing = false;
        }
    }

    async initializeIdentifiers() {
        this.roomId = this.getRoomId();
        this.userId = this.getUserId();

        if (!this.roomId || !this.userId) {
            throw new Error('Не удалось получить ID комнаты или пользователя');
        }
    }

    getRoomId() {
        const sources = [
            () => new URLSearchParams(window.location.search).get('room_id'),
            () => new URLSearchParams(window.location.search).get('roomId'),
            () => new URLSearchParams(window.location.search).get('room'),
            () => window.currentRoomId,
            () => window.roomId,
            () => window.gameState?.roomId,
            () => window.gameState?.state?.roomId
        ];

        for (const source of sources) {
            try {
                const roomId = source();
                if (roomId) return roomId;
            } catch (error) {
                // Игнорируем ошибки и пробуем следующий источник
            }
        }

        return null;
    }

    getUserId() {
        const sources = [
            () => {
                const userData = localStorage.getItem('user');
                if (userData) {
                    const user = JSON.parse(userData);
                    return user.id || user._id;
                }
                return null;
            },
            () => localStorage.getItem('userId'),
            () => localStorage.getItem('user_id'),
            () => window.userId,
            () => window.currentUserId,
            () => new URLSearchParams(window.location.search).get('user_id')
        ];

        for (const source of sources) {
            try {
                const userId = source();
                if (userId) return userId;
            } catch (error) {
                // Игнорируем ошибки и пробуем следующий источник
            }
        }

        return null;
    }

    async loadData(force = false) {
        if (!force && this.isCacheValid()) {
            this.updateDataFromCache();
            return true;
        }

        if (this.loadDebounceTimer) {
            clearTimeout(this.loadDebounceTimer);
        }

        if (this.state.isLoading) {
            return false;
        }

        return new Promise((resolve) => {
            this.loadDebounceTimer = setTimeout(async () => {
                try {
                    await this.loadDataInternal();
                    resolve(true);
                } catch (error) {
                    this.emit(BANK_EVENTS.ERROR, error);
                    resolve(false);
                }
            }, BANK_CONSTANTS.DEBOUNCE_DELAY);
        });
    }

    async loadDataInternal() {
        this.state.isLoading = true;
        this.state.lastLoadTime = Date.now();

        try {
            const roomResponse = await this.apiManager.getRoomData(this.roomId, this.userId);
            
            if (roomResponse.status === 404) {
                return this.loadOfflineData();
            }

            const roomData = await roomResponse.json();
            this.processRoomData(roomData);

            if (!this.playerName) {
                throw new Error('Не удалось определить имя игрока');
            }

            const [balanceData, financialsData, historyData, creditData] = 
                await this.apiManager.getBankData(this.playerName, this.roomId);

            this.updateDataFromApi(balanceData, financialsData, historyData, creditData);
            this.syncPlayerBalanceInGame();
            this.uiManager.updateUI(this.data);
            this.uiManager.initRecipientsList(this.players, this.playerName);

            this.emit(BANK_EVENTS.DATA_LOADED, this.data);
            return true;
        } catch (error) {
            this.emit(BANK_EVENTS.ERROR, error);
            return false;
        } finally {
            this.state.isLoading = false;
        }
    }

    updateDataFromApi(balanceData, financialsData, historyData, creditData) {
        const salary = Number(financialsData?.salary || 0);
        const passiveIncome = Number(financialsData?.passiveIncome || 0);
        const totalIncome = Number.isFinite(salary + passiveIncome) ? salary + passiveIncome : 0;
        const totalExpenses = Number(financialsData?.totalExpenses || 0);
        const netIncome = Number(financialsData?.netIncome ?? (totalIncome - totalExpenses));

        this.data.balance = Number(balanceData?.amount || 0);
        this.data.income = totalIncome;
        this.data.expenses = totalExpenses;
        this.data.payday = Number.isFinite(netIncome) ? netIncome : Math.max(0, totalIncome - totalExpenses);
        this.data.credit = Number(creditData?.loanAmount || 0);
        this.data.maxCredit = Number(creditData?.maxAvailable || Math.max(0, totalIncome * BANK_CONSTANTS.DEFAULT_CREDIT_MULTIPLIER));
        this.data.transfers = Array.isArray(historyData) ? historyData : [];

        this.updateCache();
    }

    processRoomData(roomData) {
        const room = roomData || {};
        this.players = Array.isArray(room.players) ? room.players : [];
        window.players = this.players;

        this.playerIndex = this.findPlayerIndex(this.players);
        const playerFromRoom = this.players[this.playerIndex] || null;
        const storedUser = this.getStoredUserInfo();

        this.playerName = playerFromRoom?.name ||
            storedUser?.username ||
            storedUser?.name ||
            localStorage.getItem('username') ||
            this.playerName;
    }

    findPlayerIndex(players) {
        for (let i = 0; i < players.length; i++) {
            if (players[i].user_id === this.userId || players[i].userId === this.userId) {
                return i;
            }
        }
        return -1;
    }

    getStoredUserInfo() {
        try {
            const raw = localStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    isCacheValid() {
        return this.cache.data && 
               (Date.now() - this.cache.timestamp) < this.cache.ttl;
    }

    updateCache() {
        this.cache.data = { ...this.data };
        this.cache.timestamp = Date.now();
    }

    updateDataFromCache() {
        if (this.cache.data) {
            this.data = { ...this.cache.data };
            this.syncPlayerBalanceInGame();
            this.uiManager.updateUI(this.data);
        }
    }

    async loadOfflineData() {
        const storedUser = this.getStoredUserInfo();
        if (!storedUser) {
            throw new Error('Данные пользователя не найдены в localStorage');
        }

        this.playerName = storedUser.username || storedUser.name || 'Игрок';
        this.data.balance = Number(localStorage.getItem('playerBalance') || 10000);
        this.data.income = Number(localStorage.getItem('playerIncome') || 0);
        this.data.expenses = Number(localStorage.getItem('playerExpenses') || 0);
        this.data.payday = Math.max(0, this.data.income - this.data.expenses);
        this.data.credit = Number(localStorage.getItem('playerCredit') || 0);
        this.data.maxCredit = Math.max(0, this.data.income * BANK_CONSTANTS.DEFAULT_CREDIT_MULTIPLIER);
        this.data.transfers = JSON.parse(localStorage.getItem('playerTransfers') || '[]');

        this.players = [{ name: this.playerName, userId: this.userId, username: this.playerName }];
        window.players = this.players;

        this.syncPlayerBalanceInGame();
        this.uiManager.updateUI(this.data);
        this.uiManager.initRecipientsList(this.players, this.playerName);
    }

    syncPlayerBalanceInGame() {
        if (!this.playerName || !this.data.balance) return;

        const updatePlayerBalance = (players) => {
            if (!players || !Array.isArray(players)) return;
            
            const player = players.find(p => 
                p.name === this.playerName || 
                p.username === this.playerName ||
                String(p.userId) === String(this.userId)
            );
            
            if (player) {
                const oldBalance = player.cash || 0;
                player.cash = this.data.balance;
                console.log(`🔄 BankModuleV5: Синхронизация баланса ${this.playerName}: $${oldBalance} → $${this.data.balance}`);
            }
        };

        if (window.gameState?.state?.players) {
            updatePlayerBalance(window.gameState.state.players);
        }

        if (window.players) {
            updatePlayerBalance(window.players);
        }
    }

    startAutoSync() {
        this.syncInterval = setInterval(() => {
            if (!this.state.isLoading) {
                this.loadData();
            }
        }, BANK_CONSTANTS.SYNC_INTERVAL);
    }

    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    openBank() {
        const modal = document.querySelector(BANK_SELECTORS.MODAL);
        if (modal) {
            modal.style.display = 'flex';
            
            // Добавляем обработчик клика по фону
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeBank();
                }
            });
        }
    }

    closeBank() {
        const modal = document.querySelector(BANK_SELECTORS.MODAL);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async requestCredit(amount = 1000) {
        try {
            if (!this.playerName) {
                throw new Error('Не удалось определить имя текущего игрока');
            }

            const availableCredit = Math.max(0, this.data.maxCredit - this.data.credit);
            if (amount > availableCredit) {
                throw new Error(`Превышен лимит кредита. Доступно: ${BankUtils.formatCurrency(availableCredit)}`);
            }

            await this.apiManager.takeCredit(this.playerName, this.roomId, amount);
            await this.loadData(true);
            
            this.emit(BANK_EVENTS.CREDIT_TAKEN, { amount });
            return true;
        } catch (error) {
            this.emit(BANK_EVENTS.ERROR, error);
            throw error;
        }
    }

    async payoffCredit(amount = null) {
        try {
            if (this.data.credit <= 0) {
                throw new Error('У вас нет активных кредитов');
            }

            if (!this.playerName) {
                throw new Error('Не удалось определить имя текущего игрока');
            }

            const payoffAmount = Number(amount || this.data.credit);
            if (!Number.isFinite(payoffAmount) || payoffAmount <= 0) {
                throw new Error('Некорректная сумма погашения');
            }

            await this.apiManager.repayCredit(this.playerName, this.roomId, payoffAmount);
            await this.loadData(true);
            
            this.emit(BANK_EVENTS.CREDIT_REPAID, { amount: payoffAmount });
            return true;
        } catch (error) {
            this.emit(BANK_EVENTS.ERROR, error);
            throw error;
        }
    }

    async transferMoney(recipientRef, amount) {
        try {
            const numericAmount = Number(amount);
            if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                throw new Error('Укажите корректную сумму перевода');
            }

            if (numericAmount > this.data.balance) {
                throw new Error('Недостаточно средств');
            }

            if (!this.playerName) {
                throw new Error('Не удалось определить имя текущего игрока');
            }

            let recipientName = recipientRef;
            if (typeof recipientRef === 'number') {
                recipientName = this.players?.[recipientRef]?.name;
            }

            if (!recipientName) {
                throw new Error('Получатель не найден');
            }

            if (recipientName === this.playerName) {
                throw new Error('Нельзя перевести средства самому себе');
            }

            await this.apiManager.transferMoney(this.playerName, recipientName, numericAmount, this.roomId);
            await this.loadData(true);
            
            this.emit(BANK_EVENTS.TRANSFER_COMPLETED, { recipient: recipientName, amount: numericAmount });
            return true;
        } catch (error) {
            this.emit(BANK_EVENTS.ERROR, error);
            throw error;
        }
    }

    getData() {
        return { ...this.data };
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    emit(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`❌ BankModuleV5: Ошибка в обработчике события ${event}:`, error);
            }
        });
    }

    destroy() {
        this.stopAutoSync();
        if (this.loadDebounceTimer) {
            clearTimeout(this.loadDebounceTimer);
        }
        this.listeners.clear();
    }
}

// Глобальные функции для совместимости
let bankModuleV5 = null;

async function initBankModuleV5() {
    if (bankModuleV5?.state?.isInitialized) {
        return bankModuleV5;
    }
    
    bankModuleV5 = new BankModuleV5();
    return bankModuleV5;
}

async function openBankV5() {
    if (!bankModuleV5) {
        await initBankModuleV5();
    }
    
    if (bankModuleV5) {
        bankModuleV5.openBank();
    }
}

function closeBankV5() {
    if (bankModuleV5) {
        bankModuleV5.closeBank();
    }
}

async function requestCreditV5(amount = 1000) {
    if (!bankModuleV5) {
        await initBankModuleV5();
    }
    
    if (bankModuleV5) {
        return await bankModuleV5.requestCredit(amount);
    }
    
    return false;
}

async function payoffCreditV5() {
    if (!bankModuleV5) {
        await initBankModuleV5();
    }
    
    if (bankModuleV5) {
        return await bankModuleV5.payoffCredit();
    }
    
    return false;
}

async function transferMoneyV5(recipientIndex, amount) {
    if (!bankModuleV5) {
        await initBankModuleV5();
    }
    
    if (bankModuleV5) {
        return await bankModuleV5.transferMoney(recipientIndex, amount);
    }
    
    return false;
}

function getBankDataV5() {
    if (bankModuleV5) {
        return bankModuleV5.getData();
    }
    return null;
}

// Экспорт функций в глобальную область
window.initBankModuleV5 = initBankModuleV5;
window.openBankV5 = openBankV5;
window.closeBankV5 = closeBankV5;
window.requestCreditV5 = requestCreditV5;
window.payoffCreditV5 = payoffCreditV5;
window.transferMoneyV5 = transferMoneyV5;
window.getBankDataV5 = getBankDataV5;

// Автоматическая инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    initBankModuleV5();
});

console.log('🏦 BankModuleV5 загружен');
