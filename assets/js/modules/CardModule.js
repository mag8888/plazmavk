/**
 * Модуль карт для игры "Энергия денег"
 * Управляет колодами карт, их раздачей и обработкой
 */

export class CardModule {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.decks = new Map();
        this.currentCard = null;
        this.cardHistory = [];
        this.maxHistorySize = 100;
        this.isDestroyed = false;
    }

    /**
     * Инициализация модуля карт
     */
    async init() {
        console.log('🃏 CardModule инициализирован');
        
        // Инициализация колод
        this.initDecks();
        
        // Подписка на события
        this.gameCore.eventBus.on('cardDrawRequested', this.onCardDrawRequested.bind(this));
        this.gameCore.eventBus.on('playerPositionChanged', this.onPlayerPositionChanged.bind(this));
    }

    /**
     * Инициализация колод карт
     */
    initDecks() {
        // Колода возможностей
        this.decks.set('opportunity', new Deck('opportunity', this.createOpportunityCards()));
        
        // Колода расходов
        this.decks.set('expense', new Deck('expense', this.createExpenseCards()));
        
        // Колода благотворительности
        this.decks.set('charity', new Deck('charity', this.createCharityCards()));
        
        console.log('🃏 Колоды карт инициализированы');
    }

    /**
     * Создание карт возможностей
     */
    createOpportunityCards() {
        return [
            { id: 'opp_001', name: 'Акции', amount: 5000, income: 500, type: 'stock' },
            { id: 'opp_002', name: 'Недвижимость', amount: 15000, income: 1500, type: 'real_estate' },
            { id: 'opp_003', name: 'Бизнес', amount: 25000, income: 2500, type: 'business' },
            { id: 'opp_004', name: 'Облигации', amount: 3000, income: 300, type: 'bonds' },
            { id: 'opp_005', name: 'Золото', amount: 8000, income: 800, type: 'gold' },
            { id: 'opp_006', name: 'Криптовалюта', amount: 12000, income: 1200, type: 'crypto' },
            { id: 'opp_007', name: 'Франшиза', amount: 35000, income: 3500, type: 'franchise' },
            { id: 'opp_008', name: 'Патент', amount: 20000, income: 2000, type: 'patent' },
            { id: 'opp_009', name: 'Стартап', amount: 40000, income: 4000, type: 'startup' },
            { id: 'opp_010', name: 'Инвестиции', amount: 6000, income: 600, type: 'investment' }
        ];
    }

    /**
     * Создание карт расходов
     */
    createExpenseCards() {
        return [
            { id: 'exp_001', name: 'Налоги', amount: 2000, type: 'tax' },
            { id: 'exp_002', name: 'Медицина', amount: 1500, type: 'medical' },
            { id: 'exp_003', name: 'Образование', amount: 3000, type: 'education' },
            { id: 'exp_004', name: 'Ремонт', amount: 2500, type: 'repair' },
            { id: 'exp_005', name: 'Страховка', amount: 1800, type: 'insurance' },
            { id: 'exp_006', name: 'Штраф', amount: 500, type: 'fine' },
            { id: 'exp_007', name: 'Праздник', amount: 1200, type: 'celebration' },
            { id: 'exp_008', name: 'Путешествие', amount: 4000, type: 'travel' },
            { id: 'exp_009', name: 'Покупка', amount: 2200, type: 'purchase' },
            { id: 'exp_010', name: 'Услуги', amount: 800, type: 'services' }
        ];
    }

    /**
     * Создание карт благотворительности
     */
    createCharityCards() {
        return [
            { id: 'char_001', name: 'Детский дом', amount: 1000, description: 'Помощь детям' },
            { id: 'char_002', name: 'Приют для животных', amount: 800, description: 'Помощь животным' },
            { id: 'char_003', name: 'Медицинская помощь', amount: 1500, description: 'Лечение больных' },
            { id: 'char_004', name: 'Образование', amount: 1200, description: 'Обучение детей' },
            { id: 'char_005', name: 'Экология', amount: 900, description: 'Защита природы' }
        ];
    }

    /**
     * Взятие карты из колоды
     * @param {string} deckType - Тип колоды
     * @param {Object} options - Опции
     */
    drawCard(deckType, options = {}) {
        if (this.isDestroyed) {
            console.warn('CardModule уничтожен, взятие карты невозможно');
            return null;
        }

        const deck = this.decks.get(deckType);
        if (!deck) {
            console.error(`Колода ${deckType} не найдена`);
            return null;
        }

        const card = deck.draw();
        if (!card) {
            console.warn(`Колода ${deckType} пуста`);
            return null;
        }

        this.currentCard = card;
        
        // Сохранение в историю
        this.saveToHistory(card, deckType);
        
        // Эмиссия события
        this.gameCore.eventBus.emit('cardDrawn', {
            card,
            deckType,
            timestamp: Date.now(),
            options
        });

        console.log(`🃏 Взята карта: ${card.name} (${deckType})`);
        
        return card;
    }

    /**
     * Обработка карты
     * @param {Object} card - Карта
     * @param {string} action - Действие (buy/skip)
     * @param {Object} player - Игрок
     */
    processCard(card, action, player) {
        if (!card || !player) {
            console.error('Недостаточно данных для обработки карты');
            return false;
        }

        const result = {
            card,
            action,
            player: player.id,
            timestamp: Date.now(),
            success: false,
            message: '',
            financialImpact: 0
        };

        try {
            switch (action) {
                case 'buy':
                    result.success = this.processCardPurchase(card, player);
                    result.message = result.success ? 
                        `Покупка ${card.name} за $${card.amount.toLocaleString()}` : 
                        'Недостаточно средств';
                    result.financialImpact = result.success ? -card.amount : 0;
                    break;

                case 'skip':
                    result.success = true;
                    result.message = `Пропуск карты ${card.name}`;
                    result.financialImpact = 0;
                    break;

                case 'pay':
                    result.success = this.processCardPayment(card, player);
                    result.message = result.success ? 
                        `Оплата ${card.name} $${card.amount.toLocaleString()}` : 
                        'Недостаточно средств';
                    result.financialImpact = result.success ? -card.amount : 0;
                    break;

                case 'charity':
                    result.success = this.processCharityCard(card, player);
                    result.message = result.success ? 
                        `Благотворительность: ${card.name} $${card.amount.toLocaleString()}` : 
                        'Недостаточно средств';
                    result.financialImpact = result.success ? -card.amount : 0;
                    break;

                default:
                    result.message = 'Неизвестное действие';
            }

        } catch (error) {
            console.error('Ошибка обработки карты:', error);
            result.message = 'Ошибка обработки карты';
        }

        // Эмиссия события
        this.gameCore.eventBus.emit('cardProcessed', result);

        return result;
    }

    /**
     * Обработка покупки карты
     * @param {Object} card - Карта
     * @param {Object} player - Игрок
     */
    processCardPurchase(card, player) {
        const playerManager = this.gameCore.getModule('playerManager');
        if (!playerManager) {
            return false;
        }

        // Проверка достаточности средств
        if (player.balance < card.amount) {
            return false;
        }

        // Списание средств
        playerManager.updateBalance(player.id, -card.amount, `Покупка: ${card.name}`);

        // Добавление актива
        if (card.income) {
            playerManager.updatePlayer(player.id, {
                monthlyIncome: player.monthlyIncome + card.income,
                assets: [...(player.assets || []), card]
            });
        }

        return true;
    }

    /**
     * Обработка оплаты карты
     * @param {Object} card - Карта
     * @param {Object} player - Игрок
     */
    processCardPayment(card, player) {
        const playerManager = this.gameCore.getModule('playerManager');
        if (!playerManager) {
            return false;
        }

        // Проверка достаточности средств
        if (player.balance < card.amount) {
            return false;
        }

        // Списание средств
        playerManager.updateBalance(player.id, -card.amount, `Расход: ${card.name}`);

        // Добавление расхода
        playerManager.updatePlayer(player.id, {
            monthlyExpenses: player.monthlyExpenses + (card.monthlyExpense || 0)
        });

        return true;
    }

    /**
     * Обработка карты благотворительности
     * @param {Object} card - Карта
     * @param {Object} player - Игрок
     */
    processCharityCard(card, player) {
        const playerManager = this.gameCore.getModule('playerManager');
        if (!playerManager) {
            return false;
        }

        // Проверка достаточности средств
        if (player.balance < card.amount) {
            return false;
        }

        // Списание средств
        playerManager.updateBalance(player.id, -card.amount, `Благотворительность: ${card.name}`);

        return true;
    }

    /**
     * Получение карты по типу клетки
     * @param {Object} cell - Клетка
     */
    getCardByCellType(cell) {
        if (!cell || !cell.type) {
            return null;
        }

        switch (cell.type) {
            case 'opportunity':
                return this.drawCard('opportunity');
            case 'expense':
                return this.drawCard('expense');
            case 'charity':
                return this.drawCard('charity');
            default:
                return null;
        }
    }

    /**
     * Перемешивание колоды
     * @param {string} deckType - Тип колоды
     */
    shuffleDeck(deckType) {
        const deck = this.decks.get(deckType);
        if (deck) {
            deck.shuffle();
            console.log(`🃏 Колода ${deckType} перемешана`);
        }
    }

    /**
     * Перемешивание всех колод
     */
    shuffleAllDecks() {
        this.decks.forEach((deck, type) => {
            deck.shuffle();
        });
        console.log('🃏 Все колоды перемешаны');
    }

    /**
     * Получение информации о колоде
     * @param {string} deckType - Тип колоды
     */
    getDeckInfo(deckType) {
        const deck = this.decks.get(deckType);
        if (!deck) {
            return null;
        }

        return {
            type: deckType,
            totalCards: deck.totalCards,
            remainingCards: deck.remainingCards,
            isShuffled: deck.isShuffled,
            lastShuffle: deck.lastShuffle
        };
    }

    /**
     * Получение истории карт
     * @param {number} limit - Лимит записей
     */
    getHistory(limit = 10) {
        return this.cardHistory.slice(-limit);
    }

    /**
     * Сохранение в историю
     * @param {Object} card - Карта
     * @param {string} deckType - Тип колоды
     */
    saveToHistory(card, deckType) {
        this.cardHistory.push({
            card,
            deckType,
            timestamp: Date.now(),
            playerId: this.gameCore.state.getState('currentPlayerId')
        });

        // Ограничение размера истории
        if (this.cardHistory.length > this.maxHistorySize) {
            this.cardHistory.shift();
        }
    }

    /**
     * Получение текущей карты
     */
    getCurrentCard() {
        return this.currentCard;
    }

    /**
     * Очистка текущей карты
     */
    clearCurrentCard() {
        this.currentCard = null;
    }

    /**
     * Получение статистики
     */
    getStats() {
        const stats = {
            totalDecks: this.decks.size,
            currentCard: this.currentCard ? this.currentCard.name : null,
            historySize: this.cardHistory.length,
            deckStats: {}
        };

        this.decks.forEach((deck, type) => {
            stats.deckStats[type] = {
                totalCards: deck.totalCards,
                remainingCards: deck.remainingCards,
                drawnCards: deck.totalCards - deck.remainingCards
            };
        });

        return stats;
    }

    /**
     * Обработчики событий
     */
    onCardDrawRequested(data) {
        this.drawCard(data.deckType, data.options);
    }

    onPlayerPositionChanged(data) {
        // Обработка карт при изменении позиции игрока
        // Может потребоваться для автоматических карт
    }

    /**
     * Уничтожение модуля карт
     */
    destroy() {
        this.decks.clear();
        this.currentCard = null;
        this.cardHistory = [];
        this.isDestroyed = true;
        console.log('🗑️ CardModule уничтожен');
    }
}

/**
 * Класс колоды карт
 */
class Deck {
    constructor(type, cards = []) {
        this.type = type;
        this.cards = [...cards];
        this.originalCards = [...cards];
        this.currentIndex = 0;
        this.isShuffled = false;
        this.lastShuffle = null;
    }

    /**
     * Взятие карты
     */
    draw() {
        if (this.remainingCards === 0) {
            this.shuffle();
        }

        const card = this.cards[this.currentIndex];
        this.currentIndex++;
        
        return card;
    }

    /**
     * Перемешивание колоды
     */
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
        
        this.currentIndex = 0;
        this.isShuffled = true;
        this.lastShuffle = Date.now();
    }

    /**
     * Сброс колоды
     */
    reset() {
        this.cards = [...this.originalCards];
        this.currentIndex = 0;
        this.isShuffled = false;
    }

    /**
     * Получение количества оставшихся карт
     */
    get remainingCards() {
        return Math.max(0, this.cards.length - this.currentIndex);
    }

    /**
     * Получение общего количества карт
     */
    get totalCards() {
        return this.cards.length;
    }
}

export default CardModule;
