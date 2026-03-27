// UI для отображения карт профессий
// Показывает карты профессий в стиле из примера

class ProfessionUI {
    constructor(professionManager) {
        this.professionManager = professionManager;
        this.container = null;
        this.init();
    }
    
    init() {
        this.createContainer();
        this.render();
    }
    
    // Создание контейнера для профессий
    createContainer() {
        // Ищем существующий контейнер или создаем новый
        this.container = document.getElementById('professionUI');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'professionUI';
            this.container.className = 'profession-ui';
            
            // Добавляем в sidebar или создаем отдельную панель
            const sidebar = document.querySelector('.sidebar') || document.body;
            sidebar.appendChild(this.container);
        }
    }
    
    // Рендеринг UI профессий
    render() {
        if (!this.container) return;
        
        const professions = this.professionManager.getAllProfessions();
        
        this.container.innerHTML = `
            <div class="profession-ui-header">
                <h3>💼 Профессии</h3>
                <button class="btn btn-sm" onclick="professionUI.refresh()">🔄 Обновить</button>
            </div>
            
            <div class="profession-cards">
                ${professions.map(prof => this.renderProfessionCard(prof)).join('')}
            </div>
        `;
    }
    
    // Рендеринг карты профессии
    renderProfessionCard(profession) {
        return `
            <div class="profession-card" data-profession-id="${profession.id}">
                <div class="profession-header">
                    <div class="profession-icon">${profession.icon}</div>
                    <div class="profession-title">
                        <h4>${profession.name}</h4>
                        <p>${profession.description}</p>
                    </div>
                </div>
                
                <div class="financial-summary">
                    <div class="financial-row">
                        <div class="financial-item salary">
                            <div class="financial-value">$${profession.salary.toLocaleString()}</div>
                            <div class="financial-label">Зарплата</div>
                        </div>
                        <div class="financial-item expenses">
                            <div class="financial-value">$${profession.expenses.toLocaleString()}</div>
                            <div class="financial-label">Расходы</div>
                        </div>
                    </div>
                    <div class="financial-row cash-flow">
                        <div class="financial-value">$${profession.cashFlow.toLocaleString()}</div>
                        <div class="financial-label">Денежный поток</div>
                    </div>
                </div>
                
                <div class="expenses-details">
                    <div class="expense-item">
                        <span class="expense-label">Налоги:</span>
                        <span class="expense-value">$${profession.taxes.amount.toLocaleString()} (${profession.taxes.percentage}%)</span>
                    </div>
                    <div class="expense-item">
                        <span class="expense-label">Прочие расходы:</span>
                        <span class="expense-value">$${profession.otherExpenses.toLocaleString()}</span>
                    </div>
                    ${profession.debts.map(debt => `
                        <div class="expense-item">
                            <span class="expense-label">${debt.name}:</span>
                            <span class="expense-value">$${debt.monthly.toLocaleString()}</span>
                            <span class="debt-principal">$${debt.principal.toLocaleString()} (тело)</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="total-debt">
                    <span class="debt-label">Итого тело кредитов</span>
                    <span class="debt-total">$${profession.totalDebt.toLocaleString()}</span>
                </div>
                
                <div class="profession-actions">
                    <button class="btn btn-category" onclick="professionUI.selectProfession('${profession.id}')">
                        ${profession.category}
                    </button>
                    <button class="btn btn-difficulty" onclick="professionUI.showDetails('${profession.id}')">
                        ${profession.difficulty}
                    </button>
                </div>
            </div>
        `;
    }
    
    // Выбор профессии
    selectProfession(professionId) {
        const profession = this.professionManager.getProfessionById(professionId);
        if (profession) {
            console.log('🎯 ProfessionUI: Selected profession:', profession.name);
            
            // Здесь должна быть логика выбора профессии
            this.showProfessionModal(profession);
        }
    }
    
    // Показ деталей профессии
    showDetails(professionId) {
        const profession = this.professionManager.getProfessionById(professionId);
        if (profession) {
            this.showProfessionModal(profession);
        }
    }
    
    // Показ модального окна профессии
    showProfessionModal(profession) {
        const modal = document.createElement('div');
        modal.className = 'profession-modal';
        modal.innerHTML = `
            <div class="profession-modal-content">
                <div class="profession-modal-header">
                    <h3>${profession.name}</h3>
                    <button class="profession-modal-close" onclick="this.closest('.profession-modal').remove()">×</button>
                </div>
                <div class="profession-modal-body">
                    <div class="profession-icon-large">${profession.icon}</div>
                    <div class="profession-description">${profession.description}</div>
                    
                    <div class="financial-breakdown">
                        <h4>Финансовая информация</h4>
                        <div class="breakdown-item">
                            <span>Зарплата:</span>
                            <span>$${profession.salary.toLocaleString()}</span>
                        </div>
                        <div class="breakdown-item">
                            <span>Расходы:</span>
                            <span>$${profession.expenses.toLocaleString()}</span>
                        </div>
                        <div class="breakdown-item">
                            <span>Денежный поток:</span>
                            <span>$${profession.cashFlow.toLocaleString()}</span>
                        </div>
                        <div class="breakdown-item">
                            <span>Общий долг:</span>
                            <span>$${profession.totalDebt.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div class="debt-breakdown">
                        <h4>Детали долгов</h4>
                        ${profession.debts.map(debt => `
                            <div class="debt-item">
                                <span class="debt-name">${debt.name}</span>
                                <span class="debt-monthly">$${debt.monthly.toLocaleString()}/мес</span>
                                <span class="debt-principal">$${debt.principal.toLocaleString()}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="profession-modal-actions">
                    <button class="btn btn-primary" onclick="professionUI.confirmSelection('${profession.id}')">Выбрать профессию</button>
                    <button class="btn btn-secondary" onclick="this.closest('.profession-modal').remove()">Закрыть</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Анимация появления
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }
    
    // Подтверждение выбора профессии
    confirmSelection(professionId) {
        const profession = this.professionManager.getProfessionById(professionId);
        if (profession) {
            console.log('✅ ProfessionUI: Profession selected:', profession.name);
            
            // Здесь должна быть логика подтверждения выбора
            // Например, отправка на сервер или обновление состояния игры
            
            // Закрываем модальное окно
            const modal = document.querySelector('.profession-modal');
            if (modal) {
                modal.remove();
            }
            
            // Показываем уведомление
            this.showNotification(`Профессия "${profession.name}" выбрана!`);
        }
    }
    
    // Показ уведомления
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'profession-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Анимация появления
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Автоматическое скрытие через 3 секунды
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    // Обновление UI
    refresh() {
        this.render();
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfessionUI;
} else if (typeof window !== 'undefined') {
    window.ProfessionUI = ProfessionUI;
}











