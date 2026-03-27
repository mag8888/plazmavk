/**
 * Модуль кубиков для игры "Энергия денег"
 * Управляет бросанием кубиков, анимацией и обработкой результатов
 */

export class DiceModule {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.dice = [0, 0];
        this.isRolling = false;
        this.rollHistory = [];
        this.maxHistorySize = 50;
        this.isDestroyed = false;
    }

    /**
     * Инициализация модуля кубиков
     */
    async init() {
        console.log('🎲 DiceModule инициализирован');
        
        // Подписка на события
        this.gameCore.eventBus.on('diceRollRequested', this.onDiceRollRequested.bind(this));
        this.gameCore.eventBus.on('playerTurnStarted', this.onPlayerTurnStarted.bind(this));
    }

    /**
     * Бросок кубиков
     * @param {Object} options - Опции броска
     */
    async roll(options = {}) {
        if (this.isRolling) {
            console.warn('Кубики уже брошены, ожидание завершения');
            return null;
        }

        if (this.isDestroyed) {
            console.warn('DiceModule уничтожен, бросок невозможен');
            return null;
        }

        try {
            this.isRolling = true;
            
            // Эмиссия события начала броска
            this.gameCore.eventBus.emit('diceRollStart', {
                timestamp: Date.now(),
                options
            });

            // Анимация броска
            if (options.animate !== false) {
                await this.animateRoll();
            }

            // Генерация результата
            const result = this.generateRollResult(options);
            this.dice = result.values;
            
            // Сохранение в историю
            this.saveToHistory(result);
            
            // Эмиссия события завершения броска
            this.gameCore.eventBus.emit('diceRolled', {
                result,
                timestamp: Date.now(),
                options
            });

            console.log(`🎲 Кубики брошены: ${result.values.join(' + ')} = ${result.total}`);
            
            return result;

        } catch (error) {
            console.error('Ошибка при броске кубиков:', error);
            this.gameCore.eventBus.emit('diceRollError', { error });
            return null;
        } finally {
            this.isRolling = false;
        }
    }

    /**
     * Генерация результата броска
     * @param {Object} options - Опции броска
     */
    generateRollResult(options = {}) {
        const config = this.gameCore.config.dice;
        
        const die1 = this.generateDieValue(config, options);
        const die2 = this.generateDieValue(config, options);
        
        const values = [die1, die2];
        const total = values.reduce((sum, value) => sum + value, 0);
        const isDouble = die1 === die2;
        
        return {
            values,
            total,
            isDouble,
            canRollAgain: isDouble && config.doubleRollBonus,
            timestamp: Date.now()
        };
    }

    /**
     * Генерация значения кубика
     * @param {Object} config - Конфигурация кубиков
     * @param {Object} options - Опции
     */
    generateDieValue(config, options) {
        // Проверка на фиксированное значение (для тестирования)
        if (options.fixedValue !== undefined) {
            return Math.max(config.minValue, Math.min(config.maxValue, options.fixedValue));
        }
        
        // Обычная генерация
        return Math.floor(Math.random() * (config.maxValue - config.minValue + 1)) + config.minValue;
    }

    /**
     * Анимация броска кубиков
     */
    async animateRoll() {
        const animationDuration = this.gameCore.config.ui.animationDuration;
        
        // Получение DOM элементов кубиков
        const diceElements = document.querySelectorAll('.dice');
        
        if (diceElements.length === 0) {
            // Если нет DOM элементов, просто ждем
            await this.delay(animationDuration);
            return;
        }

        // Анимация вращения
        diceElements.forEach(die => {
            die.style.animation = `diceRoll ${animationDuration}ms ease-in-out`;
        });

        // Ожидание завершения анимации
        await this.delay(animationDuration);

        // Сброс анимации
        diceElements.forEach(die => {
            die.style.animation = '';
        });
    }

    /**
     * Обновление отображения кубиков
     * @param {Array} values - Значения кубиков
     */
    updateDisplay(values) {
        const diceElements = document.querySelectorAll('.dice');
        
        diceElements.forEach((die, index) => {
            if (values[index] !== undefined) {
                die.textContent = values[index];
                die.dataset.value = values[index];
            }
        });

        // Обновление общего результата
        const totalElement = document.querySelector('.dice-total');
        if (totalElement && values.length > 0) {
            const total = values.reduce((sum, value) => sum + value, 0);
            totalElement.textContent = total;
        }
    }

    /**
     * Сохранение в историю бросков
     * @param {Object} result - Результат броска
     */
    saveToHistory(result) {
        this.rollHistory.push({
            ...result,
            playerId: this.gameCore.state.getState('currentPlayerId'),
            playerName: this.getCurrentPlayerName()
        });

        // Ограничение размера истории
        if (this.rollHistory.length > this.maxHistorySize) {
            this.rollHistory.shift();
        }
    }

    /**
     * Получение истории бросков
     * @param {number} limit - Лимит записей
     */
    getHistory(limit = 10) {
        return this.rollHistory.slice(-limit);
    }

    /**
     * Получение статистики бросков
     */
    getStats() {
        if (this.rollHistory.length === 0) {
            return {
                totalRolls: 0,
                averageRoll: 0,
                doublesCount: 0,
                doublesPercentage: 0,
                mostCommonRoll: null
            };
        }

        const totalRolls = this.rollHistory.length;
        const doublesCount = this.rollHistory.filter(r => r.isDouble).length;
        const totalSum = this.rollHistory.reduce((sum, r) => sum + r.total, 0);
        const averageRoll = totalSum / totalRolls;
        
        // Подсчет частоты результатов
        const rollCounts = {};
        this.rollHistory.forEach(r => {
            rollCounts[r.total] = (rollCounts[r.total] || 0) + 1;
        });
        
        const mostCommonRoll = Object.keys(rollCounts).reduce((a, b) => 
            rollCounts[a] > rollCounts[b] ? a : b
        );

        return {
            totalRolls,
            averageRoll: Math.round(averageRoll * 100) / 100,
            doublesCount,
            doublesPercentage: Math.round((doublesCount / totalRolls) * 100),
            mostCommonRoll: parseInt(mostCommonRoll)
        };
    }

    /**
     * Получение имени текущего игрока
     */
    getCurrentPlayerName() {
        const playerManager = this.gameCore.getModule('playerManager');
        if (playerManager) {
            const currentPlayer = playerManager.getCurrentPlayer();
            return currentPlayer ? currentPlayer.name : 'Неизвестный игрок';
        }
        return 'Неизвестный игрок';
    }

    /**
     * Проверка возможности повторного броска
     */
    canRollAgain() {
        if (this.rollHistory.length === 0) {
            return false;
        }
        
        const lastRoll = this.rollHistory[this.rollHistory.length - 1];
        return lastRoll.canRollAgain && !this.isRolling;
    }

    /**
     * Сброс состояния кубиков
     */
    reset() {
        this.dice = [0, 0];
        this.isRolling = false;
        this.updateDisplay([0, 0]);
        
        console.log('🎲 Состояние кубиков сброшено');
    }

    /**
     * Установка фиксированного результата (для тестирования)
     * @param {Array} values - Фиксированные значения
     */
    setFixedResult(values) {
        if (values.length !== 2) {
            console.warn('Неверное количество значений для кубиков');
            return;
        }

        const config = this.gameCore.config.dice;
        const validValues = values.map(v => 
            Math.max(config.minValue, Math.min(config.maxValue, v))
        );

        this.dice = validValues;
        this.updateDisplay(validValues);
        
        console.log(`🎲 Установлен фиксированный результат: ${validValues.join(' + ')}`);
    }

    /**
     * Получение текущих значений кубиков
     */
    getCurrentValues() {
        return [...this.dice];
    }

    /**
     * Получение суммы текущих кубиков
     */
    getCurrentTotal() {
        return this.dice.reduce((sum, value) => sum + value, 0);
    }

    /**
     * Утилита для задержки
     * @param {number} ms - Миллисекунды
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Обработчики событий
     */
    onDiceRollRequested(data) {
        this.roll(data.options);
    }

    onPlayerTurnStarted(player) {
        // Сброс состояния кубиков при начале хода
        this.reset();
    }

    /**
     * Уничтожение модуля кубиков
     */
    destroy() {
        this.dice = [0, 0];
        this.isRolling = false;
        this.rollHistory = [];
        this.isDestroyed = true;
        console.log('🗑️ DiceModule уничтожен');
    }
}

export default DiceModule;
