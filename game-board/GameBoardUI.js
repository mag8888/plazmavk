/**
 * Game Board UI v2.0 - Современный интерфейс для игрового поля
 * 
 * Основные возможности:
 * - Адаптивный дизайн игрового поля
 * - Анимированные фишки игроков
 * - Интерактивные элементы управления
 * - Система уведомлений и эффектов
 * - Интеграция с GameBoardService
 */

class GameBoardUI {
    constructor(containerId = 'game-board-container') {
        console.log('🎨 GameBoardUI v2.0: Инициализация');
        
        this.containerId = containerId;
        this.container = null;
        this.gameBoard = null;
        this.playerTokens = new Map();
        this.animations = new Map();
        this.notifications = [];
        
        // Конфигурация UI
        this.config = {
            cellSize: 60,
            boardPadding: 20,
            tokenSize: 40,
            animationDuration: 300,
            notificationDuration: 3000
        };
        
        // Состояние UI
        this.uiState = {
            isInitialized: false,
            currentTheme: 'default',
            showAnimations: true,
            showNotifications: true
        };
        
        this.initializeUI();
    }

    /**
     * Инициализация UI
     */
    initializeUI() {
        console.log('🎨 GameBoardUI: Инициализация интерфейса');
        
        // Находим контейнер
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error('🎨 GameBoardUI: Контейнер не найден', this.containerId);
            return;
        }
        
        // Создаем игровое поле
        this.createGameBoard();
        
        // Добавляем стили
        this.addStyles();
        
        // Инициализируем систему уведомлений
        this.initializeNotifications();
        
