/**
 * Game Board Manager v2.0 - Координатор компонентов игрового поля
 * 
 * Основные возможности:
 * - Координация между GameBoardService и GameBoardUI
 * - Управление состоянием игры
 * - Обработка событий и уведомлений
 * - Интеграция с внешними системами
 */

class GameBoardManager {
    constructor(containerId = 'game-board-container') {
        console.log('🎮 GameBoardManager v2.0: Инициализация');
        
        this.containerId = containerId;
        this.service = null;
        this.ui = null;
        this.isInitialized = false;
        
        // Состояние менеджера
        this.managerState = {
            gameActive: false,
            currentPhase: 'waiting',
            lastUpdate: null,
            errorCount: 0
        };
        
        // Конфигурация
        this.config = {
            autoSave: true,
            autoSaveInterval: 30000, // 30 секунд
            maxErrors: 10,
            debugMode: false
        };
        
        this.initializeManager();
    }

    /**
     * Инициализация менеджера
     */
    async initializeManager() {
        try {
            console.log('🎮 GameBoardManager: Инициализация компонентов');
            
            // Создаем сервис
            this.service = new GameBoardService();
            
            // Создаем UI
            this.ui = new GameBoardUI(this.containerId);
            
            // Ждем инициализации UI
            await this.waitForUI();
            
            // Настраиваем интеграцию
            this.setupIntegration();
            
            // Запускаем автосохранение
            if (this.config.autoSave) {
                this.startAutoSave();
            }
            
            this.isInitialized = true;
            this.managerState.currentPhase = 'ready';
            
            console.log('🎮 GameBoardManager: Менеджер инициализирован');
            this.emit('managerReady');
            
        } catch (error) {
            console.error('🎮 GameBoardManager: Ошибка инициализации', error);
            this.handleError(error);
        }
    }

    /**
     * Ожидание инициализации UI
     */
    async waitForUI() {
        return new Promise((resolve) => {
            const checkUI = () => {
                if (this.ui && this.ui.uiState.isInitialized) {
                    resolve();
                } else {
                    setTimeout(checkUI, 100);
                }
            };
            checkUI();
        });
    }

    /**
     * Настройка интеграции между компонентами
     */
    setupIntegration() {
        console.log('🎮 GameBoardManager: Настройка интеграции');
        
        // События от сервиса к UI
        this.service.on('boardInitialized', (data) => {
            this.ui.updatePlayersPanel(data.players);
            this.ui.showNotification('Игровое поле инициализировано', 'success');
        });
        
        this.service.on('playerMoved', (data) => {
            this.ui.moveToken(data.playerIndex, data.oldPosition, data.newPosition, data.steps);
            this.ui.updatePlayersPanel(this.service.getPlayers());
            this.ui.updateGameInfo(this.service.getGameStats());
            
            if (data.passedGo) {
                this.ui.showNotification(`${data.player} прошел через старт и получил $200!`, 'success');
            }
        });
        
        this.service.on('diceRolled', (data) => {
            this.ui.showNotification(`Выпало: ${data.total}`, 'info');
        });
        
        this.service.on('turnChanged', (data) => {
            this.ui.showNotification(`Ход игрока: ${data.currentPlayer.name}`, 'info');
            this.ui.updateGameInfo(this.service.getGameStats());
        });
        
        this.service.on('moneyUpdated', (data) => {
            this.ui.updatePlayersPanel(this.service.getPlayers());
            if (data.amount > 0) {
                this.ui.showNotification(`${data.player.name} получил $${data.amount}`, 'success');
            } else {
                this.ui.showNotification(`${data.player.name} потратил $${Math.abs(data.amount)}`, 'warning');
            }
        });
        
        this.service.on('playerBankrupt', (data) => {
            this.ui.showNotification(`${data.player.name} обанкротился!`, 'error');
            this.ui.updatePlayersPanel(this.service.getPlayers());
        });
        
        this.service.on('gameReset', () => {
            this.ui.clearAllTokens();
            this.ui.updatePlayersPanel([]);
            this.ui.updateGameInfo({});
            this.ui.showNotification('Игра сброшена', 'info');
        });
        
        // События от UI к сервису
        this.setupUIEvents();
    }

    /**
     * Настройка событий UI
     */
    setupUIEvents() {
        // Здесь можно добавить обработчики событий от UI
        // Например, клики по кнопкам, настройки и т.д.
    }

    /**
     * Начать новую игру
     */
    startGame(players) {
        try {
            console.log('🎮 GameBoardManager: Начало новой игры', players.length, 'игроков');
            
            if (!this.isInitialized) {
                throw new Error('Менеджер не инициализирован');
            }
            
            // Инициализируем поле
            this.service.initializeBoard(players);
            
            // Создаем фишки игроков
            players.forEach((player, index) => {
                this.ui.createPlayerToken(
                    index,
                    player.name,
                    this.service.getPlayerColor(index),
                    0
                );
            });
            
            this.managerState.gameActive = true;
            this.managerState.currentPhase = 'playing';
            this.managerState.lastUpdate = new Date();
            
            this.emit('gameStarted', { players });
            
        } catch (error) {
            console.error('🎮 GameBoardManager: Ошибка начала игры', error);
            this.handleError(error);
        }
    }

