/**
 * Менеджер игроков для игры "Энергия денег"
 * Управляет данными игроков, их состоянием и переключением ходов
 */

export class PlayerManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.players = [];
        this.currentPlayerIndex = 0;
        this.playerStates = new Map();
        this.isDestroyed = false;
    }

    /**
     * Инициализация PlayerManager
     */
    async init() {
        console.log('👥 PlayerManager инициализирован');
        
        // Подписка на события
        this.gameCore.eventBus.on('gameStarted', this.onGameStarted.bind(this));
        this.gameCore.eventBus.on('playerTurnEnded', this.onPlayerTurnEnded.bind(this));
    }

    /**
     * Добавление игрока
     * @param {Object} playerData - Данные игрока
     */
    addPlayer(playerData) {
        if (this.isDestroyed) {
            console.warn('PlayerManager уничтожен, добавление игрока невозможно');
            return null;
        }

        const player = this.createPlayer(playerData);
        this.players.push(player);
        this.playerStates.set(player.id, this.createPlayerState(player));
        
        console.log(`✅ Игрок ${player.name} добавлен`);
        
        // Эмиссия события
        this.gameCore.eventBus.emit('playerAdded', player);
        
        return player;
    }

    /**
     * Создание объекта игрока
     * @param {Object} playerData - Данные игрока
     */
    createPlayer(playerData) {
        return {
            id: playerData.id || this.generatePlayerId(),
            name: playerData.name || 'Игрок',
            avatar: playerData.avatar || null,
            color: playerData.color || this.generatePlayerColor(),
            balance: playerData.balance || (this.gameCore?.config?.players?.startingBalance || 1000),
            position: playerData.position || (this.gameCore?.config?.players?.startingPosition || 0),
            track: playerData.track || 'inner', // inner или outer
            isActive: playerData.isActive !== false,
            isBankrupt: false,
            creditAmount: 0,
            monthlyIncome: playerData.monthlyIncome || 0,
            monthlyExpenses: playerData.monthlyExpenses || 0,
            assets: playerData.assets || [],
            passiveIncome: playerData.passiveIncome || 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    }

    /**
     * Создание состояния игрока
     * @param {Object} player - Игрок
     */
    createPlayerState(player) {
        return {
            isMoving: false,
            isRollingDice: false,
            isProcessingCard: false,
            lastDiceRoll: null,
            currentTurn: 0,
            totalTurns: 0,
            doubleRolls: 0,
            lastPayday: null,
            lastCharity: null,
            bankruptcyCount: 0
        };
    }

    /**
     * Получение игрока по ID
     * @param {string} playerId - ID игрока
     */
    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    /**
     * Получение всех игроков
     */
    getAllPlayers() {
        return [...this.players];
    }

    /**
     * Получение активных игроков
     */
    getActivePlayers() {
        return this.players.filter(p => p.isActive && !p.isBankrupt);
    }

    /**
     * Получение текущего игрока
     */
    getCurrentPlayer() {
        if (this.players.length === 0) {
            return null;
        }
        
        return this.players[this.currentPlayerIndex];
    }

    /**
     * Получение состояния игрока
     * @param {string} playerId - ID игрока
     */
    getPlayerState(playerId) {
        return this.playerStates.get(playerId);
    }

    /**
     * Обновление данных игрока
     * @param {string} playerId - ID игрока
     * @param {Object} updates - Обновления
     */
    updatePlayer(playerId, updates) {
        const player = this.getPlayer(playerId);
        if (!player) {
            console.warn(`Игрок с ID ${playerId} не найден`);
            return false;
        }

        const oldPlayer = { ...player };
        
        // Обновление данных
        Object.assign(player, updates);
        player.updatedAt = Date.now();

        // Эмиссия события
        this.gameCore.eventBus.emit('playerUpdated', {
            player,
            oldPlayer,
            updates
        });

        console.log(`👤 Игрок ${player.name} обновлен:`, updates);
        return true;
    }

    /**
     * Обновление баланса игрока
     * @param {string} playerId - ID игрока
     * @param {number} amount - Сумма изменения
     * @param {string} description - Описание операции
     */
    updateBalance(playerId, amount, description = '') {
        const player = this.getPlayer(playerId);
        if (!player) {
            return false;
        }

        const oldBalance = player.balance;
        player.balance += amount;
        player.updatedAt = Date.now();

        // Проверка банкротства
        if (player.balance < 0 && player.creditAmount === 0) {
            this.processBankruptcy(player);
        }

        // Эмиссия события
        this.gameCore.eventBus.emit('playerBalanceChanged', {
            player,
            oldBalance,
            newBalance: player.balance,
            amount,
            description
        });

        return true;
    }

    /**
     * Обновление позиции игрока
     * @param {string} playerId - ID игрока
     * @param {number} position - Новая позиция
     * @param {string} track - Трек (inner/outer)
     */
    updatePosition(playerId, position, track = null) {
        const player = this.getPlayer(playerId);
        if (!player) {
            return false;
        }

        const oldPosition = player.position;
        const oldTrack = player.track;
        
        player.position = position;
        if (track) {
            player.track = track;
        }
        player.updatedAt = Date.now();

        // Эмиссия события
        this.gameCore.eventBus.emit('playerPositionChanged', {
            player,
            oldPosition,
            newPosition: position,
            oldTrack,
            newTrack: player.track
        });

        return true;
    }

    /**
     * Переход к следующему игроку
     */
    nextPlayer() {
        if (this.players.length === 0) {
            return null;
        }

        const oldPlayer = this.getCurrentPlayer();
        
        // Поиск следующего активного игрока
        let attempts = 0;
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            attempts++;
        } while (!this.getCurrentPlayer().isActive && attempts < this.players.length);

        const newPlayer = this.getCurrentPlayer();
        
        // Эмиссия события
        this.gameCore.eventBus.emit('currentPlayerChanged', {
            oldPlayer,
            newPlayer,
            oldIndex: this.currentPlayerIndex,
            newIndex: this.currentPlayerIndex
        });

        return newPlayer;
    }

    /**
     * Установка текущего игрока
     * @param {string} playerId - ID игрока
     */
    setCurrentPlayer(playerId) {
        const index = this.players.findIndex(p => p.id === playerId);
        if (index === -1) {
            console.warn(`Игрок с ID ${playerId} не найден`);
            return false;
        }

        const oldPlayer = this.getCurrentPlayer();
        this.currentPlayerIndex = index;
        const newPlayer = this.getCurrentPlayer();

        // Эмиссия события
        this.gameCore.eventBus.emit('currentPlayerChanged', {
            oldPlayer,
            newPlayer,
            oldIndex: this.currentPlayerIndex,
            newIndex: this.currentPlayerIndex
        });

        return true;
    }

    /**
     * Обработка банкротства игрока
     * @param {Object} player - Игрок
     */
    processBankruptcy(player) {
        if (player.isBankrupt) {
            return;
        }

        console.log(`💸 Игрок ${player.name} обанкротился`);
        
        player.isBankrupt = true;
        player.balance = 0;
        player.creditAmount = 0;
        player.assets = [];
        player.passiveIncome = 0;
        player.position = this.gameCore?.config?.players?.startingPosition || 0;
        player.track = 'inner';
        player.updatedAt = Date.now();

        // Обновление состояния
        const state = this.getPlayerState(player.id);
        if (state) {
            state.bankruptcyCount++;
        }

        // Эмиссия события
        this.gameCore.eventBus.emit('playerBankrupted', {
            player,
            bankruptcyCount: state?.bankruptcyCount || 1
        });
    }

    /**
     * Восстановление игрока после банкротства
     * @param {string} playerId - ID игрока
     */
    restorePlayer(playerId) {
        const player = this.getPlayer(playerId);
        if (!player || !player.isBankrupt) {
            return false;
        }

        player.isBankrupt = false;
        player.balance = this.gameCore?.config?.players?.startingBalance || 1000;
        player.position = this.gameCore?.config?.players?.startingPosition || 0;
        player.track = 'inner';
        player.updatedAt = Date.now();

        console.log(`🔄 Игрок ${player.name} восстановлен после банкротства`);

        // Эмиссия события
        this.gameCore.eventBus.emit('playerRestored', player);

        return true;
    }

    /**
     * Получение статистики игроков
     */
    getStats() {
        const activePlayers = this.getActivePlayers();
        const bankruptPlayers = this.players.filter(p => p.isBankrupt);
        
        return {
            totalPlayers: this.players.length,
            activePlayers: activePlayers.length,
            bankruptPlayers: bankruptPlayers.length,
            currentPlayerIndex: this.currentPlayerIndex,
            currentPlayer: this.getCurrentPlayer()?.name || 'Нет игрока',
            totalBalance: activePlayers.reduce((sum, p) => sum + p.balance, 0),
            averageBalance: activePlayers.length > 0 ? 
                activePlayers.reduce((sum, p) => sum + p.balance, 0) / activePlayers.length : 0
        };
    }

    /**
     * Генерация ID игрока
     */
    generatePlayerId() {
        return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Генерация цвета игрока
     */
    generatePlayerColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
        const usedColors = this.players.map(p => p.color);
        const availableColors = colors.filter(c => !usedColors.includes(c));
        
        return availableColors.length > 0 ? 
            availableColors[0] : 
            colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Обработчики событий
     */
    onGameStarted(data) {
        console.log('🎮 Игра началась, инициализация игроков');
    }

    onPlayerTurnEnded(player) {
        // Переход к следующему игроку
        this.nextPlayer();
    }

    /**
     * Уничтожение PlayerManager
     */
    destroy() {
        this.players = [];
        this.playerStates.clear();
        this.currentPlayerIndex = 0;
        this.isDestroyed = true;
        console.log('🗑️ PlayerManager уничтожен');
    }
}

export default PlayerManager;