        this.uiState.isInitialized = true;
        console.log('🎨 GameBoardUI: UI инициализирован');
    }

    /**
     * Создать игровое поле
     */
    createGameBoard() {
        // Создаем основной контейнер поля
        this.gameBoard = document.createElement('div');
        this.gameBoard.className = 'game-board-v2';
        this.gameBoard.innerHTML = `
            <div class="board-header">
                <h2>Монополия</h2>
                <div class="game-controls">
                    <button id="pause-btn" class="control-btn">⏸️ Пауза</button>
                    <button id="settings-btn" class="control-btn">⚙️ Настройки</button>
                </div>
            </div>
            <div class="board-container">
                <div class="board-grid" id="board-grid">
                    <!-- Клетки будут созданы динамически -->
                </div>
                <div class="board-sidebar">
                    <div class="players-panel" id="players-panel">
                        <h3>Игроки</h3>
                        <div class="players-list" id="players-list"></div>
                    </div>
                    <div class="game-info" id="game-info">
                        <h3>Информация о игре</h3>
                        <div class="info-content"></div>
                    </div>
                </div>
            </div>
            <div class="notifications-container" id="notifications-container"></div>
        `;
        
        this.container.appendChild(this.gameBoard);
        
        // Создаем клетки поля
        this.createBoardCells();
        
        // Добавляем обработчики событий
        this.addEventListeners();
    }

    /**
     * Создать клетки игрового поля
     */
    createBoardCells() {
        const boardGrid = document.getElementById('board-grid');
        if (!boardGrid) return;
        
        // Создаем 40 клеток (как в классической Монополии)
        for (let i = 0; i < 40; i++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.dataset.cellIndex = i;
            cell.innerHTML = `
                <div class="cell-content">
                    <div class="cell-number">${i + 1}</div>
                    <div class="cell-name">${this.getCellName(i)}</div>
                    <div class="cell-tokens" id="tokens-${i}"></div>
                </div>
            `;
            
            // Специальные стили для угловых клеток
            if (i === 0) cell.classList.add('start-cell');
            if (i === 10) cell.classList.add('jail-cell');
            if (i === 20) cell.classList.add('parking-cell');
            if (i === 30) cell.classList.add('go-to-jail-cell');
            
            boardGrid.appendChild(cell);
        }
    }

    /**
     * Получить название клетки
     */
    getCellName(index) {
        const cellNames = [
            'СТАРТ', 'Балтийская', 'Общественная казна', 'Средняя', 'Подоходный налог',
            'Северная железная дорога', 'Ориентал', 'Шанс', 'Вермонт', 'Коннектикут',
            'ТЮРЬМА', 'Сент-Чарльз', 'Электрическая компания', 'Штаты', 'Вирджиния',
            'Пенсильванская железная дорога', 'Сент-Джеймс', 'Общественная казна', 'Теннесси', 'Нью-Йорк',
            'БЕСПЛАТНАЯ ПАРКОВКА', 'Кентукки', 'Шанс', 'Индиана', 'Иллинойс',
            'B&O железная дорога', 'Атлантик', 'Вентнор', 'Водная компания', 'Марвин Гарденс',
            'ИДТИ В ТЮРЬМУ', 'Тихоокеанская', 'Северная Каролина', 'Общественная казна', 'Пенсильвания',
            'Короткая линия', 'Шанс', 'Парк Плейс', 'Налог на роскошь', 'Бордволк'
        ];
        return cellNames[index] || `Клетка ${index + 1}`;
    }

    /**
     * Создать фишку игрока
     */
    createPlayerToken(playerIndex, playerName, color, position = 0) {
        const tokenId = `player-token-${playerIndex}`;
        
        // Удаляем старую фишку если есть
        const existingToken = document.getElementById(tokenId);
        if (existingToken) {
            existingToken.remove();
        }

        // Создаем новую фишку
        const token = document.createElement('div');
        token.id = tokenId;
        token.className = 'player-token-v2';
        token.dataset.playerIndex = playerIndex;
        token.style.cssText = `
            position: absolute;
            width: ${this.config.tokenSize}px;
            height: ${this.config.tokenSize}px;
            background: ${color};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 16px;
            z-index: 100;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
            cursor: pointer;
            user-select: none;
        `;
        
        // Добавляем номер игрока
        const number = document.createElement('div');
        number.textContent = playerIndex + 1;
        number.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
        `;
        token.appendChild(number);

        // Добавляем эффекты при наведении
        token.addEventListener('mouseenter', () => {
            if (this.uiState.showAnimations) {
                token.style.transform = 'scale(1.2)';
                token.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
            }
        });

        token.addEventListener('mouseleave', () => {
            token.style.transform = 'scale(1)';
            token.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        });

        // Добавляем информацию о игроке при клике
        token.addEventListener('click', () => {
            this.showPlayerInfo(playerIndex, playerName, color);
        });

        // Позиционируем фишку
        this.positionToken(token, position, playerIndex);
        
        // Добавляем на игровое поле
        const boardGrid = document.getElementById('board-grid');
        if (boardGrid) {
            boardGrid.appendChild(token);
        }

        this.playerTokens.set(playerIndex, token);
        console.log('🎨 GameBoardUI: Создана фишка для игрока', { playerIndex, playerName, color });
        
        return token;
    }

    /**
     * Позиционировать фишку на поле
     */
    positionToken(token, position, playerIndex = null) {
        const cell = document.querySelector(`[data-cell-index="${position}"]`);
        if (!cell) {
            console.warn('🎨 GameBoardUI: Клетка не найдена', position);
            return;
        }

        const cellRect = cell.getBoundingClientRect();
        const boardRect = this.gameBoard.getBoundingClientRect();
        
        // Смещение для нескольких фишек на одной клетке
        const offset = this.config.cellSize * 0.15;
        let offsetX = 0;
        let offsetY = 0;

        // Определяем позицию фишки среди других фишек на этой клетке
        const pIndex = playerIndex !== null ? playerIndex : parseInt(token.dataset.playerIndex);
        if (pIndex !== null && !Number.isNaN(pIndex)) {
            const tokensOnCell = Array.from(this.playerTokens.values())
                .filter(t => t !== token && this.getTokenPosition(t) === position);
            const localIndex = tokensOnCell.length;
            
            const angle = (localIndex % 8) * (Math.PI / 4); // шаг 45°
            offsetX = Math.cos(angle) * offset;
            offsetY = Math.sin(angle) * offset;
        }

        const x = cellRect.left - boardRect.left + cellRect.width / 2 + offsetX;
        const y = cellRect.top - boardRect.top + cellRect.height / 2 + offsetY;

        token.style.left = `${x - this.config.tokenSize / 2}px`;
        token.style.top = `${y - this.config.tokenSize / 2}px`;
    }

    /**
     * Получить позицию фишки
     */
    getTokenPosition(token) {
        const cell = token.closest('[data-cell-index]');
        return cell ? parseInt(cell.dataset.cellIndex) : 0;
    }

    /**
     * Анимированное перемещение фишки
     */
    async moveToken(playerIndex, fromPosition, toPosition, steps) {
        const token = this.playerTokens.get(playerIndex);
        if (!token) {
            console.error('🎨 GameBoardUI: Фишка не найдена', playerIndex);
            return;
        }

        console.log('🎨 GameBoardUI: Перемещение фишки', { playerIndex, fromPosition, toPosition, steps });

        if (!this.uiState.showAnimations) {
            this.positionToken(token, toPosition, playerIndex);
            return;
        }

        // Анимация перемещения по шагам
        for (let i = 1; i <= steps; i++) {
            const currentPosition = (fromPosition + i) % 40;
            await this.animateStep(token, currentPosition, i === steps);
            
            // Задержка между шагами
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    /**
     * Анимация одного шага
     */
    async animateStep(token, position, isLastStep = false) {
        return new Promise((resolve) => {
            this.positionToken(token, position);
            
            // Эффект прыжка на последнем шаге
            if (isLastStep) {
                token.style.transform = 'scale(1.3)';
                setTimeout(() => {
                    token.style.transform = 'scale(1)';
                }, 150);
            }

            setTimeout(resolve, this.config.animationDuration);
        });
    }

    /**
     * Показать информацию о игроке
     */
    showPlayerInfo(playerIndex, playerName, color) {
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'player-info-modal-v2';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
        `;

        content.innerHTML = `
            <div class="player-header" style="color: ${color}; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 24px;">${playerName}</h3>
                <p style="margin: 5px 0; opacity: 0.7;">Игрок #${playerIndex + 1}</p>
            </div>
            <div class="player-stats">
                <div class="stat-item">
                    <span class="stat-label">Позиция:</span>
                    <span class="stat-value" id="playerPosition">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Баланс:</span>
                    <span class="stat-value" id="playerBalance">$0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Недвижимость:</span>
                    <span class="stat-value" id="playerProperties">0</span>
                </div>
            </div>
            <button onclick="this.closest('.player-info-modal-v2').remove()" 
                    style="margin-top: 20px; padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
                Закрыть
            </button>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Обновить информацию о игроках
     */
    updatePlayersPanel(players) {
        const playersList = document.getElementById('players-list');
        if (!playersList) return;

        playersList.innerHTML = players.map((player, index) => `
            <div class="player-item" style="border-left: 4px solid ${player.color};">
                <div class="player-name">${player.name}</div>
                <div class="player-money">$${player.money}</div>
                <div class="player-position">Позиция: ${player.position + 1}</div>
            </div>
        `).join('');
    }

    /**
     * Обновить информацию о игре
     */
    updateGameInfo(stats) {
        const infoContent = document.querySelector('.info-content');
        if (!infoContent) return;

        infoContent.innerHTML = `
            <div class="info-item">
                <span class="info-label">Текущий игрок:</span>
                <span class="info-value">${stats.currentPlayerName}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Ход:</span>
                <span class="info-value">${stats.turnNumber}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Кубик:</span>
                <span class="info-value">${stats.diceValue}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Время игры:</span>
                <span class="info-value">${Math.floor(stats.gameDuration / 60)}:${(stats.gameDuration % 60).toString().padStart(2, '0')}</span>
            </div>
        `;
    }

    /**
     * Показать уведомление
     */
    showNotification(message, type = 'info', duration = null) {
        if (!this.uiState.showNotifications) return;

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        const container = document.getElementById('notifications-container');
        if (container) {
            container.appendChild(notification);
            
            // Автоматическое удаление
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, duration || this.config.notificationDuration);
        }
    }

    /**
     * Инициализировать систему уведомлений
     */
    initializeNotifications() {
        const container = document.getElementById('notifications-container');
        if (container) {
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 2000;
                pointer-events: none;
            `;
        }
    }

    /**
     * Добавить стили
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .game-board-v2 {
                width: 100%;
                max-width: 1200px;
                margin: 0 auto;
                background: #f8f9fa;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            
            .board-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .board-header h2 {
                margin: 0;
                font-size: 28px;
                font-weight: bold;
            }
            
            .game-controls {
                display: flex;
                gap: 10px;
            }
            
            .control-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 10px 15px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.3s ease;
            }
            
            .control-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .board-container {
                display: flex;
                min-height: 600px;
            }
            
            .board-grid {
                flex: 1;
                display: grid;
                grid-template-columns: repeat(11, 1fr);
                grid-template-rows: repeat(11, 1fr);
                gap: 2px;
                padding: 20px;
                background: #e9ecef;
            }
            
            .board-cell {
                background: white;
                border: 2px solid #dee2e6;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                min-height: 60px;
                transition: all 0.3s ease;
            }
            
            .board-cell:hover {
                border-color: #007bff;
                box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2);
            }
            
            .start-cell {
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                font-weight: bold;
            }
            
            .jail-cell {
                background: linear-gradient(135deg, #dc3545, #fd7e14);
                color: white;
                font-weight: bold;
            }
            
            .parking-cell {
                background: linear-gradient(135deg, #6f42c1, #e83e8c);
                color: white;
                font-weight: bold;
            }
            
            .go-to-jail-cell {
                background: linear-gradient(135deg, #fd7e14, #dc3545);
                color: white;
                font-weight: bold;
            }
            
            .cell-content {
                text-align: center;
                width: 100%;
            }
            
            .cell-number {
                font-size: 12px;
                font-weight: bold;
                opacity: 0.7;
            }
            
            .cell-name {
                font-size: 10px;
                margin: 2px 0;
                line-height: 1.2;
            }
            
            .cell-tokens {
                position: absolute;
                top: 2px;
                right: 2px;
                display: flex;
                flex-wrap: wrap;
                gap: 2px;
            }
            
            .player-token-v2 {
                transition: all 0.3s ease;
            }
            
            .player-token-v2:hover {
                transform: scale(1.2);
                z-index: 101;
            }
            
            .board-sidebar {
                width: 300px;
                background: white;
                border-left: 1px solid #dee2e6;
                padding: 20px;
                overflow-y: auto;
            }
            
            .players-panel h3,
            .game-info h3 {
                margin: 0 0 15px 0;
                color: #495057;
                font-size: 18px;
            }
            
            .player-item {
                background: #f8f9fa;
                padding: 15px;
                margin-bottom: 10px;
                border-radius: 8px;
                transition: all 0.3s ease;
            }
            
            .player-item:hover {
                background: #e9ecef;
                transform: translateX(5px);
            }
            
            .player-name {
                font-weight: bold;
                font-size: 16px;
                margin-bottom: 5px;
            }
            
            .player-money {
                color: #28a745;
                font-weight: bold;
                font-size: 18px;
            }
            
            .player-position {
                color: #6c757d;
                font-size: 14px;
            }
            
            .info-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                padding: 8px 0;
                border-bottom: 1px solid #e9ecef;
            }
            
            .info-label {
                color: #6c757d;
                font-weight: 500;
            }
            
            .info-value {
                color: #495057;
                font-weight: bold;
            }
            
            .notification {
                background: white;
                padding: 15px 20px;
                margin-bottom: 10px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                animation: slideInRight 0.3s ease;
                pointer-events: auto;
            }
            
            .notification-info {
                border-left: 4px solid #007bff;
            }
            
            .notification-success {
                border-left: 4px solid #28a745;
            }
            
            .notification-warning {
                border-left: 4px solid #ffc107;
            }
            
            .notification-error {
                border-left: 4px solid #dc3545;
            }
            
            .player-info-modal-v2 {
                animation: fadeIn 0.3s ease;
            }
            
            .player-stats {
                margin: 20px 0;
            }
            
            .stat-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                padding: 8px 0;
                border-bottom: 1px solid #e9ecef;
            }
            
            .stat-label {
                color: #6c757d;
                font-weight: 500;
            }
            
            .stat-value {
                color: #495057;
                font-weight: bold;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideIn {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @media (max-width: 768px) {
                .board-container {
                    flex-direction: column;
                }
                
                .board-sidebar {
                    width: 100%;
                }
                
                .board-grid {
                    grid-template-columns: repeat(8, 1fr);
                    grid-template-rows: repeat(5, 1fr);
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Добавить обработчики событий
     */
    addEventListeners() {
        // Кнопка паузы
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.showNotification('Пауза игры', 'info');
                // Здесь можно добавить логику паузы
            });
        }

        // Кнопка настроек
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showNotification('Настройки игры', 'info');
                // Здесь можно добавить модальное окно настроек
            });
        }
    }

    /**
     * Очистить все фишки
     */
    clearAllTokens() {
        this.playerTokens.forEach(token => token.remove());
        this.playerTokens.clear();
    }

    /**
     * Обновить позицию фишки
     */
    updateTokenPosition(playerIndex, position) {
        const token = this.playerTokens.get(playerIndex);
        if (token) {
            this.positionToken(token, position, playerIndex);
        }
    }

    /**
     * Получить все фишки
     */
    getAllTokens() {
        return Array.from(this.playerTokens.values());
    }
}

// Экспорт для Node.js и браузера
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameBoardUI;
} else {
    window.GameBoardUI = GameBoardUI;
}
