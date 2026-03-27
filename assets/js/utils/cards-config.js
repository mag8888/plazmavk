/**
 * Конфигурация карт для игры "Энергия денег"
 */

// Малые сделки (Small Deals)
export const SMALL_DEAL_CARDS = [
    {
        id: 'small_1',
        type: 'small',
        title: 'Акции компании',
        description: 'Покупка акций стабильной компании',
        cost: 1000,
        downPayment: 100,
        cashFlow: 50,
        category: 'stocks',
        risk: 'low'
    },
    {
        id: 'small_2',
        type: 'small',
        title: 'Облигации',
        description: 'Государственные облигации',
        cost: 5000,
        downPayment: 500,
        cashFlow: 250,
        category: 'bonds',
        risk: 'low'
    },
    {
        id: 'small_3',
        type: 'small',
        title: 'Депозит в банке',
        description: 'Срочный депозит под проценты',
        cost: 2000,
        downPayment: 200,
        cashFlow: 100,
        category: 'deposit',
        risk: 'low'
    },
    {
        id: 'small_4',
        type: 'small',
        title: 'ПИФ',
        description: 'Паевый инвестиционный фонд',
        cost: 3000,
        downPayment: 300,
        cashFlow: 150,
        category: 'funds',
        risk: 'medium'
    },
    {
        id: 'small_5',
        type: 'small',
        title: 'Криптовалюта',
        description: 'Инвестиции в криптовалюту',
        cost: 1000,
        downPayment: 100,
        cashFlow: 200,
        category: 'crypto',
        risk: 'high'
    }
];

// Большие сделки (Big Deals)
export const BIG_DEAL_CARDS = [
    {
        id: 'big_1',
        type: 'big',
        title: 'Недвижимость',
        description: 'Покупка квартиры для сдачи в аренду',
        cost: 50000,
        downPayment: 10000,
        cashFlow: 2000,
        category: 'real_estate',
        risk: 'medium'
    },
    {
        id: 'big_2',
        type: 'big',
        title: 'Бизнес',
        description: 'Покупка готового бизнеса',
        cost: 100000,
        downPayment: 20000,
        cashFlow: 5000,
        category: 'business',
        risk: 'high'
    },
    {
        id: 'big_3',
        type: 'big',
        title: 'Франшиза',
        description: 'Покупка франшизы известной сети',
        cost: 30000,
        downPayment: 15000,
        cashFlow: 3000,
        category: 'franchise',
        risk: 'medium'
    }
];

// Карты расходов (Expense Cards)
export const EXPENSE_CARDS = [
    {
        id: 'expense_1',
        type: 'expense',
        title: 'Новый автомобиль',
        description: 'Покупка дорогого автомобиля',
        cost: 30000,
        monthlyPayment: 2000,
        category: 'car',
        necessity: 'want'
    },
    {
        id: 'expense_2',
        type: 'expense',
        title: 'Роскошный отпуск',
        description: 'Дорогой отпуск за границей',
        cost: 10000,
        monthlyPayment: 0,
        category: 'vacation',
        necessity: 'want'
    },
    {
        id: 'expense_3',
        type: 'expense',
        title: 'Дорогая одежда',
        description: 'Покупка брендовой одежды',
        cost: 5000,
        monthlyPayment: 0,
        category: 'clothing',
        necessity: 'want'
    },
    {
        id: 'expense_4',
        type: 'expense',
        title: 'Медицинские расходы',
        description: 'Неожиданные медицинские расходы',
        cost: 8000,
        monthlyPayment: 0,
        category: 'medical',
        necessity: 'need'
    },
    {
        id: 'expense_5',
        type: 'expense',
        title: 'Ремонт дома',
        description: 'Необходимый ремонт жилья',
        cost: 15000,
        monthlyPayment: 0,
        category: 'repair',
        necessity: 'need'
    }
];

// Функция создания колоды карт
export function createDeck(cards) {
    return cards.map(card => ({
        ...card,
        drawn: false,
        drawnAt: null
    }));
}

// Функция перемешивания колоды
export function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Функция взятия карты из колоды
export function drawCard(deck) {
    const availableCards = deck.filter(card => !card.drawn);
    if (availableCards.length === 0) {
        // Перемешиваем колоду заново
        deck.forEach(card => {
            card.drawn = false;
            card.drawnAt = null;
        });
        return deck[Math.floor(Math.random() * deck.length)];
    }
    
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const card = availableCards[randomIndex];
    card.drawn = true;
    card.drawnAt = Date.now();
    
    return card;
}

export default {
    SMALL_DEAL_CARDS,
    BIG_DEAL_CARDS,
    EXPENSE_CARDS,
    createDeck,
    shuffleDeck,
    drawCard
};
