/**
 * Генератор игровых клеток (леток) для игры "Энергия денег"
 * Создает и управляет клетками игрового поля согласно ТЗ
 */

export class CellGenerator {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.cells = [];
        this.cellTypes = {
            PAYDAY: 'payday',
            CHARITY: 'charity', 
            OPPORTUNITY: 'opportunity',
            EXPENSE: 'expense',
            MARKET: 'market',
            DREAM: 'dream',
            NEUTRAL: 'neutral'
        };
        this.isDestroyed = false;
    }

    /**
     * Инициализация генератора клеток
     */
    async init() {
        console.log('🎯 CellGenerator инициализирован');
        
        // Подписка на события только если gameCore и eventBus доступны
        if (this.gameCore && this.gameCore.eventBus) {
            this.gameCore.eventBus.on('gameStarted', this.onGameStarted.bind(this));
            this.gameCore.eventBus.on('playerMoved', this.onPlayerMoved.bind(this));
        }
    }

    /**
     * Генерация игрового поля с клетками (круглое поле как на скриншоте)
     * @param {Object} config - Конфигурация поля
     */
    generateGameBoard(config = {}) {
        const boardConfig = {
            totalCells: 44, // Как на скриншоте - 44 клетки
            ...config
        };

        this.cells = [];
        
        for (let i = 0; i < boardConfig.totalCells; i++) {
            const cell = this.generateCell(i, boardConfig);
            this.cells.push(cell);
        }

        console.log(`🎯 Сгенерировано ${this.cells.length} клеток игрового поля`);
        
        // Эмиссия события только если gameCore и eventBus доступны
        if (this.gameCore && this.gameCore.eventBus) {
            this.gameCore.eventBus.emit('boardGenerated', { cells: this.cells });
        }
        
        return this.cells;
    }

    /**
     * Генерация отдельной клетки (как на скриншоте)
     * @param {number} position - Позиция клетки (1-44)
     * @param {Object} boardConfig - Конфигурация поля
     */
    generateCell(position, boardConfig) {
        const cellData = this.getCellDataByPosition(position);
        
        return {
            id: `cell_${position}`,
            position: position,
            type: cellData.type,
            name: cellData.name,
            description: cellData.description,
            icon: cellData.icon,
            color: cellData.color,
            effects: cellData.effects,
            actions: cellData.actions,
            cost: cellData.cost || 0,
            income: cellData.income || 0,
            generatedAt: Date.now()
        };
    }

    /**
     * Получение данных клетки по позиции (как на скриншоте)
     * @param {number} position - Позиция клетки (1-44)
     */
    getCellDataByPosition(position) {
        // Определяем тип и данные клетки на основе позиции
        // Это соответствует клеткам на скриншоте
        
        if (position === 1) {
            return {
                type: 'money',
                name: 'Деньги',
                description: 'Получите деньги',
                icon: '💰',
                color: '#4CAF50',
                effects: ['gain_money'],
                actions: ['collect_money'],
                cost: 0,
                income: 1000
            };
        }
        
        if (position === 2) {
            return {
                type: 'property',
                name: 'Недвижимость',
                description: 'Инвестиция в недвижимость',
                icon: '🏠',
                color: '#2196F3',
                effects: ['buy_property'],
                actions: ['invest_property'],
                cost: 5000,
                income: 500
            };
        }
        
        if (position === 3) {
            return {
                type: 'vehicle',
                name: 'Транспорт',
                description: 'Покупка автомобиля',
                icon: '🚗',
                color: '#FF9800',
                effects: ['buy_vehicle'],
                actions: ['purchase_vehicle'],
                cost: 3000,
                income: 0
            };
        }
        
        if (position === 4) {
            return {
                type: 'idea',
                name: 'Идея',
                description: 'Новая бизнес-идея',
                icon: '💡',
                color: '#9C27B0',
                effects: ['get_idea'],
                actions: ['develop_idea'],
                cost: 1000,
                income: 200
            };
        }
        
        if (position === 5) {
            return {
                type: 'goal',
                name: 'Цель',
                description: 'Поставьте финансовую цель',
                icon: '🎯',
                color: '#F44336',
                effects: ['set_goal'],
                actions: ['define_goal'],
                cost: 0,
                income: 0
            };
        }
        
        // Продолжаем для остальных клеток...
        // Для краткости показываем основные типы
        
        if (position >= 6 && position <= 44) {
            const types = ['money', 'property', 'vehicle', 'idea', 'goal', 'shopping', 'business'];
            const icons = ['💰', '🏠', '🚗', '💡', '🎯', '🛒', '💼'];
            const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#E91E63', '#795548'];
            
            const typeIndex = (position - 6) % types.length;
            const type = types[typeIndex];
            
            return {
                type: type,
                name: this.getTypeName(type),
                description: this.getTypeDescription(type),
                icon: icons[typeIndex],
                color: colors[typeIndex],
                effects: [`${type}_action`],
                actions: [`${type}_interaction`],
                cost: Math.floor(Math.random() * 5000) + 1000,
                income: Math.floor(Math.random() * 500) + 100
            };
        }
        
        return {
            type: 'neutral',
            name: `Клетка ${position}`,
            description: 'Нейтральная клетка',
            icon: '⚪',
            color: '#9E9E9E',
            effects: [],
            actions: [],
            cost: 0,
            income: 0
        };
    }
    
    getTypeName(type) {
        const names = {
            'money': 'Деньги',
            'property': 'Недвижимость', 
            'vehicle': 'Транспорт',
            'idea': 'Идея',
            'goal': 'Цель',
            'shopping': 'Покупки',
            'business': 'Бизнес'
        };
        return names[type] || 'Неизвестно';
    }
    
    getTypeDescription(type) {
        const descriptions = {
            'money': 'Получите дополнительные деньги',
            'property': 'Инвестируйте в недвижимость',
            'vehicle': 'Купите транспортное средство',
            'idea': 'Получите новую идею',
            'goal': 'Поставьте финансовую цель',
            'shopping': 'Совершите покупку',
            'business': 'Развивайте бизнес'
        };
        return descriptions[type] || 'Выполните действие';
    }

    /**
     * Получение данных клетки по типу
     * @param {string} cellType - Тип клетки
     * @param {number} position - Позиция
     */
    getCellData(cellType, position) {
        const cellTemplates = {
            [this.cellTypes.PAYDAY]: {
                name: 'PAYDAY',
                description: 'Получите зарплату и оплатите расходы',
                icon: '💰',
                color: '#00ff96',
                effects: {
                    payday: true,
                    income: 2000
                },
                actions: ['payday', 'payExpenses']
            },
            [this.cellTypes.CHARITY]: {
                name: 'Благотворительность',
                description: 'Помогите нуждающимся (10% от дохода)',
                icon: '❤️',
                color: '#ff69b4',
                effects: {
                    charity: true,
                    karma: true
                },
                actions: ['charity', 'skip']
            },
            [this.cellTypes.OPPORTUNITY]: {
                name: 'Возможность',
                description: 'Возможность для инвестиций',
                icon: '🎯',
                color: '#ffd65a',
                effects: {
                    opportunity: true
                },
                actions: ['drawCard', 'invest', 'skip']
            },
            [this.cellTypes.EXPENSE]: {
                name: 'Расходы',
                description: 'Неожиданные расходы',
                icon: '💸',
                color: '#ff3b3b',
                effects: {
                    expense: true
                },
                actions: ['drawCard', 'pay', 'skip']
            },
            [this.cellTypes.MARKET]: {
                name: 'Рынок',
                description: 'Торговля активами',
                icon: '📈',
                color: '#4ecdc4',
                effects: {
                    market: true
                },
                actions: ['buy', 'sell', 'trade']
            },
            [this.cellTypes.DREAM]: {
                name: 'Мечта',
                description: 'Достижение вашей мечты',
                icon: '🌟',
                color: '#ff6b6b',
                effects: {
                    dream: true
                },
                actions: ['achieveDream', 'skip']
            },
            [this.cellTypes.NEUTRAL]: {
                name: 'Обычная клетка',
                description: 'Ничего особенного не происходит',
                icon: '⚪',
                color: '#6b7280',
                effects: {},
                actions: ['skip']
            }
        };

        const template = cellTemplates[cellType] || cellTemplates[this.cellTypes.NEUTRAL];
        
        // Добавляем вариативность для одинаковых типов клеток
        return this.addVariation(template, position);
    }

    /**
     * Добавление вариативности к клетке
     * @param {Object} template - Шаблон клетки
     * @param {number} position - Позиция
     */
    addVariation(template, position) {
        const variations = {
            [this.cellTypes.OPPORTUNITY]: [
                { name: 'Малая возможность', cost: 5000, income: 500 },
                { name: 'Средняя возможность', cost: 15000, income: 1500 },
                { name: 'Большая возможность', cost: 50000, income: 5000 }
            ],
            [this.cellTypes.EXPENSE]: [
                { name: 'Малые расходы', cost: 2000 },
                { name: 'Средние расходы', cost: 8000 },
                { name: 'Большие расходы', cost: 25000 }
            ],
            [this.cellTypes.MARKET]: [
                { name: 'Рынок акций', description: 'Торговля акциями' },
                { name: 'Рынок недвижимости', description: 'Торговля недвижимостью' },
                { name: 'Рынок бизнеса', description: 'Торговля бизнесом' }
            ],
            [this.cellTypes.DREAM]: [
                { name: 'Дом мечты', cost: 100000 },
                { name: 'Путешествие мечты', cost: 50000 },
                { name: 'Бизнес мечты', cost: 200000 }
            ]
        };

        const cellVariations = variations[template.type];
        if (cellVariations) {
            const variation = cellVariations[position % cellVariations.length];
            return {
                ...template,
                ...variation,
                variationIndex: position % cellVariations.length
            };
        }

        return template;
    }

    /**
     * Получение клетки по позиции
     * @param {number} position - Позиция клетки
     */
    getCell(position) {
        if (position < 0 || position >= this.cells.length) {
            return null;
        }
        return this.cells[position];
    }

    /**
     * Получение всех клеток определенного типа
     * @param {string} type - Тип клетки
     */
    getCellsByType(type) {
        return this.cells.filter(cell => cell.type === type);
    }

    /**
     * Получение клеток в радиусе от позиции
     * @param {number} position - Центральная позиция
     * @param {number} radius - Радиус
     */
    getCellsInRadius(position, radius = 2) {
        const cells = [];
        const totalCells = this.cells.length;
        
        for (let i = -radius; i <= radius; i++) {
            const cellPosition = (position + i + totalCells) % totalCells;
            const cell = this.getCell(cellPosition);
            if (cell) {
                cells.push({
                    ...cell,
                    distance: Math.abs(i)
                });
            }
        }
        
        return cells.sort((a, b) => a.distance - b.distance);
    }

    /**
     * Получение статистики клеток
     */
    getCellsStats() {
        const stats = {
            total: this.cells.length,
            byType: {},
            byColor: {},
            totalCost: 0,
            totalIncome: 0
        };

        this.cells.forEach(cell => {
            // Подсчет по типам
            stats.byType[cell.type] = (stats.byType[cell.type] || 0) + 1;
            
            // Подсчет по цветам
            stats.byColor[cell.color] = (stats.byColor[cell.color] || 0) + 1;
            
            // Подсчет стоимости и дохода
            stats.totalCost += cell.cost || 0;
            stats.totalIncome += cell.income || 0;
        });

        return stats;
    }

    /**
     * Обновление клетки
     * @param {number} position - Позиция клетки
     * @param {Object} updates - Обновления
     */
    updateCell(position, updates) {
        if (position < 0 || position >= this.cells.length) {
            return false;
        }

        const cell = this.cells[position];
        Object.assign(cell, updates, { updatedAt: Date.now() });
        
        this.gameCore.eventBus.emit('cellUpdated', { cell, position });
        return true;
    }

    /**
     * Сброс всех клеток
     */
    resetCells() {
        this.cells.forEach(cell => {
            cell.resetAt = Date.now();
        });
        
        this.gameCore.eventBus.emit('cellsReset', { cells: this.cells });
        console.log('🎯 Все клетки сброшены');
    }

    /**
     * Получение информации о поле
     */
    getBoardInfo() {
        return {
            totalCells: this.cells.length,
            cellTypes: Object.keys(this.cellTypes),
            stats: this.getCellsStats(),
            generatedAt: this.cells[0]?.generatedAt || Date.now()
        };
    }

    /**
     * Обработчики событий
     */
    onGameStarted(data) {
        console.log('🎯 Игра началась, генерация поля...');
        this.generateGameBoard();
    }

    onPlayerMoved(data) {
        const cell = this.getCell(data.to);
        if (cell && this.gameCore && this.gameCore.eventBus) {
            this.gameCore.eventBus.emit('playerLandedOnCell', {
                player: data.playerId,
                cell,
                position: data.to
            });
        }
    }

    /**
     * Уничтожение генератора
     */
    destroy() {
        this.cells = [];
        this.isDestroyed = true;
        console.log('🗑️ CellGenerator уничтожен');
    }
}

export default CellGenerator;
