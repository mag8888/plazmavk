// Модуль управления сделками
class DealsManager {
    constructor() {
        this.deals = {
            big: [],      // Большие сделки
            small: [],    // Малые сделки
            market: [],   // Рынок
            expenses: []  // Расходы
        };
        this.currentDealType = 'big';
        this.dealsContent = document.getElementById('dealsContent');
        this.dealTabs = document.querySelectorAll('.deal-tab');
        
        this.init();
    }

    init() {
        console.log('📝 DealsManager инициализирован');
        this.setupEventListeners();
        this.loadDealsData();
        this.renderDeals();
    }

    setupEventListeners() {
        // Обработчики для табов
        this.dealTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchDealType(tab.dataset.dealType);
            });
        });

        // Слушаем события от других модулей
        if (window.EventEmitter) {
            window.EventEmitter.on('dealSelected', this.handleDealSelected.bind(this));
        }
    }

    // Переключение типа сделок
    switchDealType(dealType) {
        this.currentDealType = dealType;
        console.log('📝 Переключение на тип сделок:', dealType);

        // Обновляем активный таб
        this.dealTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.dealType === dealType) {
                tab.classList.add('active');
            }
        });

        this.renderDeals();
    }

    // Загрузка данных сделок
    loadDealsData() {
        // Большие сделки (премиум возможности)
        this.deals.big = [
            {
                id: 1,
                name: 'Отель на берегу моря',
                description: 'Купить отель на берегу моря',
                cost: 500000,
                income: 25000,
                type: 'real_estate',
                icon: '🏨'
            },
            {
                id: 2,
                name: 'Сеть ресторанов',
                description: 'Франшиза популярной сети ресторанов',
                cost: 300000,
                income: 18000,
                type: 'business',
                icon: '🍽️'
            },
            {
                id: 3,
                name: 'Технологический стартап',
                description: 'Инвестиции в технологический стартап',
                cost: 200000,
                income: 15000,
                type: 'technology',
                icon: '💻'
            },
            {
                id: 4,
                name: 'Горнолыжный курорт',
                description: 'Покупка горнолыжного курорта',
                cost: 800000,
                income: 40000,
                type: 'real_estate',
                icon: '⛷️'
            }
        ];

        // Малые сделки (стартовые инвестиции)
        this.deals.small = [
            {
                id: 1,
                name: 'Кофейня',
                description: 'Открыть небольшую кофейню',
                cost: 50000,
                income: 3000,
                type: 'business',
                icon: '☕'
            },
            {
                id: 2,
                name: 'Автомойка',
                description: 'Автомойка самообслуживания',
                cost: 75000,
                income: 4000,
                type: 'business',
                icon: '🚗'
            },
            {
                id: 3,
                name: 'Магазин одежды',
                description: 'Бутик одежды в торговом центре',
                cost: 60000,
                income: 3500,
                type: 'retail',
                icon: '👕'
            },
            {
                id: 4,
                name: 'Салон красоты',
                description: 'Салон красоты и барбершоп',
                cost: 40000,
                income: 2500,
                type: 'service',
                icon: '💄'
            }
        ];

        // Рынок (специальные предложения)
        this.deals.market = [
            {
                id: 1,
                name: 'Акции Apple',
                description: 'Покупка акций Apple',
                cost: 10000,
                income: 500,
                type: 'stocks',
                icon: '📈'
            },
            {
                id: 2,
                name: 'Золото',
                description: 'Инвестиции в золото',
                cost: 15000,
                income: 750,
                type: 'commodities',
                icon: '🥇'
            },
            {
                id: 3,
                name: 'Криптовалюта',
                description: 'Покупка Bitcoin',
                cost: 20000,
                income: 1000,
                type: 'crypto',
                icon: '₿'
            },
            {
                id: 4,
                name: 'Облигации',
                description: 'Государственные облигации',
                cost: 8000,
                income: 400,
                type: 'bonds',
                icon: '📋'
            }
        ];

        // Расходы (обязательные платежи)
        this.deals.expenses = [
            {
                id: 1,
                name: 'Налоги',
                description: 'Подоходный налог 13%',
                cost: 1300,
                type: 'tax',
                icon: '📊'
            },
            {
                id: 2,
                name: 'Медицинская страховка',
                description: 'Ежемесячная медицинская страховка',
                cost: 500,
                type: 'insurance',
                icon: '🏥'
            },
            {
                id: 3,
                name: 'Автомобильная страховка',
                description: 'Страховка автомобиля',
                cost: 300,
                type: 'insurance',
                icon: '🚙'
            },
            {
                id: 4,
                name: 'Жилищно-коммунальные услуги',
                description: 'ЖКХ и коммунальные платежи',
                cost: 800,
                type: 'utilities',
                icon: '🏠'
            }
        ];

        console.log('📝 Загружены данные сделок:', {
            big: this.deals.big.length,
            small: this.deals.small.length,
            market: this.deals.market.length,
            expenses: this.deals.expenses.length
        });
    }

    // Рендер сделок
    renderDeals() {
        if (!this.dealsContent) return;

        const currentDeals = this.deals[this.currentDealType];
        if (!currentDeals) {
            this.dealsContent.innerHTML = '<div class="no-deals">Нет доступных сделок</div>';
            return;
        }

        this.dealsContent.innerHTML = '';

        currentDeals.forEach(deal => {
            const dealElement = this.createDealElement(deal);
            this.dealsContent.appendChild(dealElement);
        });
    }

    // Создание элемента сделки
    createDealElement(deal) {
        const div = document.createElement('div');
        div.className = 'deal-card';
        div.dataset.dealId = deal.id;

        // Определяем тип сделки для стилизации
        const dealTypeClass = this.getDealTypeClass(deal.type);
        div.classList.add(dealTypeClass);

        div.innerHTML = `
            <div class="deal-header">
                <div class="deal-icon">${deal.icon}</div>
                <div class="deal-info">
                    <h4 class="deal-name">${deal.name}</h4>
                    <p class="deal-description">${deal.description}</p>
                </div>
            </div>
            
            <div class="deal-details">
                <div class="deal-cost">
                    <span class="cost-label">Стоимость:</span>
                    <span class="cost-value">$${deal.cost.toLocaleString()}</span>
                </div>
                ${deal.income ? `
                    <div class="deal-income">
                        <span class="income-label">Доход:</span>
                        <span class="income-value">$${deal.income.toLocaleString()}/мес</span>
                    </div>
                ` : ''}
            </div>

            <div class="deal-actions">
                <button class="btn-deal buy" data-deal-id="${deal.id}">
                    ${deal.type === 'expense' ? 'Оплатить' : 'Купить'}
                </button>
                <button class="btn-deal info" data-deal-id="${deal.id}">
                    Подробнее
                </button>
            </div>
        `;

        // Добавляем обработчики событий
        const buyButton = div.querySelector('.btn-deal.buy');
        const infoButton = div.querySelector('.btn-deal.info');

        buyButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectDeal(deal);
        });

        infoButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showDealInfo(deal);
        });

        return div;
    }

    // Получение класса типа сделки
    getDealTypeClass(type) {
        const typeClasses = {
            'real_estate': 'deal-real-estate',
            'business': 'deal-business',
            'technology': 'deal-technology',
            'retail': 'deal-retail',
            'service': 'deal-service',
            'stocks': 'deal-stocks',
            'commodities': 'deal-commodities',
            'crypto': 'deal-crypto',
            'bonds': 'deal-bonds',
            'tax': 'deal-tax',
            'insurance': 'deal-insurance',
            'utilities': 'deal-utilities'
        };
        return typeClasses[type] || 'deal-default';
    }

    // Выбор сделки
    selectDeal(deal) {
        console.log('📝 Выбрана сделка:', deal.name);

        // Проверяем возможность покупки
        if (window.playersManager) {
            const currentPlayer = window.playersManager.getCurrentPlayer();
            if (currentPlayer && currentPlayer.cash >= deal.cost) {
                // Эмитим событие выбора сделки
                if (window.EventEmitter) {
                    window.EventEmitter.emit('dealSelected', {
                        deal: deal,
                        player: currentPlayer
                    });
                }

                // Обновляем данные игрока
                this.processDeal(deal, currentPlayer);
            } else {
                this.showError('Недостаточно средств для покупки');
            }
        }
    }

    // Обработка сделки
    processDeal(deal, player) {
        if (deal.type === 'expense') {
            // Расходы - просто списываем деньги
            window.playersManager.updatePlayer(player.id, {
                cash: player.cash - deal.cost
            });
            this.showSuccess(`Оплачено: ${deal.name} - $${deal.cost}`);
        } else {
            // Инвестиции - списываем деньги и добавляем доход
            const newCash = player.cash - deal.cost;
            const newIncome = player.income + (deal.income || 0);
            
            window.playersManager.updatePlayer(player.id, {
                cash: newCash,
                income: newIncome,
                assets: player.assets + deal.cost
            });
            
            this.showSuccess(`Куплено: ${deal.name} за $${deal.cost}`);
        }
    }

    // Показать информацию о сделке
    showDealInfo(deal) {
        console.log('📝 Информация о сделке:', deal);
        
        // Создаем модальное окно с подробной информацией
        const modal = document.createElement('div');
        modal.className = 'deal-info-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${deal.name}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="deal-icon-large">${deal.icon}</div>
                    <p class="deal-description">${deal.description}</p>
                    <div class="deal-stats">
                        <div class="stat">
                            <span class="stat-label">Стоимость:</span>
                            <span class="stat-value">$${deal.cost.toLocaleString()}</span>
                        </div>
                        ${deal.income ? `
                            <div class="stat">
                                <span class="stat-label">Доход:</span>
                                <span class="stat-value">$${deal.income.toLocaleString()}/мес</span>
                            </div>
                        ` : ''}
                        <div class="stat">
                            <span class="stat-label">Тип:</span>
                            <span class="stat-value">${this.getDealTypeName(deal.type)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики для закрытия модального окна
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Получение названия типа сделки
    getDealTypeName(type) {
        const typeNames = {
            'real_estate': 'Недвижимость',
            'business': 'Бизнес',
            'technology': 'Технологии',
            'retail': 'Розничная торговля',
            'service': 'Услуги',
            'stocks': 'Акции',
            'commodities': 'Сырье',
            'crypto': 'Криптовалюта',
            'bonds': 'Облигации',
            'tax': 'Налоги',
            'insurance': 'Страхование',
            'utilities': 'Коммунальные услуги'
        };
        return typeNames[type] || 'Прочее';
    }

    // Обработчик выбора сделки
    handleDealSelected(data) {
        console.log('📝 Обработка выбора сделки:', data);
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

    // Получить сделки по типу
    getDeals(type) {
        return this.deals[type] || [];
    }

    // Получить все сделки
    getAllDeals() {
        return this.deals;
    }
}

// CSS стили для модуля сделок
const dealsManagerStyles = `
    .deal-card {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        transition: all 0.3s ease;
        cursor: pointer;
    }

    .deal-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .deal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .deal-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
    }

    .deal-info {
        flex: 1;
    }

    .deal-name {
        font-size: 16px;
        font-weight: 600;
        color: #e2e8f0;
        margin: 0 0 4px 0;
    }

    .deal-description {
        font-size: 14px;
        color: #a0aec0;
        margin: 0;
    }

    .deal-details {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        padding: 8px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .deal-cost, .deal-income {
        text-align: center;
    }

    .cost-label, .income-label {
        display: block;
        font-size: 12px;
        color: #a0aec0;
        margin-bottom: 4px;
    }

    .cost-value {
        font-size: 16px;
        font-weight: 700;
        color: #ed8936;
    }

    .income-value {
        font-size: 16px;
        font-weight: 700;
        color: #48bb78;
    }

    .deal-actions {
        display: flex;
        gap: 8px;
    }

    .btn-deal {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .btn-deal.buy {
        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        color: white;
    }

    .btn-deal.info {
        background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
        color: white;
    }

    .btn-deal:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .no-deals {
        text-align: center;
        color: #a0aec0;
        padding: 40px 20px;
        font-style: italic;
    }

    /* Модальное окно для информации о сделке */
    .deal-info-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
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
        color: #e2e8f0;
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

    .modal-body {
        text-align: center;
    }

    .deal-icon-large {
        font-size: 48px;
        margin-bottom: 16px;
    }

    .deal-stats {
        margin-top: 16px;
    }

    .stat {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .stat:last-child {
        border-bottom: none;
    }

    .stat-label {
        color: #a0aec0;
    }

    .stat-value {
        color: #e2e8f0;
        font-weight: 600;
    }
`;

// Добавляем стили в документ
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = dealsManagerStyles;
    document.head.appendChild(styleSheet);
}

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
    window.DealsManager = DealsManager;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('📝 DealsManager: DOM loaded, initializing...');
    if (!window.dealsManager) {
        console.log('📝 DealsManager: Creating new instance...');
        window.dealsManager = new DealsManager();
    } else {
        console.log('📝 DealsManager: Already exists, skipping initialization');
    }
});
