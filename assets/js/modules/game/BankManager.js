// Модуль управления банковскими операциями
class BankManager {
    constructor() {
        this.bankModal = null;
        this.currentPlayer = null;
        this.bankBtn = document.getElementById('bankBtn');
        
        this.init();
    }

    init() {
        console.log('🏦 BankManager инициализирован');
        this.setupEventListeners();
        this.createBankModal();
    }

    setupEventListeners() {
        // Обработчик кнопки банка
        if (this.bankBtn) {
            this.bankBtn.addEventListener('click', () => {
                // Используем банковский модуль v4
                if (typeof window.openBankV4 === 'function') {
                    window.openBankV4();
                } else {
                    console.error('BankModuleV4 не доступен! Убедитесь, что модуль загружен.');
                }
            });
        }

        // Слушаем события от других модулей
        if (window.EventEmitter) {
            window.EventEmitter.on('playerChanged', this.handlePlayerChanged.bind(this));
        }
    }

    // Создание модального окна банка
    createBankModal() {
        this.bankModal = document.createElement('div');
        this.bankModal.className = 'bank-modal';
        this.bankModal.innerHTML = `
            <div class="bank-modal-content">
                <div class="bank-header">
                    <h2>🏦 Банковские операции</h2>
                    <button class="bank-close">&times;</button>
                </div>
                
                <div class="bank-body">
                    <div class="player-financial-info">
                        <div class="info-item">
                            <span class="info-label">Доход:</span>
                            <span class="info-value income" id="bankIncome">$0</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Расходы:</span>
                            <span class="info-value expenses" id="bankExpenses">$0</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">PAYDAY:</span>
                            <span class="info-value payday" id="bankPayday">$0/мес</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Кредит:</span>
                            <span class="info-value credit" id="bankCredit">$0</span>
                        </div>
                    </div>

                    <div class="bank-operations">
                        <div class="operation-section">
                            <h3>💳 Кредиты</h3>
                            <div class="credit-options">
                                <button class="btn-credit" data-type="personal">Личный кредит</button>
                                <button class="btn-credit" data-type="business">Бизнес кредит</button>
                                <button class="btn-credit" data-type="mortgage">Ипотека</button>
                                <button class="btn-credit" data-type="auto">Автокредит</button>
                            </div>
                        </div>

                        <div class="operation-section">
                            <h3>💰 Инвестиции</h3>
                            <div class="investment-options">
                                <button class="btn-investment" data-type="stocks">Акции</button>
                                <button class="btn-investment" data-type="bonds">Облигации</button>
                                <button class="btn-investment" data-type="real-estate">Недвижимость</button>
                                <button class="btn-investment" data-type="crypto">Криптовалюта</button>
                            </div>
                        </div>

                        <div class="operation-section">
                            <h3>📊 Отчеты</h3>
                            <div class="report-options">
                                <button class="btn-report" data-type="balance">Баланс</button>
                                <button class="btn-report" data-type="income">Доходы</button>
                                <button class="btn-report" data-type="expenses">Расходы</button>
                                <button class="btn-report" data-type="assets">Активы</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bank-footer">
                    <button class="btn-bank-close">Закрыть</button>
                </div>
            </div>
        `;

        // Добавляем обработчики событий
        this.setupBankModalEvents();
        
        // Добавляем в документ (скрыто)
        document.body.appendChild(this.bankModal);
    }

