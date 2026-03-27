// Модуль для отображения карточек профессий
class ProfessionCard {
    constructor() {
        this.professions = [];
        this.selectedProfession = null;
        this.professionCardsContainer = document.getElementById('professionCards');
        
        this.init();
    }

    init() {
        console.log('💼 ProfessionCard инициализирован');
        this.loadProfessions();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Слушаем события выбора профессии
        if (window.EventEmitter) {
            window.EventEmitter.on('professionSelected', this.handleProfessionSelected.bind(this));
        }
    }

    // Загрузка данных профессий
    async loadProfessions() {
        try {
            // Пытаемся загрузить из модуля
            if (window.PROFESSIONS) {
                this.professions = window.PROFESSIONS;
            } else {
                // Fallback данные
                this.professions = this.getFallbackProfessions();
            }
            
            console.log('💼 Загружены профессии:', this.professions.length);
            this.renderProfessionCards();
        } catch (error) {
            console.error('❌ Ошибка загрузки профессий:', error);
            this.professions = this.getFallbackProfessions();
            this.renderProfessionCards();
        }
    }

    // Fallback данные профессий
    getFallbackProfessions() {
        return [
            {
                id: 'entrepreneur',
                name: 'Предприниматель',
                description: 'Владелец бизнеса',
                salary: 10000,
                expenses: 6200,
                cashFlow: 3800,
                color: '#00ff96',
                icon: '🚀',
                details: {
                    taxes: 1300,
                    otherExpenses: 1500,
                    carLoan: 700,
                    carLoanPrincipal: 14000,
                    educationLoan: 500,
                    educationLoanPrincipal: 10000,
                    mortgage: 1200,
                    mortgagePrincipal: 240000,
                    creditCards: 1000,
                    creditCardsPrincipal: 20000,
                    totalDebt: 284000
                }
            },
            {
                id: 'doctor',
                name: 'Врач',
                description: 'Специалист в области медицины',
                salary: 8000,
                expenses: 4500,
                cashFlow: 3500,
                color: '#ff6b6b',
                icon: '👨‍⚕️',
                details: {
                    taxes: 1040,
                    otherExpenses: 1200,
                    carLoan: 500,
                    carLoanPrincipal: 10000,
                    educationLoan: 800,
                    educationLoanPrincipal: 16000,
                    mortgage: 1000,
                    mortgagePrincipal: 200000,
                    creditCards: 960,
                    creditCardsPrincipal: 19200,
                    totalDebt: 245200
                }
            },
            {
                id: 'engineer',
                name: 'Инженер',
                description: 'Специалист по техническим решениям',
                salary: 7500,
                expenses: 4000,
                cashFlow: 3500,
                color: '#00bfff',
                icon: '⚙️',
                details: {
                    taxes: 975,
                    otherExpenses: 1000,
                    carLoan: 450,
                    carLoanPrincipal: 9000,
                    educationLoan: 600,
                    educationLoanPrincipal: 12000,
                    mortgage: 975,
                    mortgagePrincipal: 195000,
                    creditCards: 1000,
                    creditCardsPrincipal: 20000,
                    totalDebt: 236000
                }
            },
            {
                id: 'teacher',
                name: 'Учитель',
                description: 'Преподаватель в образовательном учреждении',
                salary: 5000,
                expenses: 3000,
                cashFlow: 2000,
                color: '#ffd93d',
                icon: '👨‍🏫',
                details: {
                    taxes: 650,
                    otherExpenses: 800,
                    carLoan: 300,
                    carLoanPrincipal: 6000,
                    educationLoan: 400,
                    educationLoanPrincipal: 8000,
                    mortgage: 850,
                    mortgagePrincipal: 170000,
                    creditCards: 500,
                    creditCardsPrincipal: 10000,
                    totalDebt: 194000
                }
            },
            {
                id: 'lawyer',
                name: 'Юрист',
                description: 'Специалист по правовым вопросам',
                salary: 9000,
                expenses: 5000,
                cashFlow: 4000,
                color: '#9f7aea',
                icon: '⚖️',
                details: {
                    taxes: 1170,
                    otherExpenses: 1400,
                    carLoan: 650,
                    carLoanPrincipal: 13000,
                    educationLoan: 900,
                    educationLoanPrincipal: 18000,
                    mortgage: 880,
                    mortgagePrincipal: 176000,
                    creditCards: 1000,
                    creditCardsPrincipal: 20000,
                    totalDebt: 227000
                }
            }
        ];
    }

