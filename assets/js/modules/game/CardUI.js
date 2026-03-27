// UI для отображения карт и отбоя
// Показывает колоды, отбой и статистику карт

class CardUI {
    constructor(cardManager) {
        this.cardManager = cardManager;
        this.container = null;
        this.init();
    }
    
    init() {
        this.createContainer();
        this.render();
    }
    
    // Создание контейнера для карт
    createContainer() {
        // Ищем существующий контейнер или создаем новый
        this.container = document.getElementById('cardUI');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'cardUI';
            this.container.className = 'card-ui';
            
            // Добавляем в sidebar или создаем отдельную панель
            const sidebar = document.querySelector('.sidebar') || document.body;
            sidebar.appendChild(this.container);
        }
    }
    
    // Рендеринг UI карт
    render() {
        if (!this.container) return;
        
        const stats = this.cardManager.getStats();
        
        this.container.innerHTML = `
            <div class="card-ui-header">
                <h3>🃏 Карты</h3>
                <button class="btn btn-sm" onclick="cardUI.refresh()">🔄 Обновить</button>
            </div>
            
            <div class="card-decks">
                <div class="card-deck" data-type="bigDeal">
                    <div class="deck-header">
                        <span class="deck-icon">💼</span>
                        <span class="deck-name">Большие сделки</span>
                    </div>
                    <div class="deck-stats">
                        <span class="remaining">${stats.bigDeal.remaining}</span>
                        <span class="separator">/</span>
                        <span class="total">${stats.bigDeal.total}</span>
                    </div>
                    <div class="deck-actions">
                        <button class="btn btn-sm" onclick="cardUI.drawCard('bigDeal')">Взять</button>
                    </div>
                </div>
                
                <div class="card-deck" data-type="smallDeal">
                    <div class="deck-header">
                        <span class="deck-icon">📦</span>
                        <span class="deck-name">Малые сделки</span>
                    </div>
                    <div class="deck-stats">
                        <span class="remaining">${stats.smallDeal.remaining}</span>
                        <span class="separator">/</span>
                        <span class="total">${stats.smallDeal.total}</span>
                    </div>
                    <div class="deck-actions">
                        <button class="btn btn-sm" onclick="cardUI.drawCard('smallDeal')">Взять</button>
                    </div>
                </div>
                
                <div class="card-deck" data-type="expenses">
                    <div class="deck-header">
                        <span class="deck-icon">💳</span>
                        <span class="deck-name">Расходы</span>
                    </div>
                    <div class="deck-stats">
                        <span class="remaining">${stats.expenses.remaining}</span>
                        <span class="separator">/</span>
                        <span class="total">${stats.expenses.total}</span>
                    </div>
                    <div class="deck-actions">
                        <button class="btn btn-sm" onclick="cardUI.drawCard('expenses')">Взять</button>
                    </div>
                </div>
                
                <div class="card-deck" data-type="market">
                    <div class="deck-header">
                        <span class="deck-icon">🛒</span>
                        <span class="deck-name">Рынок</span>
                    </div>
                    <div class="deck-stats">
                        <span class="remaining">${stats.market.remaining}</span>
                        <span class="separator">/</span>
                        <span class="total">${stats.market.total}</span>
                    </div>
                    <div class="deck-actions">
                        <button class="btn btn-sm" onclick="cardUI.drawCard('market')">Взять</button>
                    </div>
                </div>
            </div>
            
            <div class="discard-piles">
                <h4>🗑️ Отбой</h4>
                <div class="discard-stats">
                    <div class="discard-item">
                        <span class="discard-name">Большие сделки:</span>
                        <span class="discard-count">${stats.bigDeal.discarded}</span>
                    </div>
                    <div class="discard-item">
                        <span class="discard-name">Малые сделки:</span>
                        <span class="discard-count">${stats.smallDeal.discarded}</span>
                    </div>
                    <div class="discard-item">
                        <span class="discard-name">Расходы:</span>
                        <span class="discard-count">${stats.expenses.discarded}</span>
                    </div>
                    <div class="discard-item">
                        <span class="discard-name">Рынок:</span>
                        <span class="discard-count">${stats.market.discarded}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Взятие карты
    drawCard(deckType) {
        const card = this.cardManager.drawCard(deckType);
        if (card) {
            this.showCard(card);
            this.render(); // Обновляем UI
        } else {
            console.warn(`⚠️ CardUI: No cards available in ${deckType} deck`);
        }
    }
    
    // Показ карты
    showCard(card) {
        // Создаем модальное окно для показа карты
        const modal = document.createElement('div');
        modal.className = 'card-modal';
        modal.innerHTML = `
            <div class="card-modal-content">
                <div class="card-modal-header">
                    <h3>${card.name}</h3>
                    <button class="card-modal-close" onclick="this.closest('.card-modal').remove()">×</button>
                </div>
                <div class="card-modal-body">
                    <div class="card-icon">${card.icon}</div>
                    <div class="card-description">${card.description}</div>
                    ${card.cost ? `<div class="card-cost">Стоимость: $${card.cost.toLocaleString()}</div>` : ''}
                    ${card.income ? `<div class="card-income">Доход: $${card.income.toLocaleString()}</div>` : ''}
                </div>
                <div class="card-modal-actions">
                    <button class="btn btn-primary" onclick="cardUI.useCard('${card.id}')">Использовать</button>
                    <button class="btn btn-secondary" onclick="cardUI.discardCard('${card.id}')">В отбой</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Анимация появления
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }
    
    // Использование карты
    useCard(cardId) {
        // Здесь должна быть логика использования карты
        console.log(`🎯 CardUI: Using card ${cardId}`);
        
        // Закрываем модальное окно
        const modal = document.querySelector('.card-modal');
        if (modal) {
            modal.remove();
        }
        
        // Обновляем UI
        this.render();
    }
    
    // Отправка карты в отбой
    discardCard(cardId) {
        // Здесь должна быть логика отправки карты в отбой
        console.log(`🗑️ CardUI: Discarding card ${cardId}`);
        
        // Закрываем модальное окно
        const modal = document.querySelector('.card-modal');
        if (modal) {
            modal.remove();
        }
        
        // Обновляем UI
        this.render();
    }
    
    // Обновление UI
    refresh() {
        this.render();
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CardUI;
} else if (typeof window !== 'undefined') {
    window.CardUI = CardUI;
}
