/**
 * Player - модуль игроков
 */
class Player {
    constructor(gameCore = null) {
        this.gameCore = gameCore;
        this.players = new Map();
        this.currentPlayer = null;
        this.eventBus = gameCore?.eventBus || null;
        this.state = gameCore?.state || null;
    }

    /**
     * Инициализация модуля
     */
    async init() {
        console.log('👤 Initializing Player module...');
        
        this.eventBus = window.gameCore?.eventBus;
        this.state = window.gameCore?.state;
        
        this.setupEvents();
        
        console.log('✅ Player module initialized');
    }

    /**
     * Настройка событий
     */
    setupEvents() {
        if (this.eventBus) {
            this.eventBus.on('playerJoined', this.onPlayerJoined.bind(this));
            this.eventBus.on('playerLeft', this.onPlayerLeft.bind(this));
            this.eventBus.on('playerMoved', this.onPlayerMoved.bind(this));
            this.eventBus.on('gameStarted', this.onGameStarted.bind(this));
            this.eventBus.on('gameStopped', this.onGameStopped.bind(this));
        }
    }

    /**
     * Добавление игрока
     */
    addPlayer(playerData) {
        const player = {
            id: playerData.id || this.generatePlayerId(),
            name: playerData.name || 'Игрок',
            avatar: playerData.avatar || null,
            position: playerData.position || 0,
            balance: playerData.balance || 10000,
            token: playerData.token || null,
            dream: playerData.dream || null,
            isReady: playerData.isReady || false,
            isHost: playerData.isHost || false,
            stats: {
                turnsTaken: 0,
                diceRolled: 0,
                dealsBought: 0,
                dealsSkipped: 0,
                assetsSold: 0,
                incomeReceived: 0,
                expensesPaid: 0
            }
        };

        this.players.set(player.id, player);
        
        console.log(`👤 Player added: ${player.name}`);
        
        // Эмитируем событие
        if (this.eventBus) {
            this.eventBus.emit('playerAdded', player);
        }

        return player;
    }

    /**
     * Удаление игрока
     */
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            this.players.delete(playerId);
            
            console.log(`👤 Player removed: ${player.name}`);
            
            // Эмитируем событие
            if (this.eventBus) {
                this.eventBus.emit('playerRemoved', player);
            }
        }
        return player;
    }

    /**
     * Получение игрока по ID
     */
    getPlayer(playerId) {
        return this.players.get(playerId);
    }

    /**
     * Получение всех игроков
     */
    getAllPlayers() {
        return Array.from(this.players.values());
    }

    /**
     * Установка текущего игрока
     */
    setCurrentPlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            this.currentPlayer = player;
            
            // Обновляем состояние
            if (this.state) {
                this.state.setState('currentPlayer', player);
            }
            
            console.log(`👤 Current player set: ${player.name}`);
            
            // Эмитируем событие
            if (this.eventBus) {
                this.eventBus.emit('currentPlayerChanged', player);
            }
        }
        return player;
    }

    /**
     * Получение текущего игрока
     */
    getCurrentPlayer() {
        return this.currentPlayer;
    }

    /**
     * Перемещение игрока
     */
    movePlayer(playerId, newPosition) {
        const player = this.players.get(playerId);
        if (player) {
            const oldPosition = player.position;
            player.position = newPosition;
            
            console.log(`👤 Player ${player.name} moved from ${oldPosition} to ${newPosition}`);
            
            // Эмитируем событие
            if (this.eventBus) {
                this.eventBus.emit('playerMoved', player, oldPosition, newPosition);
            }
        }
        return player;
    }

    /**
     * Обновление баланса игрока
     */
    updateBalance(playerId, amount, reason = '') {
        const player = this.players.get(playerId);
        if (player) {
            player.balance += amount;
            
            console.log(`💰 Player ${player.name} balance updated: ${amount} (${reason})`);
            
            // Эмитируем событие
            if (this.eventBus) {
                this.eventBus.emit('playerBalanceUpdated', player, amount, reason);
            }
        }
        return player;
    }

    /**
     * Генерация ID игрока
     */
    generatePlayerId() {
        return 'player_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    /**
     * Обработка присоединения игрока
     */
    onPlayerJoined(player) {
        console.log(`👤 Player joined: ${player.name}`);
    }

    /**
     * Обработка выхода игрока
     */
    onPlayerLeft(player) {
        console.log(`👤 Player left: ${player.name}`);
    }

    /**
     * Обработка движения игрока
     */
    onPlayerMoved(player, fromPosition, toPosition) {
        console.log(`👤 Player ${player.name} moved from ${fromPosition} to ${toPosition}`);
    }

    /**
     * Обработка начала игры
     */
    onGameStarted() {
        console.log('🎮 Game started - initializing players');
    }

    /**
     * Обработка остановки игры
     */
    onGameStopped() {
        console.log('🛑 Game stopped - clearing players');
        this.players.clear();
        this.currentPlayer = null;
    }
}

// Экспорт в window для глобального доступа
window.Player = Player;
