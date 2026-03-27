/**
 * Game Board Service v2.0 - Современный модуль для управления игровым полем
 * 
 * Основные возможности:
 * - Управление игроками и их позициями
 * - Логика движения по полю
 * - Система событий и уведомлений
 * - Интеграция с банковской системой
 * - Статистика и аналитика игры
 */

class GameBoardService {
    constructor() {
        console.log('🎲 GameBoardService v2.0: Инициализация');
        
        // Основные параметры игры
        this.config = {
            boardSize: 40,           // Количество клеток на поле
            startMoney: 3000,        // Стартовые деньги
            passGoBonus: 200,        // Бонус за прохождение старта
            maxPlayers: 8,           // Максимальное количество игроков
            diceSides: 6             // Количество сторон кубика
        };
        
        // Состояние игры
        this.gameState = {
            players: [],
            currentPlayerIndex: 0,
            diceValue: 0,
            gamePhase: 'waiting', // waiting, playing, paused, finished
            turnNumber: 0,
            gameStartTime: null,
            lastAction: null
        };
        
        // Система событий
        this.eventListeners = new Map();
        
        // Инициализация
        this.initializeService();
    }

    /**
     * Инициализация сервиса
     */
    initializeService() {
        console.log('🎲 GameBoardService: Сервис инициализирован');
        this.emit('serviceReady');
    }

    /**
     * Инициализировать игровое поле с игроками
     */
    initializeBoard(players) {
        console.log('🎲 GameBoardService: Инициализация поля для', players.length, 'игроков');
        
        if (players.length < 2) {
            throw new Error('Минимум 2 игрока для начала игры');
        }
        
        if (players.length > this.config.maxPlayers) {
            throw new Error(`Максимум ${this.config.maxPlayers} игроков`);
        }

        // Создаем игроков
        this.gameState.players = players.map((player, index) => ({
            id: player._id || player.user_id || `player_${index}`,
            name: player.name || `Игрок ${index + 1}`,
            position: 0,
            color: this.getPlayerColor(index),
            token: this.getPlayerToken(index),
            money: this.config.startMoney,
            properties: [],
            isActive: true,
            stats: {
                totalMoves: 0,
                totalMoneyEarned: 0,
                totalMoneySpent: 0,
                propertiesOwned: 0,
                timesPassedGo: 0,
                jailTime: 0
            },
            effects: {
                inJail: false,
                jailTurns: 0,
                hasGetOutOfJailCard: false,
                isBankrupt: false
            }
        }));

        // Сброс состояния игры
        this.gameState.currentPlayerIndex = 0;
        this.gameState.diceValue = 0;
        this.gameState.gamePhase = 'playing';
        this.gameState.turnNumber = 0;
        this.gameState.gameStartTime = new Date();
        this.gameState.lastAction = null;

        console.log('🎲 GameBoardService: Поле инициализировано', this.gameState.players);
        this.emit('boardInitialized', { players: this.gameState.players });
        
        return this.gameState.players;
    }

    /**
     * Получить цвет игрока
     */
    getPlayerColor(index) {
        const colors = [
            '#FF6B6B', // Красный
            '#4ECDC4', // Бирюзовый  
            '#45B7D1', // Синий
            '#96CEB4', // Зеленый
            '#FFEAA7', // Желтый
            '#DDA0DD', // Фиолетовый
            '#FFB347', // Оранжевый
            '#98D8C8'  // Мятный
        ];
        return colors[index % colors.length];
    }

    /**
     * Получить символ фишки игрока
     */
    getPlayerToken(index) {
        const tokens = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠', '🔶', '🔷'];
        return tokens[index % tokens.length];
    }

    /**
     * Бросить кубик
     */
    rollDice() {
        const dice1 = Math.floor(Math.random() * this.config.diceSides) + 1;
        const dice2 = Math.floor(Math.random() * this.config.diceSides) + 1;
        this.gameState.diceValue = dice1 + dice2;
        
        console.log('🎲 GameBoardService: Выпало', dice1, '+', dice2, '=', this.gameState.diceValue);
        
        this.emit('diceRolled', { 
            dice1, 
            dice2, 
            total: this.gameState.diceValue,
            isDouble: dice1 === dice2
        });
        
        return {
            dice1,
            dice2,
            total: this.gameState.diceValue,
            isDouble: dice1 === dice2
        };
    }

    /**
     * Переместить игрока
     */
    movePlayer(playerIndex, steps = null) {
        if (playerIndex < 0 || playerIndex >= this.gameState.players.length) {
            throw new Error('Неверный индекс игрока');
        }

        const player = this.gameState.players[playerIndex];
        if (!player.isActive || player.effects.isBankrupt) {
            throw new Error('Игрок не может ходить');
        }

        // Используем переданное количество шагов или значение кубика
        const moveSteps = steps !== null ? steps : this.gameState.diceValue;
        const oldPosition = player.position;
        const newPosition = (player.position + moveSteps) % this.config.boardSize;
        
        // Обновляем позицию
        player.position = newPosition;
        player.stats.totalMoves += moveSteps;
        
        // Проверяем прохождение через старт
        const passedGo = this.checkPassedGo(oldPosition, newPosition);
        if (passedGo) {
            player.money += this.config.passGoBonus;
            player.stats.totalMoneyEarned += this.config.passGoBonus;
            player.stats.timesPassedGo++;
            this.emit('playerPassedGo', { player, bonus: this.config.passGoBonus });
        }

        const moveResult = {
            player: player.name,
            playerIndex,
            oldPosition,
            newPosition,
            steps: moveSteps,
            passedGo,
            currentMoney: player.money
        };

        console.log('🎲 GameBoardService: Игрок перемещен', moveResult);
        this.emit('playerMoved', moveResult);
        
        return moveResult;
    }

