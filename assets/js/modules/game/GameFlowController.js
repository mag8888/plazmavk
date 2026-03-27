/**
 * Контроллер игрового процесса для игры "Энергия денег"
 * Объединяет бросок кубика, движение и обработку событий
 */

export class GameFlowController {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.isProcessing = false;
        this.currentAction = null;
        this.actionHistory = [];
        this.isDestroyed = false;
    }

    /**
     * Инициализация контроллера игрового процесса
     */
    async init() {
        console.log('🎯 GameFlowController инициализирован');
        
        // Подписка на события
        this.gameCore.eventBus.on('turnStarted', this.onTurnStarted.bind(this));
        this.gameCore.eventBus.on('diceRolled', this.onDiceRolled.bind(this));
        this.gameCore.eventBus.on('playerMoved', this.onPlayerMoved.bind(this));
        this.gameCore.eventBus.on('playerLandedOnCell', this.onPlayerLandedOnCell.bind(this));
    }

    /**
     * Выполнение полного игрового хода
     * @param {string} playerId - ID игрока
     */
    async executeTurn(playerId) {
        if (this.isProcessing) {
            console.warn('Игровой процесс уже выполняется');
            return false;
        }

        try {
            this.isProcessing = true;
            this.currentAction = {
                playerId,
                startTime: Date.now(),
                steps: []
            };

            console.log(`🎯 Начало игрового хода для игрока ${playerId}`);

            // 1. Бросок кубика
            const diceResult = await this.rollDice(playerId);
            if (!diceResult) {
                throw new Error('Не удалось бросить кубик');
            }

            // 2. Движение игрока
            const moveResult = await this.movePlayer(playerId, diceResult.total);
            if (!moveResult) {
                throw new Error('Не удалось переместить игрока');
            }

            // 3. Обработка события на клетке
            const cellEvent = await this.processCellEvent(playerId, moveResult.cell);
            
            // 4. Завершение хода
            const turnResult = {
                diceResult,
                moveResult,
                cellEvent,
                duration: Date.now() - this.currentAction.startTime
            };

            this.saveActionHistory(turnResult);
            console.log(`🎯 Игровой ход завершен для игрока ${playerId}`);

            this.gameCore.eventBus.emit('turnCompleted', {
                playerId,
                result: turnResult
            });

            return turnResult;

        } catch (error) {
            console.error('Ошибка выполнения игрового хода:', error);
            this.gameCore.eventBus.emit('turnError', {
                playerId,
                error: error.message
            });
            return null;
        } finally {
            this.isProcessing = false;
            this.currentAction = null;
        }
    }

    /**
     * Бросок кубика
     * @param {string} playerId - ID игрока
     */
    async rollDice(playerId) {
        const diceModule = this.gameCore.getModule('diceModule');
        if (!diceModule) {
            throw new Error('Модуль кубиков не найден');
        }

        console.log(`🎲 Бросок кубика для игрока ${playerId}`);
        
        const result = await diceModule.roll();
        if (result) {
            this.currentAction.steps.push({
                type: 'diceRoll',
                result,
                timestamp: Date.now()
            });
        }

        return result;
    }

    /**
     * Движение игрока
     * @param {string} playerId - ID игрока
     * @param {number} steps - Количество шагов
     */
    async movePlayer(playerId, steps) {
        const movementModule = this.gameCore.getModule('movementModule');
        if (!movementModule) {
            throw new Error('Модуль движения не найден');
        }

        console.log(`🚶 Движение игрока ${playerId} на ${steps} шагов`);
        
        const result = await movementModule.movePlayer(playerId, steps);
        if (result) {
            this.currentAction.steps.push({
                type: 'movement',
                result,
                timestamp: Date.now()
            });
        }

        return result;
    }

    /**
     * Обработка события на клетке
     * @param {string} playerId - ID игрока
     * @param {Object} cell - Клетка
     */
    async processCellEvent(playerId, cell) {
        if (!cell) {
            console.warn('Клетка не найдена для обработки события');
            return null;
        }

        console.log(`⚡ Обработка события на клетке "${cell.name}" для игрока ${playerId}`);

        const eventModule = this.gameCore.getModule('eventModule');
        if (!eventModule) {
            console.warn('Модуль событий не найден, пропускаем обработку');
            return null;
        }

        // Создаем событие на основе типа клетки
        const eventType = this.getEventTypeFromCell(cell);
        const eventData = {
            type: eventType,
            playerId,
            cell,
            position: cell.position
        };

        const result = await eventModule.queueEvent(eventData);
        
        if (result) {
            this.currentAction.steps.push({
                type: 'cellEvent',
                cell: cell.name,
                eventType,
                result,
                timestamp: Date.now()
            });
        }

        return result;
    }

    /**
     * Определение типа события по клетке
     * @param {Object} cell - Клетка
     */
    getEventTypeFromCell(cell) {
        switch (cell.type) {
            case 'payday':
            case 'yellow_payday':
                return 'receive_salary';
            case 'charity':
            case 'orange_charity':
                return 'charity';
            case 'opportunity':
            case 'green_opportunity':
                return 'card_draw';
            case 'expense':
            case 'pink_expense':
                return 'card_draw';
            case 'market':
            case 'blue_market':
                return 'market_action';
            case 'dream':
                return 'dream_action';
            case 'purple_baby':
                return 'baby_born';
            case 'black_loss':
                return 'job_loss';
            default:
                return 'neutral';
        }
    }

    /**
     * Сохранение истории действий
     * @param {Object} action - Действие
     */
    saveActionHistory(action) {
        this.actionHistory.push({
            ...action,
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
        });

        // Ограничиваем размер истории
        if (this.actionHistory.length > 100) {
            this.actionHistory.shift();
        }
    }

    /**
     * Получение истории действий
     * @param {number} limit - Лимит записей
     */
    getActionHistory(limit = 10) {
        return this.actionHistory.slice(-limit);
    }

    /**
     * Получение статистики игрового процесса
     */
    getGameFlowStats() {
        const totalActions = this.actionHistory.length;
        const averageDuration = totalActions > 0 
            ? this.actionHistory.reduce((sum, action) => sum + action.duration, 0) / totalActions
            : 0;

        const actionsByType = {};
        this.actionHistory.forEach(action => {
            action.steps.forEach(step => {
                actionsByType[step.type] = (actionsByType[step.type] || 0) + 1;
            });
        });

        return {
            totalActions,
            averageDuration: Math.round(averageDuration),
            actionsByType,
            isProcessing: this.isProcessing,
            currentAction: this.currentAction
        };
    }

    /**
     * Обработчики событий
     */
    onTurnStarted(data) {
        console.log(`🎯 Начало хода игрока ${data.playerName}`);
    }

    onDiceRolled(data) {
        console.log(`🎲 Кубик брошен: ${data.result.values.join(' + ')} = ${data.result.total}`);
    }

    onPlayerMoved(data) {
        console.log(`🚶 Игрок ${data.playerId} переместился с ${data.from} на ${data.to}`);
    }

    onPlayerLandedOnCell(data) {
        console.log(`⚡ Игрок ${data.player} попал на клетку "${data.cell.name}"`);
        
        // Эмитируем событие для CardModule и DealsModule
        if (this.gameCore && this.gameCore.eventBus) {
            this.gameCore.eventBus.emit('cellEvent', {
                cellType: data.cell.type || 'unknown',
                playerId: data.player,
                cell: data.cell,
                position: data.position
            });
        }
        
        // Также эмитируем через document для DealsModule
        const cellEvent = new CustomEvent('cellEvent', {
            detail: {
                cellType: data.cell.type || 'unknown',
                playerId: data.player,
                cell: data.cell,
                position: data.position
            }
        });
        document.dispatchEvent(cellEvent);
    }

    /**
     * Уничтожение контроллера
     */
    destroy() {
        this.actionHistory = [];
        this.isProcessing = false;
        this.currentAction = null;
        this.isDestroyed = true;
        console.log('🗑️ GameFlowController уничтожен');
    }
}

export default GameFlowController;
