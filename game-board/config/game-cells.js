// Game Board v2.0 - Game Cells Configuration
// Структурированный список всех клеток игрового поля
// Примечание: BIG круг описан в этом файле как GAME_CELLS.
// Для малого круга используем конфигурацию из корня репо: config/small-circle-cells.js

let SMALL_CIRCLE_CELLS = [];
try {
    // Эта зависимость доступна в Node-контексте сервера
    // Экспортирует { SMALL_CIRCLE_CELLS, CELL_TYPES, CELL_COLORS }
    // Путь из game-board/config → ../../config/small-circle-cells.js
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const small = require('../../config/small-circle-cells');
    SMALL_CIRCLE_CELLS = small.SMALL_CIRCLE_CELLS || [];
} catch (_e) {
    // В браузере этот require не выполнится — это нормально
    SMALL_CIRCLE_CELLS = typeof window !== 'undefined' && window.SMALL_CIRCLE_CELLS ? window.SMALL_CIRCLE_CELLS : [];
}

const GAME_CELLS = [
    {
        id: 1,
        type: 'money',
        name: 'Доход от инвестиций',
        description: 'Вам выплачивается доход от ваших инвестиций',
        icon: '💰',
        color: '#00ff96',
        effects: {
            income: true
        }
    },
    {
        id: 2,
        type: 'dream',
        name: 'Дом мечты',
        description: 'Построить дом мечты для семьи',
        icon: '🏠',
        color: '#ff6b6b',
        cost: 100000,
        effects: {
            dream: true
        }
    },
    {
        id: 3,
        type: 'business',
        name: 'Кофейня',
        description: 'Кофейня в центре города',
        icon: '☕',
        color: '#ffd65a',
        cost: 100000,
        income: 3000,
        effects: {
            business: true,
            monthlyIncome: 3000
        }
    },
    {
        id: 4,
        type: 'loss',
        name: 'Аудит',
        description: 'Аудит - теряете половину наличных',
        icon: '🔍',
        color: '#ff3b3b',
        effects: {
            cashMultiplier: -0.5
        }
    },
    {
        id: 5,
        type: 'business',
        name: 'Центр здоровья',
        description: 'Центр здоровья и спа',
        icon: '🏥',
        color: '#ffd65a',
        cost: 270000,
        income: 5000,
        effects: {
            business: true,
            monthlyIncome: 5000
        }
    },
    {
        id: 6,
        type: 'dream',
        name: 'Антарктида',
        description: 'Посетить Антарктиду',
        icon: '🧊',
        color: '#ff6b6b',
        cost: 150000,
        effects: {
            dream: true
        }
    },
    {
        id: 7,
        type: 'business',
        name: 'Мобильное приложение',
        description: 'Мобильное приложение (подписка)',
        icon: '📱',
        color: '#ffd65a',
        cost: 420000,
        income: 10000,
        effects: {
            business: true,
            monthlyIncome: 10000
        }
    },
    {
        id: 8,
        type: 'charity',
        name: 'Благотворительность',
        description: 'Благотворительность',
        icon: '❤️',
        color: '#ff69b4',
        effects: {
            karma: true
        }
    },
    {
        id: 9,
        type: 'business',
        name: 'Цифровой маркетинг',
        description: 'Агентство цифрового маркетинга',
        icon: '📊',
        color: '#ffd65a',
        cost: 160000,
        income: 4000,
        effects: {
            business: true,
            monthlyIncome: 4000
        }
    },
    {
        id: 10,
        type: 'loss',
        name: 'Кража',
        description: 'Кража - теряете все наличные',
        icon: '🚨',
        color: '#ff3b3b',
        effects: {
            cashMultiplier: -1
        }
    },
    {
        id: 11,
        type: 'business',
        name: 'Мини-отель',
        description: 'Мини-отель/бутик-гостиница',
        icon: '🏨',
        color: '#ffd65a',
        cost: 200000,
        income: 5000,
        effects: {
            business: true,
            monthlyIncome: 5000
        }
    },
    {
        id: 12,
        type: 'money',
        name: 'Доход от инвестиций',
        description: 'Вам выплачивается доход от ваших инвестиций',
        icon: '💰',
        color: '#00ff96',
        effects: {
            income: true
        }
    },
    {
        id: 13,
        type: 'business',
        name: 'Франшиза ресторана',
        description: 'Франшиза популярного ресторана',
        icon: '🍽️',
        color: '#ffd65a',
        cost: 320000,
        income: 8000,
        effects: {
            business: true,
            monthlyIncome: 8000
        }
    },
    {
        id: 14,
        type: 'dream',
        name: 'Высочайшие вершины',
        description: 'Подняться на все высочайшие вершины мира',
        icon: '🏔️',
        color: '#ff6b6b',
        cost: 500000,
        effects: {
            dream: true
        }
    },
    {
        id: 15,
        type: 'business',
        name: 'Мини-отель 2',
        description: 'Мини-отель/бутик-гостиница',
        icon: '🏨',
        color: '#ffd65a',
        cost: 200000,
        income: 4000,
        effects: {
            business: true,
            monthlyIncome: 4000
        }
    },
    {
        id: 16,
        type: 'dream',
        name: 'Книга-бестселлер',
        description: 'Стать автором книги-бестселлера',
        icon: '📚',
        color: '#ff6b6b',
        cost: 300000,
        effects: {
            dream: true
        }
    },
    {
        id: 17,
        type: 'business',
        name: 'Йога-центр',
        description: 'Йога- и медитационный центр',
        icon: '🧘',
        color: '#ffd65a',
        cost: 170000,
        income: 4500,
        effects: {
            business: true,
            monthlyIncome: 4500
        }
    },
    {
        id: 18,
        type: 'loss',
        name: 'Развод',
        description: 'Развод - теряете половину наличных',
        icon: '💔',
        color: '#ff3b3b',
        effects: {
            cashMultiplier: -0.5
        }
    },
    {
        id: 19,
        type: 'business',
        name: 'Автомойки',
        description: 'Сеть автомоек самообслуживания',
        icon: '🚗',
        color: '#ffd65a',
        cost: 120000,
        income: 3000,
        effects: {
            business: true,
            monthlyIncome: 3000
        }
    },
    {
        id: 20,
        type: 'dream',
        name: 'Яхта в Средиземном море',
        description: 'Жить год на яхте в Средиземном море',
        icon: '⛵',
        color: '#ff6b6b',
        cost: 300000,
        effects: {
            dream: true
        }
    },
    {
        id: 21,
        type: 'business',
        name: 'Салон красоты',
        description: 'Салон красоты/барбершоп',
        icon: '💇',
        color: '#ffd65a',
        cost: 500000,
        income: 15000,
        effects: {
            business: true,
            monthlyIncome: 15000
        }
    },
    {
        id: 22,
        type: 'dream',
        name: 'Мировой фестиваль',
        description: 'Организовать мировой фестиваль',
        icon: '🎪',
        color: '#ff6b6b',
        cost: 200000,
        effects: {
            dream: true
        }
    },
    {
        id: 23,
        type: 'money',
        name: 'Доход от инвестиций',
        description: 'Вам выплачивается доход от ваших инвестиций',
        icon: '💰',
        color: '#00ff96',
        effects: {
            income: true
        }
    },
    {
        id: 24,
        type: 'business',
        name: 'Онлайн-магазин',
        description: 'Онлайн-магазин одежды',
        icon: '🛍️',
        color: '#ffd65a',
        cost: 110000,
        income: 3000,
        effects: {
            business: true,
            monthlyIncome: 3000
        }
    },
    {
        id: 25,
        type: 'loss',
        name: 'Пожар',
        description: 'Пожар - теряете бизнес с минимальным доходом',
        icon: '🔥',
        color: '#ff3b3b',
        effects: {
            loseMinIncomeBusiness: true
        }
    },
    {
        id: 26,
        type: 'dream',
        name: 'Ретрит-центр',
        description: 'Построить ретрит-центр',
        icon: '🕯️',
        color: '#ff6b6b',
        cost: 500000,
        effects: {
            dream: true
        }
    },
    {
        id: 27,
        type: 'dream',
        name: 'Фонд поддержки талантов',
        description: 'Создать фонд поддержки талантов',
        icon: '🎭',
        color: '#ff6b6b',
        cost: 300000,
        effects: {
            dream: true
        }
    },
    {
        id: 28,
        type: 'dream',
        name: 'Кругосветное плавание',
        description: 'Кругосветное плавание на паруснике',
        icon: '⛵',
        color: '#ff6b6b',
        cost: 200000,
        effects: {
            dream: true
        }
    },
    {
        id: 29,
        type: 'business',
        name: 'Эко-ранчо',
        description: 'Туристический комплекс (эко-ранчо)',
        icon: '🌿',
        color: '#ffd65a',
        cost: 1000000,
        income: 20000,
        effects: {
            business: true,
            monthlyIncome: 20000
        }
    },
    {
        id: 30,
        type: 'dream',
        name: 'Кругосветное плавание 2',
        description: 'Кругосветное плавание на паруснике',
        icon: '⛵',
        color: '#ff6b6b',
        cost: 300000,
        effects: {
            dream: true
        }
    },
    {
        id: 31,
        type: 'business',
        name: 'Биржа',
        description: 'Биржа - разово выплачивается 500,000$ если выпало 5 или 6 на кубике',
        icon: '📈',
        color: '#ffd65a',
        cost: 50000,
        income: 500000,
        effects: {
            business: true,
            specialIncome: {
                trigger: 'dice_5_6',
                amount: 500000
            }
        }
    },
    {
        id: 32,
        type: 'dream',
        name: 'Частный самолёт',
        description: 'Купить частный самолёт',
        icon: '✈️',
        color: '#ff6b6b',
        cost: 1000000,
        effects: {
            dream: true
        }
    },
    {
        id: 33,
        type: 'business',
        name: 'NFT-платформа',
        description: 'NFT-платформа',
        icon: '🎨',
        color: '#ffd65a',
        cost: 400000,
        income: 12000,
        effects: {
            business: true,
            monthlyIncome: 12000
        }
    },
    {
        id: 34,
        type: 'money',
        name: 'Кругосветное плавание',
        description: 'Кругосветное плавание на паруснике',
        icon: '⛵',
        color: '#00ff96',
        cost: 200000,
        effects: {
            income: true
        }
    },
    {
        id: 35,
        type: 'business',
        name: 'Школа языков',
        description: 'Школа иностранных языков',
        icon: '🌍',
        color: '#ffd65a',
        cost: 20000,
        income: 3000,
        effects: {
            business: true,
            monthlyIncome: 3000
        }
    },
    {
        id: 36,
        type: 'dream',
        name: 'Коллекция суперкаров',
        description: 'Купить коллекцию суперкаров',
        icon: '🏎️',
        color: '#ff6b6b',
        cost: 1000000,
        effects: {
            dream: true
        }
    },
    {
        id: 37,
        type: 'business',
        name: 'Школа будущего',
        description: 'Создать школу будущего для детей',
        icon: '🚀',
        color: '#ffd65a',
        cost: 300000,
        income: 10000,
        effects: {
            business: true,
            monthlyIncome: 10000
        }
    },
    {
        id: 38,
        type: 'dream',
        name: 'Полнометражный фильм',
        description: 'Снять полнометражный фильм',
        icon: '🎬',
        color: '#ff6b6b',
        cost: 500000,
        effects: {
            dream: true
        }
    },
    {
        id: 39,
        type: 'loss',
        name: 'Рейдерский захват',
        description: 'Рейдерский захват - теряете бизнес с крупным доходом',
        icon: '⚔️',
        color: '#ff3b3b',
        effects: {
            loseMaxIncomeBusiness: true
        }
    },
    {
        id: 40,
        type: 'dream',
        name: 'Мировой лидер мнений',
        description: 'Стать мировым лидером мнений',
        icon: '👑',
        color: '#ff6b6b',
        cost: 1000000,
        effects: {
            dream: true
        }
    },
    {
        id: 41,
        type: 'business',
        name: 'Автомойки 2',
        description: 'Сеть автомоек самообслуживания',
        icon: '🚗',
        color: '#ffd65a',
        cost: 120000,
        income: 3500,
        effects: {
            business: true,
            monthlyIncome: 3500
        }
    },
    {
        id: 42,
        type: 'dream',
        name: 'Белоснежная яхта',
        description: 'Белоснежная Яхта',
        icon: '⛵',
        color: '#ff6b6b',
        cost: 300000,
        effects: {
            dream: true
        }
    },
    {
        id: 43,
        type: 'business',
        name: 'Франшиза "Поток денег"',
        description: 'Франшиза "поток денег"',
        icon: '💸',
        color: '#ffd65a',
        cost: 100000,
        income: 10000,
        effects: {
            business: true,
            monthlyIncome: 10000
        }
    },
    {
        id: 44,
        type: 'dream',
        name: 'Полёт в космос',
        description: 'Полёт в космос',
        icon: '🚀',
        color: '#ff6b6b',
        cost: 250000,
        effects: {
            dream: true
        }
    }
];