    // Рендер карточек профессий
    renderProfessionCards() {
        if (!this.professionCardsContainer) return;

        this.professionCardsContainer.innerHTML = '';

        this.professions.forEach(profession => {
            const cardElement = this.createProfessionCard(profession);
            this.professionCardsContainer.appendChild(cardElement);
        });
    }

    // Создание карточки профессии
    createProfessionCard(profession) {
        const card = document.createElement('div');
        card.className = 'profession-card';
        card.dataset.professionId = profession.id;

        // Рассчитываем детали
        const details = profession.details || {};
        const totalDebt = details.totalDebt || 0;

        card.innerHTML = `
            <div class="profession-header">
                <div class="profession-icon" style="background: ${profession.color}20; color: ${profession.color}">
                    ${profession.icon}
                </div>
                <div class="profession-info">
                    <h4 class="profession-name">${profession.name}</h4>
                    <p class="profession-description">${profession.description}</p>
                </div>
            </div>
            
            <div class="profession-summary">
                <div class="summary-item salary">
                    <span class="amount" style="color: #48bb78">$${profession.salary.toLocaleString()}</span>
                    <span class="label">Зарплата</span>
                </div>
                <div class="summary-item expenses">
                    <span class="amount" style="color: #ed8936">$${profession.expenses.toLocaleString()}</span>
                    <span class="label">Расходы</span>
                </div>
                <div class="summary-item cash-flow">
                    <span class="amount" style="color: #48bb78">$${profession.cashFlow.toLocaleString()}</span>
                    <span class="label">Денежный поток</span>
                </div>
            </div>

            <div class="profession-details">
                <div class="detail-item">
                    <span class="detail-label">Налоги:</span>
                    <span class="detail-value">$${details.taxes?.toLocaleString() || 0} (13%)</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Прочие расходы:</span>
                    <span class="detail-value">$${details.otherExpenses?.toLocaleString() || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Кредит на авто:</span>
                    <span class="detail-value">$${details.carLoan?.toLocaleString() || 0}</span>
                    <span class="detail-principal">$${details.carLoanPrincipal?.toLocaleString() || 0} (тело)</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Образовательный кредит:</span>
                    <span class="detail-value">$${details.educationLoan?.toLocaleString() || 0}</span>
                    <span class="detail-principal">$${details.educationLoanPrincipal?.toLocaleString() || 0} (тело)</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Ипотека:</span>
                    <span class="detail-value">$${details.mortgage?.toLocaleString() || 0}</span>
                    <span class="detail-principal">$${details.mortgagePrincipal?.toLocaleString() || 0} (тело)</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Кредитные карты:</span>
                    <span class="detail-value">$${details.creditCards?.toLocaleString() || 0}</span>
                    <span class="detail-principal">$${details.creditCardsPrincipal?.toLocaleString() || 0} (тело)</span>
                </div>
                <div class="detail-item total-debt">
                    <span class="detail-label">Итого тело кредитов:</span>
                    <span class="detail-value">$${totalDebt.toLocaleString()}</span>
                </div>
            </div>

            <div class="profession-actions">
                <button class="btn-profession business" data-profession-id="${profession.id}">
                    Business
                </button>
                <button class="btn-profession complex" data-profession-id="${profession.id}">
                    Сложный
                </button>
            </div>
        `;

        // Добавляем обработчики событий
        const buttons = card.querySelectorAll('.btn-profession');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                this.selectProfession(profession, button.classList.contains('complex'));
            });
        });

        return card;
    }

    // Выбор профессии
    selectProfession(profession, isComplex = false) {
        this.selectedProfession = profession;
        console.log('💼 Выбрана профессия:', profession.name, isComplex ? '(Сложная)' : '(Бизнес)');

        // Обновляем визуальное состояние
        this.updateProfessionSelection(profession.id);

        // Эмитим событие
        if (window.EventEmitter) {
            window.EventEmitter.emit('professionSelected', {
                profession: profession,
                isComplex: isComplex
            });
        }

        // Обновляем данные игрока
        if (window.playersManager) {
            const currentPlayer = window.playersManager.getCurrentPlayer();
            if (currentPlayer) {
                window.playersManager.updatePlayer(currentPlayer.id, {
                    profession: profession,
                    cash: profession.cashFlow,
                    income: profession.salary,
                    expenses: profession.expenses
                });
            }
        }
    }

    // Обновление визуального состояния выбора
    updateProfessionSelection(professionId) {
        const cards = this.professionCardsContainer.querySelectorAll('.profession-card');
        cards.forEach(card => {
            card.classList.remove('selected');
            if (card.dataset.professionId === professionId) {
                card.classList.add('selected');
            }
        });
    }

    // Обработчик выбора профессии
    handleProfessionSelected(data) {
        console.log('💼 Обработка выбора профессии:', data);
    }

    // Получить выбранную профессию
    getSelectedProfession() {
        return this.selectedProfession;
    }

    // Получить все профессии
    getProfessions() {
        return [...this.professions];
    }
}

