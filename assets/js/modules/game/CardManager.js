// Менеджер карт для игры
// Управляет колодами, отбоем и перемешиванием карт

class CardManager {
    constructor() {
        this.decks = {
            bigDeal: [],      // Большие сделки
            smallDeal: [],    // Малые сделки
            expenses: [],     // Расходы
            market: []        // Рынок
        };
        
        this.discardPiles = {
            bigDeal: [],
            smallDeal: [],
            expenses: [],
            market: []
        };
        
        this.initializeCards();
    }
    
    // Инициализация карт
    initializeCards() {
        console.log('🃏 CardManager: Initializing cards...');
        
        // Большие сделки (24 карты)
        this.decks.bigDeal = this.createBigDealCards();
        
        // Малые сделки (32 карты)
        this.decks.smallDeal = this.createSmallDealCards();
        
        // Расходы (24 карты)
        this.decks.expenses = this.createExpenseCards();
        
        // Рынок (24 карты)
        this.decks.market = this.createMarketCards();
        
        // Перемешиваем все колоды
        Object.keys(this.decks).forEach(deckType => {
            this.shuffleDeck(deckType);
        });
        
        console.log('✅ CardManager: Cards initialized', {
            bigDeal: this.decks.bigDeal.length,
            smallDeal: this.decks.smallDeal.length,
            expenses: this.decks.expenses.length,
            market: this.decks.market.length
        });
    }
    
    // Создание карт больших сделок
    createBigDealCards() {
        const cards = [];
        const types = [
            { name: 'Недвижимость', icon: '🏠', cost: 50000, income: 5000, description: 'Покупка недвижимости' },
            { name: 'Бизнес', icon: '🏢', cost: 100000, income: 10000, description: 'Покупка бизнеса' },
            { name: 'Акции', icon: '📈', cost: 25000, income: 2500, description: 'Инвестиции в акции' },
            { name: 'Облигации', icon: '📊', cost: 15000, income: 1500, description: 'Государственные облигации' },
            { name: 'Золото', icon: '🥇', cost: 30000, income: 3000, description: 'Инвестиции в золото' },
            { name: 'Криптовалюта', icon: '₿', cost: 20000, income: 2000, description: 'Инвестиции в криптовалюту' }
        ];
        
        // Создаем 24 карты (по 4 карты каждого типа)
        for (let i = 0; i < 24; i++) {
            const type = types[i % types.length];
            cards.push({
                id: `big_deal_${i + 1}`,
                type: 'bigDeal',
                name: type.name,
                icon: type.icon,
                cost: type.cost + Math.floor(Math.random() * 10000), // Добавляем случайность
                income: type.income + Math.floor(Math.random() * 1000),
                description: type.description,
                used: false
            });
        }
        
        return cards;
    }
    
    // Создание карт малых сделок
    createSmallDealCards() {
        const cards = [];
        const types = [
            { name: 'Акции', icon: '📈', cost: 1000, income: 100, description: 'Малые инвестиции в акции' },
            { name: 'Облигации', icon: '📊', cost: 500, income: 50, description: 'Краткосрочные облигации' },
            { name: 'Депозит', icon: '💰', cost: 2000, income: 200, description: 'Банковский депозит' },
            { name: 'Фонд', icon: '🏦', cost: 1500, income: 150, description: 'Паевой инвестиционный фонд' },
            { name: 'Криптовалюта', icon: '₿', cost: 800, income: 80, description: 'Малые инвестиции в криптовалюту' },
            { name: 'Золото', icon: '🥇', cost: 1200, income: 120, description: 'Инвестиции в золото' },
            { name: 'Недвижимость', icon: '🏠', cost: 3000, income: 300, description: 'Малая недвижимость' },
            { name: 'Бизнес', icon: '🏪', cost: 2500, income: 250, description: 'Малый бизнес' }
        ];
        
        // Создаем 32 карты (по 4 карты каждого типа)
        for (let i = 0; i < 32; i++) {
            const type = types[i % types.length];
            cards.push({
                id: `small_deal_${i + 1}`,
                type: 'smallDeal',
                name: type.name,
                icon: type.icon,
                cost: type.cost + Math.floor(Math.random() * 500), // Добавляем случайность
                income: type.income + Math.floor(Math.random() * 50),
                description: type.description,
                used: false
            });
        }
        
        return cards;
    }
    
    // Создание карт расходов
    createExpenseCards() {
        const cards = [];
        const types = [
            { name: 'Налоги', icon: '📋', cost: 2000, description: 'Подоходный налог' },
            { name: 'Страховка', icon: '🛡️', cost: 1500, description: 'Страхование жизни' },
            { name: 'Медицина', icon: '🏥', cost: 1000, description: 'Медицинские расходы' },
            { name: 'Образование', icon: '🎓', cost: 3000, description: 'Образование детей' },
            { name: 'Ремонт', icon: '🔧', cost: 2500, description: 'Ремонт дома' },
            { name: 'Автомобиль', icon: '🚗', cost: 4000, description: 'Покупка автомобиля' }
        ];
        
        // Создаем 24 карты (по 4 карты каждого типа)
        for (let i = 0; i < 24; i++) {
            const type = types[i % types.length];
            cards.push({
                id: `expense_${i + 1}`,
                type: 'expenses',
                name: type.name,
                icon: type.icon,
                cost: type.cost + Math.floor(Math.random() * 1000), // Добавляем случайность
                description: type.description,
                used: false
            });
        }
        
        return cards;
    }
    
