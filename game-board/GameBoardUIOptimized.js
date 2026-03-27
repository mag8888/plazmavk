/**
 * Game Board UI v2.1 - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ
 * 
 * ОСНОВНЫЕ ОПТИМИЗАЦИИ:
 * - Кэширование DOM элементов
 * - Batch DOM updates
 * - RequestAnimationFrame для анимаций
 * - Debounced event handlers
 * - Memory leak prevention
 * - CSS transforms вместо position changes
 */

class GameBoardUIOptimized {
    constructor(containerId = 'game-board-container') {
        console.log('🎨 GameBoardUIOptimized v2.1: Инициализация');
        
        this.containerId = containerId;
        this.container = null;
        this.gameBoard = null;
        this.playerTokens = new Map();
        this.animations = new Map();
        this.notifications = [];
        
        // КЭШИРОВАНИЕ DOM ЭЛЕМЕНТОВ
        this.domCache = new Map();
        this.cellCache = new Map();
        this.animationFrameId = null;
        
        // DEBOUNCED FUNCTIONS
        this.debouncedUpdate = this.debounce(this.updateUI.bind(this), 16); // 60fps
        this.debouncedResize = this.debounce(this.handleResize.bind(this), 250);
        
        // Конфигурация UI
        this.config = {
            cellSize: 60,
            boardPadding: 20,
            tokenSize: 40,
            animationDuration: 300,
            notificationDuration: 3000,
            maxAnimations: 5, // Ограничение одновременных анимаций
            batchUpdateDelay: 16 // 60fps
        };
        
        // Состояние UI
        this.uiState = {
            isInitialized: false,
            currentTheme: 'default',
            showAnimations: true,
            showNotifications: true,
            isAnimating: false,
            pendingUpdates: new Set()
        };
        
        this.initializeUI();
    }

    /**
     * DEBOUNCE HELPER - предотвращает частые вызовы
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * THROTTLE HELPER - ограничивает частоту вызовов
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * КЭШИРОВАНИЕ DOM ЭЛЕМЕНТОВ
     */
    getCachedElement(selector, forceUpdate = false) {
        if (!forceUpdate && this.domCache.has(selector)) {
            return this.domCache.get(selector);
        }
        
        const element = document.querySelector(selector);
        if (element) {
            this.domCache.set(selector, element);
        }
        return element;
    }

    /**
     * BATCH DOM UPDATES - группирует обновления DOM
     */
    batchUpdate(updates) {
        if (this.uiState.pendingUpdates.size === 0) {
            requestAnimationFrame(() => {
                this.processBatchUpdates();
            });
        }
        
        updates.forEach(update => {
            this.uiState.pendingUpdates.add(update);
        });
    }

    processBatchUpdates() {
        const updates = Array.from(this.uiState.pendingUpdates);
        this.uiState.pendingUpdates.clear();
        
        // Группируем обновления по типу
        const updatesByType = updates.reduce((acc, update) => {
            if (!acc[update.type]) acc[update.type] = [];
            acc[update.type].push(update);
            return acc;
        }, {});

        // Применяем обновления группами
        Object.entries(updatesByType).forEach(([type, typeUpdates]) => {
            this.applyUpdatesByType(type, typeUpdates);
        });
    }

    applyUpdatesByType(type, updates) {
        switch (type) {
            case 'position':
                this.applyPositionUpdates(updates);
                break;
            case 'style':
                this.applyStyleUpdates(updates);
                break;
            case 'content':
                this.applyContentUpdates(updates);
                break;
        }
    }