    /**
     * Проверить, прошел ли игрок через старт
     */
    checkPassedGo(oldPosition, newPosition) {
        return newPosition < oldPosition;
    }

    /**
     * Передать ход следующему игроку
     */
    nextTurn() {
        this.gameState.turnNumber++;
        this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.gameState.players.length;
        
        const currentPlayer = this.getCurrentPlayer();
        console.log('🎲 GameBoardService: Ход передан игроку', currentPlayer.name);
        
        this.emit('turnChanged', { 
            currentPlayer, 
            turnNumber: this.gameState.turnNumber,
            playerIndex: this.gameState.currentPlayerIndex
        });
        
        return this.gameState.currentPlayerIndex;
    }

    /**
     * Получить текущего игрока
     */
    getCurrentPlayer() {
        return this.gameState.players[this.gameState.currentPlayerIndex];
    }

    /**
     * Получить всех игроков
     */
    getPlayers() {
        return this.gameState.players;
    }

    /**
     * Обновить деньги игрока
     */
    updatePlayerMoney(playerIndex, amount, reason = '') {
        if (playerIndex < 0 || playerIndex >= this.gameState.players.length) {
            throw new Error('Неверный индекс игрока');
        }

        const player = this.gameState.players[playerIndex];
        const oldMoney = player.money;
        player.money += amount;
        
        // Обновляем статистику
        if (amount > 0) {
            player.stats.totalMoneyEarned += amount;
        } else {
            player.stats.totalMoneySpent += Math.abs(amount);
        }
        
        // Проверяем банкротство
        if (player.money < 0) {
            player.effects.isBankrupt = true;
            player.isActive = false;
            this.emit('playerBankrupt', { player, oldMoney, newMoney: player.money });
        }
        
        console.log('🎲 GameBoardService: Деньги обновлены', {
            player: player.name,
            amount,
            oldMoney,
            newMoney: player.money,
            reason
        });

        this.emit('moneyUpdated', { player, amount, reason, oldMoney, newMoney: player.money });
        return player.money;
    }

    /**
     * Получить информацию о позиции игрока
     */
    getPlayerPosition(playerIndex) {
        if (playerIndex < 0 || playerIndex >= this.gameState.players.length) {
            return null;
        }
        
        const player = this.gameState.players[playerIndex];
        return {
            position: player.position,
            color: player.color,
            token: player.token,
            name: player.name,
            money: player.money
        };
    }

    /**
     * Получить статистику игры
     */
    getGameStats() {
        const activePlayers = this.gameState.players.filter(p => p.isActive && !p.effects.isBankrupt);
        const gameDuration = this.gameState.gameStartTime ? 
            Date.now() - this.gameState.gameStartTime.getTime() : 0;
            
        return {
            totalPlayers: this.gameState.players.length,
            activePlayers: activePlayers.length,
            currentPlayer: this.gameState.currentPlayerIndex,
            currentPlayerName: this.getCurrentPlayer().name,
            diceValue: this.gameState.diceValue,
            boardSize: this.config.boardSize,
            gamePhase: this.gameState.gamePhase,
            turnNumber: this.gameState.turnNumber,
            gameDuration: Math.floor(gameDuration / 1000), // в секундах
            lastAction: this.gameState.lastAction
        };
    }

    /**
     * Получить детальную статистику игрока
     */
    getPlayerStats(playerIndex) {
        if (playerIndex < 0 || playerIndex >= this.gameState.players.length) {
            return null;
        }
        
        const player = this.gameState.players[playerIndex];
        return {
            ...player,
            stats: { ...player.stats },
            effects: { ...player.effects }
        };
    }

    /**
     * Система событий
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('🎲 GameBoardService: Ошибка в обработчике события', event, error);
                }
            });
        }
    }

    /**
     * Сбросить игру
     */
    resetGame() {
        this.gameState.players = [];
        this.gameState.currentPlayerIndex = 0;
        this.gameState.diceValue = 0;
        this.gameState.gamePhase = 'waiting';
        this.gameState.turnNumber = 0;
        this.gameState.gameStartTime = null;
        this.gameState.lastAction = null;
        
        console.log('🎲 GameBoardService: Игра сброшена');
        this.emit('gameReset');
    }

    /**
     * Пауза/возобновление игры
     */
    togglePause() {
        if (this.gameState.gamePhase === 'playing') {
            this.gameState.gamePhase = 'paused';
            this.emit('gamePaused');
        } else if (this.gameState.gamePhase === 'paused') {
            this.gameState.gamePhase = 'playing';
            this.emit('gameResumed');
        }
        
        return this.gameState.gamePhase;
    }
}

// Экспорт для Node.js и браузера
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameBoardService;
} else {
    window.GameBoardService = GameBoardService;
}