    // Создание карт рынка
    createMarketCards() {
        const cards = [];
        const types = [
            { name: 'Спецпредложение', icon: '🎯', cost: 5000, income: 500, description: 'Специальное предложение' },
            { name: 'Распродажа', icon: '🏷️', cost: 3000, income: 300, description: 'Распродажа активов' },
            { name: 'Бонус', icon: '🎁', cost: 0, income: 1000, description: 'Бонусная карта' },
            { name: 'Скидка', icon: '💸', cost: 2000, income: 200, description: 'Скидочная карта' },
            { name: 'Подарок', icon: '🎁', cost: 0, income: 500, description: 'Подарочная карта' },
            { name: 'Кэшбэк', icon: '💳', cost: 1000, income: 100, description: 'Кэшбэк карта' }
        ];
        
        // Создаем 24 карты (по 4 карты каждого типа)
        for (let i = 0; i < 24; i++) {
            const type = types[i % types.length];
            cards.push({
                id: `market_${i + 1}`,
                type: 'market',
                name: type.name,
                icon: type.icon,
                cost: type.cost + Math.floor(Math.random() * 500), // Добавляем случайность
                income: type.income + Math.floor(Math.random() * 100),
                description: type.description,
                used: false
            });
        }
        
        return cards;
    }
    
    // Перемешивание колоды
    shuffleDeck(deckType) {
        if (!this.decks[deckType]) return;
        
        const deck = this.decks[deckType];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        
        console.log(`🔀 CardManager: Shuffled ${deckType} deck (${deck.length} cards)`);
    }
    
    // Взятие карты из колоды
    drawCard(deckType) {
        if (!this.decks[deckType] || this.decks[deckType].length === 0) {
            // Если колода пуста, перемешиваем отбой
            this.reshuffleFromDiscard(deckType);
        }
        
        if (this.decks[deckType].length === 0) {
            console.warn(`⚠️ CardManager: No cards available in ${deckType} deck`);
            return null;
        }
        
        const card = this.decks[deckType].pop();
        console.log(`🃏 CardManager: Drew card from ${deckType}:`, card.name);
        return card;
    }
    
    // Добавление карты в отбой
    discardCard(card) {
        if (!card || !card.type) return;
        
        const deckType = card.type;
        if (!this.discardPiles[deckType]) {
            this.discardPiles[deckType] = [];
        }
        
        card.used = true;
        this.discardPiles[deckType].push(card);
        
        console.log(`🗑️ CardManager: Discarded card to ${deckType}:`, card.name);
    }
    
    // Перемешивание отбоя обратно в колоду
    reshuffleFromDiscard(deckType) {
        if (!this.discardPiles[deckType] || this.discardPiles[deckType].length === 0) {
            console.warn(`⚠️ CardManager: No cards in ${deckType} discard pile to reshuffle`);
            return;
        }
        
        // Перемещаем все карты из отбоя в колоду
        this.decks[deckType] = [...this.discardPiles[deckType]];
        this.discardPiles[deckType] = [];
        
        // Сбрасываем флаг used
        this.decks[deckType].forEach(card => {
            card.used = false;
        });
        
        // Перемешиваем колоду
        this.shuffleDeck(deckType);
        
        console.log(`🔄 CardManager: Reshuffled ${deckType} from discard pile (${this.decks[deckType].length} cards)`);
    }
    
    // Получение информации о колодах
    getDeckInfo() {
        return {
            decks: Object.keys(this.decks).reduce((acc, key) => {
                acc[key] = {
                    remaining: this.decks[key].length,
                    discarded: this.discardPiles[key] ? this.discardPiles[key].length : 0
                };
                return acc;
            }, {}),
            totalCards: Object.values(this.decks).reduce((sum, deck) => sum + deck.length, 0),
            totalDiscarded: Object.values(this.discardPiles).reduce((sum, pile) => sum + pile.length, 0)
        };
    }
    
    // Получение статистики
    getStats() {
        const info = this.getDeckInfo();
        return {
            ...info,
            bigDeal: {
                remaining: this.decks.bigDeal.length,
                discarded: this.discardPiles.bigDeal.length,
                total: 24
            },
            smallDeal: {
                remaining: this.decks.smallDeal.length,
                discarded: this.discardPiles.smallDeal.length,
                total: 32
            },
            expenses: {
                remaining: this.decks.expenses.length,
                discarded: this.discardPiles.expenses.length,
                total: 24
            },
            market: {
                remaining: this.decks.market.length,
                discarded: this.discardPiles.market.length,
                total: 24
            }
        };
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CardManager;
} else if (typeof window !== 'undefined') {
    window.CardManager = CardManager;
}