    // Настройка обработчиков событий модального окна
    setupBankModalEvents() {
        const closeBtn = this.bankModal.querySelector('.bank-close');
        const closeFooterBtn = this.bankModal.querySelector('.btn-bank-close');

        closeBtn.addEventListener('click', () => this.closeBankModal());
        closeFooterBtn.addEventListener('click', () => this.closeBankModal());
        
        this.bankModal.addEventListener('click', (e) => {
            if (e.target === this.bankModal) {
                this.closeBankModal();
            }
        });

        // Обработчики для кредитов
        const creditButtons = this.bankModal.querySelectorAll('.btn-credit');
        creditButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.processCredit(btn.dataset.type);
            });
        });

        // Обработчики для инвестиций
        const investmentButtons = this.bankModal.querySelectorAll('.btn-investment');
        investmentButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.processInvestment(btn.dataset.type);
            });
        });

        // Обработчики для отчетов
        const reportButtons = this.bankModal.querySelectorAll('.btn-report');
        reportButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.generateReport(btn.dataset.type);
            });
        });
    }

    // Открытие модального окна банка
    openBankModal() {
        if (!this.bankModal) return;

        this.updatePlayerInfo();
        this.bankModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        console.log('🏦 Открыто модальное окно банка');
    }

    // Закрытие модального окна банка
    closeBankModal() {
        if (!this.bankModal) return;

        this.bankModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        console.log('🏦 Закрыто модальное окно банка');
    }

    // Обновление информации о игроке
    updatePlayerInfo() {
        if (!window.playersManager) return;

        this.currentPlayer = window.playersManager.getCurrentPlayer();
        if (!this.currentPlayer) return;

        const income = this.currentPlayer.income || 0;
        const expenses = this.currentPlayer.expenses || 0;
        const payday = income - expenses;
        const credit = this.currentPlayer.credit || 0;

        // Обновляем значения в модальном окне
        const incomeElement = this.bankModal.querySelector('#bankIncome');
        const expensesElement = this.bankModal.querySelector('#bankExpenses');
        const paydayElement = this.bankModal.querySelector('#bankPayday');
        const creditElement = this.bankModal.querySelector('#bankCredit');

        if (incomeElement) incomeElement.textContent = `$${income.toLocaleString()}`;
        if (expensesElement) expensesElement.textContent = `$${expenses.toLocaleString()}`;
        if (paydayElement) paydayElement.textContent = `$${payday.toLocaleString()}/мес`;
        if (creditElement) creditElement.textContent = `$${credit.toLocaleString()}`;
    }

    // Обработка кредитов
    processCredit(creditType) {
        console.log('💳 Обработка кредита:', creditType);

        const creditOptions = {
            personal: { amount: 50000, rate: 15, term: 36 },
            business: { amount: 100000, rate: 12, term: 60 },
            mortgage: { amount: 300000, rate: 8, term: 240 },
            auto: { amount: 30000, rate: 10, term: 48 }
        };

        const option = creditOptions[creditType];
        if (!option) return;

        const monthlyPayment = this.calculateMonthlyPayment(option.amount, option.rate, option.term);
        
        this.showCreditModal(creditType, option, monthlyPayment);
    }

    // Обработка инвестиций
    processInvestment(investmentType) {
        console.log('💰 Обработка инвестиции:', investmentType);

        const investmentOptions = {
            stocks: { minAmount: 1000, expectedReturn: 12, risk: 'high' },
            bonds: { minAmount: 5000, expectedReturn: 6, risk: 'low' },
            'real-estate': { minAmount: 50000, expectedReturn: 8, risk: 'medium' },
            crypto: { minAmount: 500, expectedReturn: 20, risk: 'very-high' }
        };

        const option = investmentOptions[investmentType];
        if (!option) return;

        this.showInvestmentModal(investmentType, option);
    }

    // Генерация отчетов
    generateReport(reportType) {
        console.log('📊 Генерация отчета:', reportType);

        if (!this.currentPlayer) {
            this.showError('Нет данных о игроке');
            return;
        }

        let reportData = {};
        
        switch (reportType) {
            case 'balance':
                reportData = {
                    title: 'Баланс',
                    data: {
                        'Наличные': `$${this.currentPlayer.cash || 0}`,
                        'Активы': `$${this.currentPlayer.assets || 0}`,
                        'Кредиты': `$${this.currentPlayer.credit || 0}`,
                        'Чистый капитал': `$${(this.currentPlayer.cash || 0) + (this.currentPlayer.assets || 0) - (this.currentPlayer.credit || 0)}`
                    }
                };
                break;
            case 'income':
                reportData = {
                    title: 'Доходы',
                    data: {
                        'Зарплата': `$${this.currentPlayer.income || 0}/мес`,
                        'Доходы от инвестиций': `$${this.currentPlayer.investmentIncome || 0}/мес`,
                        'Общий доход': `$${(this.currentPlayer.income || 0) + (this.currentPlayer.investmentIncome || 0)}/мес`
                    }
                };
                break;
            case 'expenses':
                reportData = {
                    title: 'Расходы',
                    data: {
                        'Обязательные расходы': `$${this.currentPlayer.expenses || 0}/мес`,
                        'Кредитные платежи': `$${this.currentPlayer.creditPayments || 0}/мес`,
                        'Общие расходы': `$${(this.currentPlayer.expenses || 0) + (this.currentPlayer.creditPayments || 0)}/мес`
                    }
                };
                break;
            case 'assets':
                reportData = {
                    title: 'Активы',
                    data: {
                        'Недвижимость': `$${this.currentPlayer.realEstate || 0}`,
                        'Бизнес': `$${this.currentPlayer.business || 0}`,
                        'Инвестиции': `$${this.currentPlayer.investments || 0}`,
                        'Общие активы': `$${this.currentPlayer.assets || 0}`
                    }
                };
                break;
        }

        this.showReportModal(reportData);
    }

    // Расчет ежемесячного платежа по кредиту
    calculateMonthlyPayment(amount, rate, term) {
        const monthlyRate = rate / 100 / 12;
        const monthlyPayment = amount * (monthlyRate * Math.pow(1 + monthlyRate, term)) / 
                              (Math.pow(1 + monthlyRate, term) - 1);
        return Math.round(monthlyPayment);
    }

    // Показать модальное окно кредита
    showCreditModal(creditType, option, monthlyPayment) {
        const modal = document.createElement('div');
        modal.className = 'credit-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>💳 ${this.getCreditTypeName(creditType)}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="credit-details">
                        <div class="detail-item">
                            <span>Сумма кредита:</span>
                            <span>$${option.amount.toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <span>Процентная ставка:</span>
                            <span>${option.rate}% годовых</span>
                        </div>
                        <div class="detail-item">
                            <span>Срок кредита:</span>
                            <span>${option.term} месяцев</span>
                        </div>
                        <div class="detail-item total">
                            <span>Ежемесячный платеж:</span>
                            <span>$${monthlyPayment.toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-confirm">Оформить кредит</button>
                        <button class="btn-cancel">Отмена</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики событий
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const confirmBtn = modal.querySelector('.btn-confirm');

        closeBtn.addEventListener('click', () => modal.remove());
        cancelBtn.addEventListener('click', () => modal.remove());
        confirmBtn.addEventListener('click', () => {
            this.confirmCredit(creditType, option, monthlyPayment);
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Подтверждение кредита
    confirmCredit(creditType, option, monthlyPayment) {
        if (!this.currentPlayer) return;

        // Обновляем данные игрока
        const newCash = this.currentPlayer.cash + option.amount;
        const newCredit = this.currentPlayer.credit + option.amount;
        const newCreditPayments = (this.currentPlayer.creditPayments || 0) + monthlyPayment;

        window.playersManager.updatePlayer(this.currentPlayer.id, {
            cash: newCash,
            credit: newCredit,
            creditPayments: newCreditPayments
        });

        this.showSuccess(`Кредит оформлен: $${option.amount.toLocaleString()}`);
    }

    // Показать модальное окно инвестиций
    showInvestmentModal(investmentType, option) {
        console.log('💰 Показ модального окна инвестиций:', investmentType, option);
        // Здесь можно добавить логику для инвестиций
    }

    // Показать модальное окно отчета
    showReportModal(reportData) {
        const modal = document.createElement('div');
        modal.className = 'report-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📊 ${reportData.title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="report-details">
                        ${Object.entries(reportData.data).map(([key, value]) => `
                            <div class="report-item">
                                <span class="report-label">${key}:</span>
                                <span class="report-value">${value}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-actions">
                        <button class="btn-close">Закрыть</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики событий
        const closeBtn = modal.querySelector('.modal-close');
        const closeActionBtn = modal.querySelector('.btn-close');

        closeBtn.addEventListener('click', () => modal.remove());
        closeActionBtn.addEventListener('click', () => modal.remove());

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Получение названия типа кредита
    getCreditTypeName(creditType) {
        const names = {
            personal: 'Личный кредит',
            business: 'Бизнес кредит',
            mortgage: 'Ипотека',
            auto: 'Автокредит'
        };
        return names[creditType] || creditType;
    }

    // Обработчик изменения игрока
    handlePlayerChanged(player) {
        this.currentPlayer = player;
        if (this.bankModal && this.bankModal.style.display === 'flex') {
            this.updatePlayerInfo();
        }
    }

    // Показать сообщение об успехе
    showSuccess(message) {
        console.log('✅', message);
        // Здесь можно добавить toast-уведомления
    }

    // Показать ошибку
    showError(message) {
        console.error('❌', message);
        // Здесь можно добавить toast-уведомления
    }
}

// CSS стили для банковского модуля
const bankManagerStyles = `
    .bank-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }

    .bank-modal-content {
        background: linear-gradient(160deg, #151d30 0%, #111527 45%, #0f1422 100%);
        border-radius: 24px;
        padding: 32px;
        box-shadow: 0 40px 120px rgba(0, 0, 0, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        position: relative;
    }

    .bank-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .bank-header h2 {
        color: #f3f4f6;
        margin: 0;
        font-size: 24px;
    }

    .bank-close {
        background: none;
        border: none;
        color: #a0aec0;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.3s ease;
    }

    .bank-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #f3f4f6;
    }

    .player-financial-info {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
        padding: 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .info-item {
        text-align: center;
    }

    .info-label {
        display: block;
        font-size: 12px;
        color: #a0aec0;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .info-value {
        display: block;
        font-size: 18px;
        font-weight: 700;
    }

    .info-value.income { color: #48bb78; }
    .info-value.expenses { color: #ed8936; }
    .info-value.payday { color: #48bb78; }
    .info-value.credit { color: #e53e3e; }

    .bank-operations {
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    .operation-section h3 {
        color: #f3f4f6;
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
    }

    .credit-options, .investment-options, .report-options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
    }

    .btn-credit, .btn-investment, .btn-report {
        padding: 12px 16px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        text-align: center;
    }

    .btn-credit {
        background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
        color: white;
    }

    .btn-investment {
        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        color: white;
    }

    .btn-report {
        background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
        color: white;
    }

    .btn-credit:hover, .btn-investment:hover, .btn-report:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .bank-footer {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        text-align: center;
    }

    .btn-bank-close {
        padding: 12px 24px;
        background: linear-gradient(135deg, #718096 0%, #4a5568 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .btn-bank-close:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    /* Модальные окна для кредитов и отчетов */
    .credit-modal, .report-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1001;
    }

    .modal-content {
        background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .modal-header h3 {
        color: #f3f4f6;
        margin: 0;
    }

    .modal-close {
        background: none;
        border: none;
        color: #a0aec0;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .credit-details, .report-details {
        margin-bottom: 20px;
    }

    .detail-item, .report-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .detail-item:last-child, .report-item:last-child {
        border-bottom: none;
    }

    .detail-item.total {
        font-weight: 700;
        background: rgba(255, 255, 255, 0.05);
        padding: 12px;
        border-radius: 8px;
        margin-top: 8px;
    }

    .report-label {
        color: #a0aec0;
    }

    .report-value {
        color: #f3f4f6;
        font-weight: 600;
    }

    .modal-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
    }

    .btn-confirm, .btn-cancel, .btn-close {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .btn-confirm {
        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        color: white;
    }

    .btn-cancel, .btn-close {
        background: linear-gradient(135deg, #718096 0%, #4a5568 100%);
        color: white;
    }

    .btn-confirm:hover, .btn-cancel:hover, .btn-close:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
`;

// Добавляем стили в документ
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = bankManagerStyles;
    document.head.appendChild(styleSheet);
}

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
    window.BankManager = BankManager;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏦 BankManager: DOM loaded, initializing...');
    if (!window.bankManager) {
        console.log('🏦 BankManager: Creating new instance...');
        window.bankManager = new BankManager();
    } else {
        console.log('🏦 BankManager: Already exists, skipping initialization');
    }
});