// CSS стили для карточек профессий
const professionCardStyles = `
    .profession-card {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 16px;
        transition: all 0.3s ease;
        cursor: pointer;
        position: relative;
        overflow: hidden;
    }

    .profession-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .profession-card.selected {
        border-color: #48bb78;
        background: linear-gradient(135deg, rgba(72, 187, 120, 0.1) 0%, rgba(72, 187, 120, 0.05) 100%);
    }

    .profession-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
    }

    .profession-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
    }

    .profession-info {
        flex: 1;
    }

    .profession-name {
        font-size: 18px;
        font-weight: 700;
        color: #e2e8f0;
        margin: 0 0 4px 0;
    }

    .profession-description {
        font-size: 14px;
        color: #a0aec0;
        margin: 0;
    }

    .profession-summary {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 16px;
        margin-bottom: 20px;
    }

    .summary-item {
        text-align: center;
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
    }

    .summary-item .amount {
        display: block;
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 4px;
    }

    .summary-item .label {
        font-size: 12px;
        color: #a0aec0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .profession-details {
        margin-bottom: 20px;
    }

    .detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .detail-item:last-child {
        border-bottom: none;
    }

    .detail-item.total-debt {
        font-weight: 700;
        background: rgba(255, 255, 255, 0.05);
        padding: 12px;
        border-radius: 8px;
        margin-top: 8px;
    }

    .detail-label {
        color: #a0aec0;
        font-size: 14px;
    }

    .detail-value {
        color: #e2e8f0;
        font-weight: 600;
    }

    .detail-principal {
        color: #9f7aea;
        font-size: 12px;
        margin-left: 8px;
    }

    .profession-actions {
        display: flex;
        gap: 8px;
    }

    .btn-profession {
        flex: 1;
        padding: 12px 16px;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .btn-profession.business {
        background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
        color: white;
    }

    .btn-profession.complex {
        background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
        color: white;
    }

    .btn-profession:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
`;

// Добавляем стили в документ
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = professionCardStyles;
    document.head.appendChild(styleSheet);
}

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
    window.ProfessionCard = ProfessionCard;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('💼 ProfessionCard: DOM loaded, initializing...');
    if (!window.professionCard) {
        console.log('💼 ProfessionCard: Creating new instance...');
        window.professionCard = new ProfessionCard();
    } else {
        console.log('💼 ProfessionCard: Already exists, skipping initialization');
    }
});
