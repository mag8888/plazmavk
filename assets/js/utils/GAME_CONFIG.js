/**
 * Конфигурация игры "Энергия денег"
 */

export const GAME_CONFIG = {
    // Основные настройки игры
    game: {
        name: "Энергия денег",
        version: "2.0.0",
        maxPlayers: 6,
        minPlayers: 2,
        turnTime: 30000, // 30 секунд на ход
        maxTurns: 100
    },

    // Настройки игрового поля
    board: {
        totalCells: 44,
        startPosition: 0,
        cellTypes: [
            'money', 'property', 'vehicle', 'idea', 
            'goal', 'shopping', 'business', 'neutral'
        ]
    },

    // Настройки кубика
    dice: {
        minValue: 1,
        maxValue: 6,
        count: 2
    },

    // Настройки игроков
    players: {
        startingCash: 10000,
        startingPosition: 0,
        maxAssets: 50
    },

    // Настройки событий
    events: {
        payday: {
            baseAmount: 1000,
            multiplier: 1.5
        },
        charity: {
            baseAmount: 500,
            multiplier: 1.0
        },
        opportunity: {
            baseAmount: 2000,
            multiplier: 2.0
        },
        expense: {
            baseAmount: 800,
            multiplier: 1.2
        }
    },

    // Настройки клеток
    cells: {
        money: {
            baseIncome: 1000,
            color: '#4CAF50',
            icon: '💰'
        },
        property: {
            baseCost: 5000,
            baseIncome: 500,
            color: '#2196F3',
            icon: '🏠'
        },
        vehicle: {
            baseCost: 3000,
            baseIncome: 0,
            color: '#FF9800',
            icon: '🚗'
        },
        idea: {
            baseCost: 1000,
            baseIncome: 200,
            color: '#9C27B0',
            icon: '💡'
        },
        goal: {
            baseCost: 0,
            baseIncome: 0,
            color: '#F44336',
            icon: '🎯'
        },
        shopping: {
            baseCost: 2000,
            baseIncome: 0,
            color: '#E91E63',
            icon: '🛒'
        },
        business: {
            baseCost: 8000,
            baseIncome: 800,
            color: '#795548',
            icon: '💼'
        },
        neutral: {
            baseCost: 0,
            baseIncome: 0,
            color: '#9E9E9E',
            icon: '⚪'
        }
    },

    // Настройки карт
    cards: {
        market: {
            count: 24,
            baseValue: 5000
        },
        expense: {
            count: 24,
            baseValue: 2000
        },
        smallDeals: {
            count: 32,
            baseValue: 5000
        },
        bigDeals: {
            count: 24,
            baseValue: 25000
        }
    },

    // Настройки мечт
    dreams: {
        count: 20,
        baseCost: 50000,
        categories: ['house', 'car', 'travel', 'education', 'business']
    },

    // Настройки токенов
    tokens: [
        { id: 'car', icon: '🚗', name: 'Автомобиль' },
        { id: 'house', icon: '🏠', name: 'Дом' },
        { id: 'dog', icon: '🐕', name: 'Собака' },
        { id: 'cat', icon: '🐱', name: 'Кот' },
        { id: 'hat', icon: '🎩', name: 'Шляпа' },
        { id: 'boat', icon: '⛵', name: 'Лодка' }
    ],

    // Настройки профессий
    professions: [
        {
            id: 'teacher',
            name: 'Учитель',
            salary: 2000,
            expenses: 1000,
            color: '#4CAF50'
        },
        {
            id: 'doctor',
            name: 'Врач',
            salary: 5000,
            expenses: 2000,
            color: '#2196F3'
        },
        {
            id: 'engineer',
            name: 'Инженер',
            salary: 4000,
            expenses: 1500,
            color: '#FF9800'
        },
        {
            id: 'lawyer',
            name: 'Юрист',
            salary: 6000,
            expenses: 2500,
            color: '#9C27B0'
        }
    ]
};

export default GAME_CONFIG;
