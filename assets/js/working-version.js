/**
 * WorkingVersion - полнофункциональная рабочая версия игры
 */
class WorkingVersion {
    constructor() {
        this.gameCore = null;
        this.apiClient = null;
        this.isConnected = false;
        this.currentRoom = null;
        this.players = [];
        this.gameBoard = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Initializing working version...');
            
            // Ждем загрузки всех модулей
            await this.waitForModules();
            
            // Создаем экземпляр GameCore
            this.gameCore = new window.GameCore();
            
            // Инициализируем
            await this.gameCore.init();
            
            // Получаем модули
            this.apiClient = this.gameCore.getModule('apiClient');
            this.gameBoard = this.gameCore.getModule('board');
            
            // Настраиваем UI
            this.setupUI();
            
            // Подключаемся к серверу
            await this.connectToServer();
            
            // Инициализируем игровую доску
            this.initializeGameBoard();
            
            console.log('✅ Working version initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize working version:', error);
            this.showError('Ошибка инициализации: ' + error.message);
        }
    }

    async waitForModules() {
        const requiredModules = [
            'EventBus',
            'StateManager', 
            'ModuleManager',
            'ApiClient',
            'Board',
            'Dice',
            'Player',
            'GameCore'
        ];

        for (const moduleName of requiredModules) {
            await this.waitForModule(moduleName);
        }
    }

    async waitForModule(moduleName) {
        return new Promise((resolve) => {
            if (window[moduleName]) {
                resolve();
                return;
            }

            const checkInterval = setInterval(() => {
                if (window[moduleName]) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Таймаут через 5 секунд
            setTimeout(() => {
                clearInterval(checkInterval);
                console.warn(`Module ${moduleName} not loaded after 5 seconds`);
                resolve();
            }, 5000);
        });
    }

    setupUI() {
        // Настраиваем кнопки
        document.getElementById('connectBtn')?.addEventListener('click', () => this.connectToServer());
        document.getElementById('createRoomBtn')?.addEventListener('click', () => this.createRoom());
        document.getElementById('joinRoomBtn')?.addEventListener('click', () => this.joinRoom());
        document.getElementById('rollDiceBtn')?.addEventListener('click', () => this.rollDice());
        document.getElementById('endTurnBtn')?.addEventListener('click', () => this.endTurn());
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refresh());

        // Настраиваем события
        this.gameCore.on('gameStateChanged', (newState) => {
            this.updateGameState(newState);
        });

        this.gameCore.on('currentPlayerChanged', (player) => {
            this.updateCurrentPlayer(player);
        });

        this.gameCore.on('boardUpdated', (cells) => {
            this.updateBoardDisplay(cells);
        });
    }

    async connectToServer() {
        try {
            this.showLoading('Подключение к серверу...');
            
            // Проверяем здоровье сервера
            const health = await this.apiClient.healthCheck();
            console.log('✅ Server health:', health);
            
            this.isConnected = true;
            this.updateGameState('Подключен');
            this.hideLoading();
            this.showSuccess('Успешно подключен к серверу');
            
        } catch (error) {
            console.error('❌ Failed to connect to server:', error);
            this.hideLoading();
            this.showError('Ошибка подключения к серверу: ' + error.message);
        }
    }

    async createRoom() {
        try {
            this.showLoading('Создание комнаты...');
            
            const roomData = {
                name: 'Рабочая комната ' + new Date().toLocaleTimeString(),
                maxPlayers: 8,
                turnTime: 30
            };
            
            const room = await this.apiClient.createRoom(roomData);
            console.log('✅ Room created:', room);
            
            this.currentRoom = room;
            this.updateGameState('В комнате');
            this.hideLoading();
            this.showSuccess('Комната создана: ' + room.name);
            
        } catch (error) {
            console.error('❌ Failed to create room:', error);
            this.hideLoading();
            this.showError('Ошибка создания комнаты: ' + error.message);
        }
    }

    async joinRoom() {
        try {
            this.showLoading('Поиск комнат...');
            
            const rooms = await this.apiClient.getRooms();
            console.log('📋 Available rooms:', rooms);
            
            if (rooms.length === 0) {
                this.hideLoading();
                this.showError('Нет доступных комнат');
                return;
            }
            
            // Присоединяемся к первой комнате
            const room = rooms[0];
            const joinResult = await this.apiClient.joinRoom(room.id);
            console.log('✅ Joined room:', joinResult);
            
            this.currentRoom = room;
            this.updateGameState('В комнате');
            this.hideLoading();
            this.showSuccess('Присоединились к комнате: ' + room.name);
            
        } catch (error) {
            console.error('❌ Failed to join room:', error);
            this.hideLoading();
            this.showError('Ошибка присоединения к комнате: ' + error.message);
        }
    }

    async rollDice() {
        try {
            if (!this.currentRoom) {
                this.showError('Сначала присоединитесь к комнате');
                return;
            }
            
            this.showLoading('Бросок кубика...');
            
            const result = await this.apiClient.rollDice(this.currentRoom.id);
            console.log('🎲 Dice result:', result);
            
            this.hideLoading();
            this.showSuccess('Выпало: ' + result.value);
            
        } catch (error) {
            console.error('❌ Failed to roll dice:', error);
            this.hideLoading();
            this.showError('Ошибка броска кубика: ' + error.message);
        }
    }

    async endTurn() {
        try {
            if (!this.currentRoom) {
                this.showError('Сначала присоединитесь к комнате');
                return;
            }
            
            this.showLoading('Завершение хода...');
            
            const result = await this.apiClient.endTurn(this.currentRoom.id);
            console.log('✅ Turn ended:', result);
            
            this.hideLoading();
            this.showSuccess('Ход завершен');
            
        } catch (error) {
            console.error('❌ Failed to end turn:', error);
            this.hideLoading();
            this.showError('Ошибка завершения хода: ' + error.message);
        }
    }

    async refresh() {
        try {
            this.showLoading('Обновление...');
            
            if (this.currentRoom) {
                const room = await this.apiClient.getRoom(this.currentRoom.id);
                this.currentRoom = room;
                this.updatePlayers(room.players || []);
            }
            
            this.hideLoading();
            this.showSuccess('Данные обновлены');
            
        } catch (error) {
            console.error('❌ Failed to refresh:', error);
            this.hideLoading();
            this.showError('Ошибка обновления: ' + error.message);
        }
    }

    initializeGameBoard() {
        console.log('🎯 Initializing game board...');
        
        // Получаем модуль доски
        const boardModule = this.gameCore.getModule('board');
        if (boardModule) {
            console.log('✅ Board module found');
            
            // Добавляем тестовых игроков для демонстрации
            this.addTestPlayers();
        } else {
            console.warn('⚠️ Board module not found');
        }
        
        console.log('✅ Game board initialized');
    }

    addTestPlayers() {
        const boardModule = this.gameCore.getModule('board');
        if (!boardModule) return;

        // Добавляем тестовых игроков
        const testPlayers = [
            { id: 'player1', name: 'Алиса', position: 0, balance: 10000 },
            { id: 'player2', name: 'Боб', position: 5, balance: 12000 },
            { id: 'player3', name: 'Чарли', position: 10, balance: 8000 }
        ];

        testPlayers.forEach(player => {
            boardModule.addPlayerToken(player);
        });

        console.log('👥 Test players added to board');
    }

    updateBoardDisplay(cells) {
        // Обновляем отображение доски при изменениях
        console.log('🎯 Board updated:', cells);
    }

    onCellClick(cell) {
        console.log('🎯 Cell clicked:', cell);
        this.showSuccess(`Клетка ${cell.id}: ${cell.name}`);
    }

    updateGameState(state) {
        const gameStateElement = document.getElementById('gameState');
        if (gameStateElement) {
            gameStateElement.textContent = state;
        }
    }

    updateCurrentPlayer(player) {
        console.log('👤 Current player updated:', player);
    }

    updatePlayers(players) {
        const playersList = document.getElementById('playersList');
        if (!playersList) return;
        
        playersList.innerHTML = '';
        
        if (players.length === 0) {
            playersList.innerHTML = '<div class="loading">Нет игроков</div>';
            return;
        }
        
        players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            playerItem.innerHTML = `
                <div class="player-avatar">${player.name.charAt(0)}</div>
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-status ${player.isReady ? 'ready' : 'waiting'}">
                        ${player.isReady ? 'Готов' : 'Ожидает'}
                    </div>
                </div>
            `;
            playersList.appendChild(playerItem);
        });
    }

    showLoading(message) {
        const status = document.getElementById('systemStatus');
        if (status) {
            status.innerHTML = `<div class="loading">${message}</div>`;
        }
    }

    hideLoading() {
        const status = document.getElementById('systemStatus');
        if (status) {
            status.innerHTML = '<div class="success">Система работает</div>';
        }
    }

    showError(message) {
        const status = document.getElementById('systemStatus');
        if (status) {
            status.innerHTML = `<div class="error">${message}</div>`;
        }
    }

    showSuccess(message) {
        const status = document.getElementById('systemStatus');
        if (status) {
            status.innerHTML = `<div class="success">${message}</div>`;
        }
    }
}

// Инициализируем рабочую версию
document.addEventListener('DOMContentLoaded', () => {
    new WorkingVersion();
});
