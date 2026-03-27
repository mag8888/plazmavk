/**
 * Компонент игровой доски "Энергия денег"
 * Управляет отображением и взаимодействием с игровой доской
 */

export class Board {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.container = null;
        this.cells = new Map();
        this.playerTokens = new Map();
        this.isDestroyed = false;
    }

    /**
     * Инициализация компонента доски
     */
    async init() {
        console.log('🎯 Board компонент инициализирован');
        
        // Получение контейнера доски
        this.container = document.getElementById('gameBoard');
        if (!this.container) {
            console.error('Контейнер игровой доски не найден');
            return;
        }
        
        // Создание доски
        this.createBoard();
        
        // Подписка на события
        this.gameCore.eventBus.on('playerMoved', this.onPlayerMoved.bind(this));
        this.gameCore.eventBus.on('playerAdded', this.onPlayerAdded.bind(this));
        this.gameCore.eventBus.on('currentPlayerChanged', this.onCurrentPlayerChanged.bind(this));
    }

    /**
     * Создание игровой доски
     */
    createBoard() {
        // Очистка существующей доски
        this.container.innerHTML = '';
        
        // Создание структуры доски
        this.container.innerHTML = `
            <!-- Внутренний трек -->
            <div class="board-inner-track" id="innerTrack">
                <!-- Клетки будут добавлены динамически -->
            </div>
            
            <!-- Внешний трек -->
            <div class="board-outer-track" id="outerTrack">
                <!-- Клетки будут добавлены динамически -->
            </div>
            
            <!-- Центральная область -->
            <div class="board-center">
                <div class="game-title">Энергия денег</div>
                <div class="game-status">
                    <span id="gameStatus">Загрузка...</span>
                </div>
                
                <!-- Кубики -->
                <div class="dice-container">
                    <div class="dice" data-value="0">0</div>
                    <div class="dice" data-value="0">0</div>
                    <div class="dice-total">0</div>
                </div>
                
                <!-- Кнопки действий -->
                <div class="action-buttons">
                    <button id="rollDiceBtn" class="btn btn-primary" disabled>
                        <i class="fas fa-dice"></i> Бросить кубики
                    </button>
                    <button id="endTurnBtn" class="btn btn-secondary" disabled>
                        <i class="fas fa-arrow-right"></i> Завершить ход
                    </button>
                </div>
            </div>
        `;
        
        // Создание клеток
        this.createCells();
        
        // Привязка событий
        this.bindEvents();
    }

    /**
     * Создание клеток доски
     */
    createCells() {
        const movementModule = this.gameCore.getModule('movementModule');
        if (!movementModule) {
            console.error('Модуль движения не найден');
            return;
        }

        const boardInfo = movementModule.getBoardInfo();
        
        // Создание клеток внутреннего трека
        this.createTrackCells('innerTrack', boardInfo.innerTrack);
        
        // Создание клеток внешнего трека
        this.createTrackCells('outerTrack', boardInfo.outerTrack);
    }

    /**
     * Создание клеток трека
     * @param {string} trackId - ID трека
     * @param {Object} trackInfo - Информация о треке
     */
    createTrackCells(trackId, trackInfo) {
        const trackElement = document.getElementById(trackId);
        if (!trackElement) {
            return;
        }

        trackElement.innerHTML = '';

        for (let i = 0; i < trackInfo.totalCells; i++) {
            const cell = this.createCell(i, trackId);
            trackElement.appendChild(cell);
            
            // Сохранение ссылки на клетку
            this.cells.set(`${trackId}_${i}`, cell);
        }
    }

    /**
     * Создание клетки
     * @param {number} position - Позиция клетки
     * @param {string} trackId - ID трека
     */
    createCell(position, trackId) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.dataset.position = position;
        cell.dataset.track = trackId;
        
        // Определение типа клетки
        const cellType = this.getCellType(position, trackId);
        cell.classList.add(cellType);
        
        // Содержимое клетки
        cell.innerHTML = `
            <div class="cell-content">
                <div class="cell-number">${position}</div>
                <div class="cell-name">${this.getCellName(position, trackId)}</div>
                <div class="cell-icon">${this.getCellIcon(cellType)}</div>
            </div>
        `;
        
        // Привязка событий
        cell.addEventListener('click', () => {
            this.onCellClick(position, trackId);
        });
        
        return cell;
    }

    /**
     * Получение типа клетки
     * @param {number} position - Позиция
     * @param {string} trackId - ID трека
     */
    getCellType(position, trackId) {
        const config = this.gameCore.config.board;
        
        if (trackId === 'innerTrack') {
            if (position === config.paydayPosition) {
                return 'payday';
            }
            if (position === config.charityPosition) {
                return 'charity';
            }
            
            // Случайные типы для других клеток
            const types = ['opportunity', 'expense', 'neutral'];
            return types[position % types.length];
        } else {
            // Внешний трек
            return 'fast-track';
        }
    }

    /**
     * Получение имени клетки
     * @param {number} position - Позиция
     * @param {string} trackId - ID трека
     */
    getCellName(position, trackId) {
        const config = this.gameCore.config.board;
        
        if (trackId === 'innerTrack') {
            if (position === config.paydayPosition) {
                return 'PAYDAY';
            }
            if (position === config.charityPosition) {
                return 'Благотворительность';
            }
            
            const names = ['Начало', 'Работа', 'Инвестиции', 'Бизнес', 'Недвижимость', 'Акции'];
            return names[position % names.length];
        } else {
            const names = ['Быстрая дорога', 'Пассивный доход', 'Финансовая свобода'];
            return names[position % names.length];
        }
    }

    /**
     * Получение иконки клетки
     * @param {string} cellType - Тип клетки
     */
    getCellIcon(cellType) {
        const icons = {
            payday: '💰',
            charity: '❤️',
            opportunity: '📈',
            expense: '📉',
            neutral: '📍',
            'fast-track': '🚀'
        };
        
        return icons[cellType] || '📍';
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        // Кнопка броска кубиков
        const rollDiceBtn = document.getElementById('rollDiceBtn');
        if (rollDiceBtn) {
            rollDiceBtn.addEventListener('click', () => {
                this.rollDice();
            });
        }
        
        // Кнопка завершения хода
        const endTurnBtn = document.getElementById('endTurnBtn');
        if (endTurnBtn) {
            endTurnBtn.addEventListener('click', () => {
                this.endTurn();
            });
        }
    }

    /**
     * Бросок кубиков
     */
    async rollDice() {
        const diceModule = this.gameCore.getModule('diceModule');
        if (diceModule) {
            await diceModule.roll();
        }
    }

    /**
     * Завершение хода
     */
    endTurn() {
        const playerManager = this.gameCore.getModule('playerManager');
        const currentPlayer = playerManager.getCurrentPlayer();
        
        if (currentPlayer) {
            this.gameCore.eventBus.emit('playerTurnEnded', currentPlayer);
        }
    }

    /**
     * Обновление позиции игрока
     * @param {string} playerId - ID игрока
     * @param {Object} position - Позиция
     */
    updatePlayerPosition(playerId, position) {
        // Удаление старого токена
        this.removePlayerToken(playerId);
        
        // Добавление нового токена
        this.addPlayerToken(playerId, position);
        
        // Обновление подсветки клеток
        this.updateCellHighlight(position);
    }

    /**
     * Добавление токена игрока
     * @param {string} playerId - ID игрока
     * @param {Object} position - Позиция
     */
    addPlayerToken(playerId, position) {
        const playerManager = this.gameCore.getModule('playerManager');
        const player = playerManager.getPlayer(playerId);
        
        if (!player) {
            return;
        }
        
        const trackId = position.track === 'inner' ? 'innerTrack' : 'outerTrack';
        const cell = this.cells.get(`${trackId}_${position.position}`);
        
        if (!cell) {
            return;
        }
        
        // Создание токена
        const token = document.createElement('div');
        token.className = 'player-token';
        token.dataset.playerId = playerId;
        token.style.backgroundColor = player.color;
        token.textContent = player.name.charAt(0).toUpperCase();
        
        // Добавление токена на клетку
        cell.appendChild(token);
        
        // Сохранение ссылки
        this.playerTokens.set(playerId, token);
        
        // Подсветка активного игрока
        if (playerManager.getCurrentPlayer()?.id === playerId) {
            token.classList.add('current');
        }
    }

    /**
     * Удаление токена игрока
     * @param {string} playerId - ID игрока
     */
    removePlayerToken(playerId) {
        const token = this.playerTokens.get(playerId);
        if (token && token.parentNode) {
            token.parentNode.removeChild(token);
        }
        this.playerTokens.delete(playerId);
    }

    /**
     * Обновление подсветки клетки
     * @param {Object} position - Позиция
     */
    updateCellHighlight(position) {
        // Удаление старой подсветки
        this.container.querySelectorAll('.board-cell.active').forEach(cell => {
            cell.classList.remove('active');
        });
        
        // Добавление новой подсветки
        const trackId = position.track === 'inner' ? 'innerTrack' : 'outerTrack';
        const cell = this.cells.get(`${trackId}_${position.position}`);
        
        if (cell) {
            cell.classList.add('active');
        }
    }

    /**
     * Обновление отображения кубиков
     * @param {Array} diceValues - Значения кубиков
     */
    updateDiceDisplay(diceValues) {
        const diceElements = this.container.querySelectorAll('.dice');
        const totalElement = this.container.querySelector('.dice-total');
        
        if (diceElements.length >= 2) {
            diceElements[0].textContent = diceValues[0] || 0;
            diceElements[1].textContent = diceValues[1] || 0;
            diceElements[0].dataset.value = diceValues[0] || 0;
            diceElements[1].dataset.value = diceValues[1] || 0;
        }
        
        if (totalElement && diceValues.length >= 2) {
            const total = diceValues.reduce((sum, value) => sum + value, 0);
            totalElement.textContent = total;
        }
    }

    /**
     * Обновление статуса игры
     * @param {string} status - Статус
     */
    updateGameStatus(status) {
        const statusElement = document.getElementById('gameStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    /**
     * Обновление состояния кнопок
     * @param {Object} state - Состояние кнопок
     */
    updateButtonState(state) {
        const rollDiceBtn = document.getElementById('rollDiceBtn');
        const endTurnBtn = document.getElementById('endTurnBtn');
        
        if (rollDiceBtn) {
            rollDiceBtn.disabled = !state.canRollDice;
        }
        
        if (endTurnBtn) {
            endTurnBtn.disabled = !state.canEndTurn;
        }
    }

    /**
     * Обработка клика по клетке
     * @param {number} position - Позиция клетки
     * @param {string} trackId - ID трека
     */
    onCellClick(position, trackId) {
        console.log(`Клик по клетке ${position} трека ${trackId}`);
        
        // Эмиссия события клика по клетке
        this.gameCore.eventBus.emit('cellClicked', {
            position,
            trackId,
            timestamp: Date.now()
        });
    }

    /**
     * Обработчики событий
     */
    onPlayerMoved(data) {
        this.updatePlayerPosition(data.playerId, data.to);
    }

    onPlayerAdded(player) {
        // Инициализация позиции нового игрока
        this.updatePlayerPosition(player.id, { position: 0, track: 'inner' });
    }

    onCurrentPlayerChanged(data) {
        // Обновление подсветки активного игрока
        this.playerTokens.forEach((token, playerId) => {
            if (playerId === data.newPlayer.id) {
                token.classList.add('current');
            } else {
                token.classList.remove('current');
            }
        });
    }

    /**
     * Получение статистики
     */
    getStats() {
        return {
            totalCells: this.cells.size,
            playerTokens: this.playerTokens.size,
            isInitialized: !!this.container
        };
    }

    /**
     * Уничтожение компонента доски
     */
    destroy() {
        this.cells.clear();
        this.playerTokens.clear();
        this.container = null;
        this.isDestroyed = true;
        console.log('🗑️ Board компонент уничтожен');
    }
}

export default Board;