// Категории клеток для фильтрации
const CELL_CATEGORIES = {
    DREAM: 'dream',
    BUSINESS: 'business',
    MONEY: 'money',
    LOSS: 'loss',
    CHARITY: 'charity'
};

// Функции для работы с клетками
const GameCellsUtils = {
    // Получить все клетки определенного типа
    getCellsByType: (type) => {
        return GAME_CELLS.filter(cell => cell.type === type);
    },

    // Получить все мечты
    getDreams: () => {
        return GAME_CELLS.filter(cell => cell.type === 'dream');
    },

    // Получить все бизнесы
    getBusinesses: () => {
        return GAME_CELLS.filter(cell => cell.type === 'business');
    },

    // Получить клетку по ID
    getCellById: (id) => {
        return GAME_CELLS.find(cell => cell.id === id);
    },

    // Получить случайную клетку определенного типа
    getRandomCellByType: (type) => {
        const cells = GameCellsUtils.getCellsByType(type);
        return cells[Math.floor(Math.random() * cells.length)];
    },

    // Получить клетки в определенном диапазоне стоимости
    getCellsByCostRange: (minCost, maxCost) => {
        return GAME_CELLS.filter(cell => 
            cell.cost && cell.cost >= minCost && cell.cost <= maxCost
        );
    },

    // Получить статистику по клеткам
    getCellsStatistics: () => {
        const stats = {
            total: GAME_CELLS.length,
            dreams: GameCellsUtils.getDreams().length,
            businesses: GameCellsUtils.getBusinesses().length,
            money: GameCellsUtils.getCellsByType('money').length,
            losses: GameCellsUtils.getCellsByType('loss').length,
            charity: GameCellsUtils.getCellsByType('charity').length,
            totalDreamCost: GameCellsUtils.getDreams().reduce((sum, cell) => sum + (cell.cost || 0), 0),
            totalBusinessCost: GameCellsUtils.getBusinesses().reduce((sum, cell) => sum + (cell.cost || 0), 0),
            totalMonthlyIncome: GameCellsUtils.getBusinesses().reduce((sum, cell) => sum + (cell.income || 0), 0)
        };
        return stats;
    }
};

module.exports = {
    GAME_CELLS,
    CELL_CATEGORIES,
    GameCellsUtils,
    SMALL_CIRCLE_CELLS
};