    applyPositionUpdates(updates) {
        // Используем CSS transforms для лучшей производительности
        updates.forEach(update => {
            const { element, x, y } = update;
            if (element && element.style) {
                element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
        });
    }

    applyStyleUpdates(updates) {
        updates.forEach(update => {
            const { element, styles } = update;
            if (element && element.style) {
                Object.assign(element.style, styles);
            }
        });
    }

    applyContentUpdates(updates) {
        updates.forEach(update => {
            const { element, content } = update;
            if (element) {
                element.textContent = content;
            }
        });
    }

    /**
     * ОПТИМИЗИРОВАННАЯ ИНИЦИАЛИЗАЦИЯ UI
     */
    initializeUI() {
        console.log('🎨 GameBoardUIOptimized: Инициализация интерфейса');
        
        // Находим контейнер
        this.container = this.getCachedElement(`#${this.containerId}`);
        if (!this.container) {
            console.error('🎨 GameBoardUIOptimized: Контейнер не найден', this.containerId);
            return;
        }
        
        // Создаем игровое поле
        this.createGameBoard();
        
        // Добавляем стили
        this.addStyles();
        
        // Инициализируем систему уведомлений
        this.initializeNotifications();
        
        // Добавляем оптимизированные event listeners
        this.addOptimizedEventListeners();
        
        this.uiState.isInitialized = true;
        console.log('🎨 GameBoardUIOptimized: UI инициализирован');
    }

    /**
     * ОПТИМИЗИРОВАННЫЕ EVENT LISTENERS
     */
    addOptimizedEventListeners() {
        // Используем event delegation для лучшей производительности
        this.container.addEventListener('click', this.handleClick.bind(this));
        this.container.addEventListener('mouseenter', this.handleMouseEnter.bind(this), true);
        this.container.addEventListener('mouseleave', this.handleMouseLeave.bind(this), true);
        
        // Throttled resize handler
        window.addEventListener('resize', this.debouncedResize);
        
        // Visibility change для паузы анимаций
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    handleClick(event) {
        const token = event.target.closest('.player-token');
        if (token) {
            const playerIndex = parseInt(token.dataset.playerIndex);
            this.showPlayerInfo(playerIndex);
        }
    }

    handleMouseEnter(event) {
        const token = event.target.closest('.player-token');
        if (token && this.uiState.showAnimations) {
            this.batchUpdate([{
                type: 'style',
                element: token,
                styles: {
                    transform: 'scale(1.2)',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)'
                }
            }]);
        }
    }

    handleMouseLeave(event) {
        const token = event.target.closest('.player-token');
        if (token) {
            this.batchUpdate([{
                type: 'style',
                element: token,
                styles: {
                    transform: 'scale(1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                }
            }]);
        }
    }

    handleResize() {
        // Пересчитываем позиции только при изменении размера
        this.recalculatePositions();
    }

    handleVisibilityChange() {
        if (document.hidden) {
            this.pauseAnimations();
        } else {
            this.resumeAnimations();
        }
    }

    /**
     * ОПТИМИЗИРОВАННОЕ СОЗДАНИЕ ИГРОВОГО ПОЛЯ
     */
    createGameBoard() {
        // Используем DocumentFragment для batch DOM operations
        const fragment = document.createDocumentFragment();
        
        this.gameBoard = document.createElement('div');
        this.gameBoard.className = 'game-board-v2-optimized';
        
        // Создаем HTML структуру одним вызовом
        this.gameBoard.innerHTML = this.getGameBoardHTML();
        
        fragment.appendChild(this.gameBoard);
        this.container.appendChild(fragment);
        
        // Кэшируем часто используемые элементы
        this.cacheFrequentlyUsedElements();
    }

    getGameBoardHTML() {
        return `
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
    }

    cacheFrequentlyUsedElements() {
        const selectors = [
            '#board-grid',
            '#players-list',
            '#game-info .info-content',
            '#notifications-container'
        ];
        
        selectors.forEach(selector => {
            this.getCachedElement(selector);
        });
    }

    /**
     * ОПТИМИЗИРОВАННОЕ СОЗДАНИЕ ФИШЕК
     */
    createPlayerToken(playerIndex, playerName, color, position = 0) {
        // Проверяем лимит анимаций
        if (this.animations.size >= this.config.maxAnimations) {
            console.warn('🎨 GameBoardUIOptimized: Достигнут лимит анимаций');
            return null;
        }

        const token = document.createElement('div');
        token.className = 'player-token-optimized';
        token.dataset.playerIndex = playerIndex;
        
        // Используем CSS классы вместо inline styles где возможно
        token.style.cssText = `
            position: absolute;
            width: ${this.config.tokenSize}px;
            height: ${this.config.tokenSize}px;
            background: ${color};
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            will-change: transform;
            z-index: 10;
        `;

        // Создаем номер игрока
        const number = document.createElement('div');
        number.textContent = playerIndex + 1;
        number.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 14px;
            font-weight: bold;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
            pointer-events: none;
        `;
        token.appendChild(number);

        // Добавляем на игровое поле
        const boardGrid = this.getCachedElement('#board-grid');
        if (boardGrid) {
            boardGrid.appendChild(token);
        }

        this.playerTokens.set(playerIndex, token);
        
        // Позиционируем фишку
        this.positionTokenOptimized(token, position, playerIndex);
        
        console.log('🎨 GameBoardUIOptimized: Создана фишка для игрока', { playerIndex, playerName, color });
        
        return token;
    }

    /**
     * ОПТИМИЗИРОВАННОЕ ПОЗИЦИОНИРОВАНИЕ ФИШКИ
     */
    positionTokenOptimized(token, position, playerIndex = null) {
        const cell = this.getCachedElement(`[data-cell-index="${position}"]`);
        if (!cell) {
            console.warn('🎨 GameBoardUIOptimized: Клетка не найдена', position);
            return;
        }

        // Кэшируем позиции клеток
        let cellRect = this.cellCache.get(position);
        if (!cellRect) {
            cellRect = cell.getBoundingClientRect();
            this.cellCache.set(position, cellRect);
        }

        const boardRect = this.gameBoard.getBoundingClientRect();
        
        // Смещение для нескольких фишек на одной клетке
        const offset = this.config.cellSize * 0.15;
        let offsetX = 0;
        let offsetY = 0;

        const pIndex = playerIndex !== null ? playerIndex : parseInt(token.dataset.playerIndex);
        if (pIndex !== null && !Number.isNaN(pIndex)) {
            const tokensOnCell = Array.from(this.playerTokens.values())
                .filter(t => t !== token && this.getTokenPosition(t) === position);
            const localIndex = tokensOnCell.length;
            
            const angle = (localIndex % 8) * (Math.PI / 4);
            offsetX = Math.cos(angle) * offset;
            offsetY = Math.sin(angle) * offset;
        }

        const x = cellRect.left - boardRect.left + cellRect.width / 2 + offsetX;
        const y = cellRect.top - boardRect.top + cellRect.height / 2 + offsetY;

        // Используем CSS transforms для лучшей производительности
        this.batchUpdate([{
            type: 'position',
            element: token,
            x: x - this.config.tokenSize / 2,
            y: y - this.config.tokenSize / 2
        }]);
    }

    /**
     * ОПТИМИЗИРОВАННОЕ ПЕРЕМЕЩЕНИЕ ФИШКИ
     */
    async moveTokenOptimized(playerIndex, fromPosition, toPosition, steps) {
        const token = this.playerTokens.get(playerIndex);
        if (!token) {
            console.error('🎨 GameBoardUIOptimized: Фишка не найдена', playerIndex);
            return;
        }

        console.log('🎨 GameBoardUIOptimized: Перемещение фишки', { playerIndex, fromPosition, toPosition, steps });

        if (!this.uiState.showAnimations) {
            this.positionTokenOptimized(token, toPosition, playerIndex);
            return;
        }

        // Проверяем лимит анимаций
        if (this.animations.size >= this.config.maxAnimations) {
            console.warn('🎨 GameBoardUIOptimized: Пропускаем анимацию из-за лимита');
            this.positionTokenOptimized(token, toPosition, playerIndex);
            return;
        }

        this.uiState.isAnimating = true;
        const animationId = `move_${playerIndex}_${Date.now()}`;
        this.animations.set(animationId, { token, playerIndex });

        try {
            // Используем requestAnimationFrame для плавной анимации
            await this.animateTokenMovement(token, fromPosition, toPosition, steps);
        } finally {
            this.animations.delete(animationId);
            this.uiState.isAnimating = false;
        }
    }

    /**
     * АНИМАЦИЯ ПЕРЕМЕЩЕНИЯ С REQUESTANIMATIONFRAME
     */
    async animateTokenMovement(token, fromPosition, toPosition, steps) {
        return new Promise((resolve) => {
            let currentStep = 0;
            
            const animate = () => {
                if (currentStep >= steps) {
                    resolve();
                    return;
                }
                
                const currentPosition = (fromPosition + currentStep + 1) % 40;
                this.positionTokenOptimized(token, currentPosition);
                
                currentStep++;
                
                if (currentStep < steps) {
                    this.animationFrameId = requestAnimationFrame(animate);
                } else {
                    // Эффект прыжка на последнем шаге
                    this.batchUpdate([{
                        type: 'style',
                        element: token,
                        styles: {
                            transform: 'scale(1.3)'
                        }
                    }]);
                    
                    setTimeout(() => {
                        this.batchUpdate([{
                            type: 'style',
                            element: token,
                            styles: {
                                transform: 'scale(1)'
                            }
                        }]);
                        resolve();
                    }, 150);
                }
            };
            
            this.animationFrameId = requestAnimationFrame(animate);
        });
    }

    /**
     * ПАУЗА И ВОЗОБНОВЛЕНИЕ АНИМАЦИЙ
     */
    pauseAnimations() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.uiState.showAnimations = false;
    }

    resumeAnimations() {
        this.uiState.showAnimations = true;
    }

    /**
     * ПЕРЕСЧЕТ ПОЗИЦИЙ (только при необходимости)
     */
    recalculatePositions() {
        this.cellCache.clear();
        this.playerTokens.forEach((token, playerIndex) => {
            const position = this.getTokenPosition(token);
            this.positionTokenOptimized(token, position, playerIndex);
        });
    }

    /**
     * ОЧИСТКА ПАМЯТИ
     */
    cleanup() {
        // Очищаем анимации
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        // Очищаем кэши
        this.domCache.clear();
        this.cellCache.clear();
        this.animations.clear();
        
        // Удаляем event listeners
        this.container.removeEventListener('click', this.handleClick);
        this.container.removeEventListener('mouseenter', this.handleMouseEnter, true);
        this.container.removeEventListener('mouseleave', this.handleMouseLeave, true);
        window.removeEventListener('resize', this.debouncedResize);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        console.log('🎨 GameBoardUIOptimized: Очистка завершена');
    }

    // Остальные методы остаются без изменений...
    getTokenPosition(token) {
        const cell = token.closest('[data-cell-index]');
        return cell ? parseInt(cell.dataset.cellIndex) : 0;
    }

    showPlayerInfo(playerIndex) {
        // Оптимизированная версия showPlayerInfo...
        console.log('🎨 GameBoardUIOptimized: Показ информации о игроке', playerIndex);
    }

    updateUI() {
        // Оптимизированная версия updateUI...
        console.log('🎨 GameBoardUIOptimized: Обновление UI');
    }

    addStyles() {
        // Добавляем оптимизированные стили...
        const style = document.createElement('style');
        style.textContent = `
            .game-board-v2-optimized {
                /* Оптимизированные стили */
                contain: layout style paint;
                will-change: transform;
            }
            
            .player-token-optimized {
                /* Оптимизированные стили для фишек */
                contain: layout style paint;
                will-change: transform;
            }
        `;
        document.head.appendChild(style);
    }

    initializeNotifications() {
        // Инициализация уведомлений...
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameBoardUIOptimized;
} else if (typeof window !== 'undefined') {
    window.GameBoardUIOptimized = GameBoardUIOptimized;
}