    /**
     * Бросить кубик и переместить игрока
     */
    rollDiceAndMove() {
        try {
            if (!this.managerState.gameActive) {
                throw new Error('Игра не активна');
            }
            
            const currentPlayer = this.service.getCurrentPlayer();
            if (!currentPlayer) {
                throw new Error('Текущий игрок не найден');
            }
            
            // Бросаем кубик
            const diceResult = this.service.rollDice();
            
            // Перемещаем игрока
            const moveResult = this.service.movePlayer(this.service.gameState.currentPlayerIndex);
            
            // Передаем ход следующему игроку
            this.service.nextTurn();
            
            this.managerState.lastUpdate = new Date();
            
            return {
                diceResult,
                moveResult,
                currentPlayer: this.service.getCurrentPlayer()
            };
            
        } catch (error) {
            console.error('🎮 GameBoardManager: Ошибка хода', error);
            this.handleError(error);
            return null;
        }
    }

    /**
     * Обновить деньги игрока
     */
    updatePlayerMoney(playerIndex, amount, reason = '') {
        try {
            const newBalance = this.service.updatePlayerMoney(playerIndex, amount, reason);
            this.managerState.lastUpdate = new Date();
            return newBalance;
        } catch (error) {
            console.error('🎮 GameBoardManager: Ошибка обновления денег', error);
            this.handleError(error);
            return null;
        }
    }

    /**
     * Получить статистику игры
     */
    getGameStats() {
        return this.service.getGameStats();
    }

    /**
     * Получить статистику игрока
     */
    getPlayerStats(playerIndex) {
        return this.service.getPlayerStats(playerIndex);
    }

    /**
     * Пауза/возобновление игры
     */
    togglePause() {
        const newPhase = this.service.togglePause();
        this.managerState.currentPhase = newPhase;
        this.managerState.lastUpdate = new Date();
        
        this.emit('gamePaused', { phase: newPhase });
        return newPhase;
    }

    /**
     * Сбросить игру
     */
    resetGame() {
        try {
            this.service.resetGame();
            this.ui.clearAllTokens();
            this.managerState.gameActive = false;
            this.managerState.currentPhase = 'waiting';
            this.managerState.lastUpdate = new Date();
            
            this.emit('gameReset');
            
        } catch (error) {
            console.error('🎮 GameBoardManager: Ошибка сброса игры', error);
            this.handleError(error);
        }
    }

    /**
     * Запустить автосохранение
     */
    startAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        this.autoSaveInterval = setInterval(() => {
            this.saveGameState();
        }, this.config.autoSaveInterval);
        
        console.log('🎮 GameBoardManager: Автосохранение запущено');
    }

    /**
     * Остановить автосохранение
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        
        console.log('🎮 GameBoardManager: Автосохранение остановлено');
    }

    /**
     * Сохранить состояние игры
     */
    saveGameState() {
        try {
            const gameState = {
                service: this.service.gameState,
                manager: this.managerState,
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem('monopoly_game_state', JSON.stringify(gameState));
            console.log('🎮 GameBoardManager: Состояние игры сохранено');
            
        } catch (error) {
            console.error('🎮 GameBoardManager: Ошибка сохранения', error);
        }
    }

    /**
     * Загрузить состояние игры
     */
    loadGameState() {
        try {
            const savedState = localStorage.getItem('monopoly_game_state');
            if (!savedState) {
                console.log('🎮 GameBoardManager: Сохраненное состояние не найдено');
                return false;
            }
            
            const gameState = JSON.parse(savedState);
            
            // Восстанавливаем состояние сервиса
            this.service.gameState = gameState.service;
            
            // Восстанавливаем состояние менеджера
            this.managerState = gameState.manager;
            
            // Восстанавливаем UI
            this.ui.updatePlayersPanel(this.service.getPlayers());
            this.ui.updateGameInfo(this.service.getGameStats());
            
            // Восстанавливаем фишки
            this.service.getPlayers().forEach((player, index) => {
                this.ui.createPlayerToken(
                    index,
                    player.name,
                    player.color,
                    player.position
                );
            });
            
            console.log('🎮 GameBoardManager: Состояние игры загружено');
            this.emit('gameLoaded', { gameState });
            
            return true;
            
        } catch (error) {
            console.error('🎮 GameBoardManager: Ошибка загрузки', error);
            this.handleError(error);
            return false;
        }
    }

    /**
     * Обработка ошибок
     */
    handleError(error) {
        this.managerState.errorCount++;
        
        console.error('🎮 GameBoardManager: Ошибка', error);
        
        if (this.managerState.errorCount >= this.config.maxErrors) {
            console.error('🎮 GameBoardManager: Превышено максимальное количество ошибок');
            this.emit('maxErrorsReached');
        }
        
        this.emit('error', { error, count: this.managerState.errorCount });
    }

    /**
     * Система событий
     */
    on(event, callback) {
        if (!this.eventListeners) {
            this.eventListeners = new Map();
        }
        
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventListeners && this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventListeners && this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('🎮 GameBoardManager: Ошибка в обработчике события', event, error);
                }
            });
        }
    }

    /**
     * Уничтожение менеджера
     */
    destroy() {
        try {
            this.stopAutoSave();
            
            if (this.service) {
                this.service.resetGame();
            }
            
            if (this.ui) {
                this.ui.clearAllTokens();
            }
            
            this.isInitialized = false;
            this.managerState.gameActive = false;
            
            console.log('🎮 GameBoardManager: Менеджер уничтожен');
            
        } catch (error) {
            console.error('🎮 GameBoardManager: Ошибка при уничтожении', error);
        }
    }
}

// Экспорт для Node.js и браузера
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameBoardManager;
} else {
    window.GameBoardManager = GameBoardManager;
}
