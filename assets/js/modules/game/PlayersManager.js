// Модуль управления игроками и очередью ходов
class PlayersManager {
    constructor() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.playersQueue = document.getElementById('playersQueue');
        this.currentPlayerElement = document.getElementById('currentPlayer');
        
        this.init();
    }

    async init() {
        console.log('🎮 PlayersManager инициализирован');
        this.setupEventListeners();
        await this.loadPlayersData();
        this.renderPlayers();
    }

    // Загрузка данных игроков с сервера
    async loadPlayersData() {
        console.log('🎮 PlayersManager: Loading players data...');
        
        if (window.gameDataApi) {
            try {
                const playersData = await window.gameDataApi.getPlayersData();
                console.log('🎮 PlayersManager: Loaded players data from server:', playersData);
                
                // Очищаем существующих игроков
                this.players = [];
                
                // Добавляем игроков из сервера
                playersData.forEach(playerData => {
                    this.addPlayer(playerData);
                });
                
                console.log('🎮 PlayersManager: Players loaded successfully:', this.players.length);
            } catch (error) {
                console.error('❌ PlayersManager: Failed to load players data:', error);
                this.initTestPlayers();
            }
        } else {
            console.warn('⚠️ PlayersManager: GameDataApi not available, using test data');
            this.initTestPlayers();
        }
    }

    setupEventListeners() {
        // Слушаем события от других модулей
        if (window.EventEmitter) {
            window.EventEmitter.on('playerJoined', this.handlePlayerJoined.bind(this));
            window.EventEmitter.on('playerLeft', this.handlePlayerLeft.bind(this));
            window.EventEmitter.on('turnChanged', this.handleTurnChanged.bind(this));
        }
    }

    // Добавить игрока
    addPlayer(playerData) {
        const player = {
            id: playerData.id || Date.now(),
            name: playerData.name || `Игрок ${this.players.length + 1}`,
            profession: playerData.profession || null,
            avatar: playerData.avatar || this.generateAvatar(playerData.name),
            isReady: playerData.isReady || false,
            isHost: playerData.isHost || false,
            position: playerData.position || 0,
            cash: playerData.cash || 1000,
            assets: playerData.assets || 0,
            income: playerData.income || 0,
            expenses: playerData.expenses || 0
        };

        this.players.push(player);
        console.log('👥 Добавлен игрок:', player);
        
        this.renderPlayers();
        this.emitPlayerUpdate();
        
        return player;
    }

    // Удалить игрока
    removePlayer(playerId) {
        const index = this.players.findIndex(p => p.id === playerId);
        if (index !== -1) {
            const removedPlayer = this.players.splice(index, 1)[0];
            console.log('👥 Удален игрок:', removedPlayer);
            
            // Корректируем индекс текущего игрока
            if (this.currentPlayerIndex >= index && this.currentPlayerIndex > 0) {
                this.currentPlayerIndex--;
            }
            
            this.renderPlayers();
            this.emitPlayerUpdate();
        }
    }

    // Обновить данные игрока
    updatePlayer(playerId, updates) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            Object.assign(player, updates);
            console.log('👥 Обновлен игрок:', player);
            
            this.renderPlayers();
            this.emitPlayerUpdate();
        }
    }

    // Следующий ход
    nextTurn() {
        if (this.players.length === 0) return;
        
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        console.log('🎯 Следующий ход:', this.getCurrentPlayer());
        
        this.renderPlayers();
        this.emitTurnChanged();
    }

    // Получить текущего игрока
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex] || null;
    }

    // Получить всех игроков
    getPlayers() {
        return [...this.players];
    }

    // Генерация аватара
    generateAvatar(name) {
        if (!name) return '👤';
        const firstLetter = name.charAt(0).toUpperCase();
        return firstLetter;
    }

    // Рендер списка игроков
    renderPlayers() {
        if (!this.playersQueue) return;

        this.playersQueue.innerHTML = '';
        
        this.players.forEach((player, index) => {
            const playerElement = this.createPlayerElement(player, index);
            this.playersQueue.appendChild(playerElement);
        });

        this.renderCurrentPlayer();
    }

    // Создать элемент игрока
    createPlayerElement(player, index) {
        const div = document.createElement('div');
        div.className = `player-item ${index === this.currentPlayerIndex ? 'active' : ''}`;
        div.dataset.playerId = player.id;

        div.innerHTML = `
            <div class="player-avatar">${player.avatar}</div>
            <div class="player-info">
                <div class="player-name">${player.name}</div>
                <div class="player-status">
                    ${player.profession ? `💼 ${player.profession.name}` : 'Выбор профессии'} 
                    | 💰 $${player.cash}
                </div>
            </div>
            <div class="player-badges">
                ${player.isHost ? '<span class="badge host">👑</span>' : ''}
                ${player.isReady ? '<span class="badge ready">✅</span>' : ''}
            </div>
        `;

        return div;
    }

    // Рендер текущего игрока
    renderCurrentPlayer() {
        if (!this.currentPlayerElement) return;

        const currentPlayer = this.getCurrentPlayer();
        if (currentPlayer) {
            this.currentPlayerElement.innerHTML = `
                <div class="current-player-title">🎯 Текущий ход</div>
                <div class="player-item active">
                    <div class="player-avatar">${currentPlayer.avatar}</div>
                    <div class="player-info">
                        <div class="player-name">${currentPlayer.name}</div>
                        <div class="player-status">
                            ${currentPlayer.profession ? `💼 ${currentPlayer.profession.name}` : 'Выбор профессии'} 
                            | 💰 $${currentPlayer.cash}
                        </div>
                    </div>
                </div>
            `;
        } else {
            this.currentPlayerElement.innerHTML = `
                <div class="current-player-title">🎯 Текущий ход</div>
                <div class="no-player">Нет игроков</div>
            `;
        }
    }

    // Обработчики событий
    handlePlayerJoined(playerData) {
        this.addPlayer(playerData);
    }

    handlePlayerLeft(playerId) {
        this.removePlayer(playerId);
    }

    handleTurnChanged() {
        this.renderPlayers();
    }

    // Эмит событий
    emitPlayerUpdate() {
        if (window.EventEmitter) {
            window.EventEmitter.emit('playersUpdated', this.players);
        }
    }

    emitTurnChanged() {
        if (window.EventEmitter) {
            window.EventEmitter.emit('turnChanged', this.getCurrentPlayer());
        }
    }

    // Инициализация тестовых данных
    initTestPlayers() {
        console.log('🧪 Инициализация тестовых игроков');
        
        const testPlayers = [
            { name: 'Алексей', profession: { name: 'Предприниматель' }, cash: 10000, isHost: true },
            { name: 'Мария', profession: { name: 'Предприниматель' }, cash: 10000 },
            { name: 'Дмитрий', profession: { name: 'Предприниматель' }, cash: 10000 },
            { name: 'Анна', profession: { name: 'Предприниматель' }, cash: 10000 }
        ];

        testPlayers.forEach(playerData => {
            this.addPlayer(playerData);
        });
    }
}

// Экспорт для использования в других модулях
if (typeof window !== 'undefined') {
    window.PlayersManager = PlayersManager;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎮 PlayersManager: DOM loaded, initializing...');
    if (!window.playersManager) {
        console.log('🎮 PlayersManager: Creating new instance...');
        window.playersManager = new PlayersManager();
        
        // Ждем инициализацию
        await window.playersManager.init();
    } else {
        console.log('🎮 PlayersManager: Already exists, skipping initialization');
    }
});
