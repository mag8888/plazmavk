/**
 * Dice - модуль кубиков
 */
class Dice {
    constructor(gameCore = null) {
        this.gameCore = gameCore;
        this.currentRoll = null;
        this.rollHistory = [];
        this.eventBus = gameCore?.eventBus || null;
        this.state = gameCore?.state || null;
    }

    /**
     * Инициализация модуля
     */
    async init() {
        console.log('🎲 Initializing Dice module...');
        
        this.eventBus = window.gameCore?.eventBus;
        this.state = window.gameCore?.state;
        
        this.setupEvents();
        
        console.log('✅ Dice module initialized');
    }

    /**
     * Настройка событий
     */
    setupEvents() {
        if (this.eventBus) {
            this.eventBus.on('rollDice', this.roll.bind(this));
            this.eventBus.on('gameStarted', this.onGameStarted.bind(this));
            this.eventBus.on('gameStopped', this.onGameStopped.bind(this));
        }
    }

    /**
     * Бросок кубика
     */
    roll() {
        const result = Math.floor(Math.random() * 6) + 1;
        this.currentRoll = result;
        this.rollHistory.push({
            value: result,
            timestamp: Date.now()
        });

        console.log(`🎲 Rolled: ${result}`);
        
        // Эмитируем событие
        if (this.eventBus) {
            this.eventBus.emit('diceRolled', result);
        }

        return result;
    }

    /**
     * Получение текущего броска
     */
    getCurrentRoll() {
        return this.currentRoll;
    }

    /**
     * Получение истории бросков
     */
    getRollHistory() {
        return this.rollHistory;
    }

    /**
     * Очистка истории
     */
    clearHistory() {
        this.rollHistory = [];
        this.currentRoll = null;
    }

    /**
     * Обработка начала игры
     */
    onGameStarted() {
        this.clearHistory();
    }

    /**
     * Обработка остановки игры
     */
    onGameStopped() {
        this.clearHistory();
    }
}

// Экспорт в window для глобального доступа
window.Dice = Dice;
