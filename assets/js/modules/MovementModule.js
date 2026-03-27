/**
 * Модуль движения для игры "Энергия денег"
 * Управляет перемещением игроков по доске
 */

export class MovementModule {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.board = null;
        this.playerPositions = new Map();
        this.isMoving = false;
        this.movementHistory = [];
        this.maxHistorySize = 100;
        this.isDestroyed = false;
    }

    /**
     * Инициализация модуля движения
     */
    async init() {
        console.log('🚶 MovementModule инициализирован');
        
        // Инициализация доски
        this.initBoard();
        
        // Подписка на события
        this.gameCore.eventBus.on('diceRolled', this.onDiceRolled.bind(this));
        this.gameCore.eventBus.on('playerAdded', this.onPlayerAdded.bind(this));
        this.gameCore.eventBus.on('playerTurnStarted', this.onPlayerTurnStarted.bind(this));
    }

    /**
     * Инициализация игровой доски
     */
    initBoard() {
        const config = this.gameCore.config.board;
        
        this.board = {
            innerTrack: {
                totalCells: config.innerTrackCells,
                cells: this.createInnerTrackCells(),
                startPosition: 0,
                paydayPosition: config.paydayPosition,
                charityPosition: config.charityPosition
            },
            outerTrack: {
                totalCells: config.outerTrackCells,
                cells: this.createOuterTrackCells(),
                startPosition: 0
            }
        };
        
        console.log('🚶 Игровая доска инициализирована');
    }

    /**
     * Создание клеток внутреннего трека
     */
    createInnerTrackCells() {
        const cells = [];
        const config = this.gameCore.config.board;
        
        for (let i = 0; i < config.innerTrackCells; i++) {
            cells.push({
                id: `inner_${i}`,
                position: i,
                type: this.getCellType(i, 'inner'),
                name: this.getCellName(i, 'inner'),
                description: this.getCellDescription(i, 'inner'),
                actions: this.getCellActions(i, 'inner')
            });
        }
        
        return cells;
    }

    /**
     * Создание клеток внешнего трека
     */
    createOuterTrackCells() {
        const cells = [];
        const config = this.gameCore.config.board;
        
        for (let i = 0; i < config.outerTrackCells; i++) {
            cells.push({
                id: `outer_${i}`,
                position: i,
                type: this.getCellType(i, 'outer'),
                name: this.getCellName(i, 'outer'),
                description: this.getCellDescription(i, 'outer'),
                actions: this.getCellActions(i, 'outer')
            });
        }
        
        return cells;
    }

    /**
     * Получение типа клетки
     * @param {number} position - Позиция
     * @param {string} track - Трек (inner/outer)
     */
    getCellType(position, track) {
        const config = this.gameCore.config.board;
        
        if (position === config.paydayPosition) {
            return 'payday';
        }
        
        if (position === config.charityPosition) {
            return 'charity';
        }
        
        // Случайные типы клеток
        const types = ['opportunity', 'expense', 'neutral'];
        return types[position % types.length];
    }

    /**
     * Получение имени клетки
     * @param {number} position - Позиция
     * @param {string} track - Трек (inner/outer)
     */
    getCellName(position, track) {
        const config = this.gameCore.config.board;
        
        if (position === config.paydayPosition) {
            return 'PAYDAY';
        }
        
        if (position === config.charityPosition) {
            return 'Благотворительность';
        }
        
        const names = {
            inner: ['Начало', 'Работа', 'Инвестиции', 'Бизнес', 'Недвижимость', 'Акции'],
            outer: ['Быстрая дорога', 'Пассивный доход', 'Финансовая свобода']
        };
        
        const trackNames = names[track] || ['Клетка'];
        return trackNames[position % trackNames.length];
    }

    /**
     * Движение игрока по доске
     * @param {number} startPosition - Начальная позиция
     * @param {number} steps - Количество шагов
     * @param {number} totalCells - Общее количество клеток
     * @param {string} track - Трек (inner/outer)
     */
    move(startPosition, steps, totalCells = 44, track = 'inner') {
        if (this.isDestroyed) {
            console.warn('MovementModule уничтожен, движение невозможно');
            return startPosition;
        }

        try {
            // Вычисляем новую позицию
            let newPosition = (startPosition + steps) % totalCells;
            
            // Если прошли полный круг, добавляем бонус
            if (startPosition + steps >= totalCells) {
                this.gameCore?.eventBus?.emit('playerCompletedLap', {
                    playerId: 'current',
                    startPosition,
                    newPosition,
                    steps,
                    track,
                    timestamp: Date.now()
                });
            }

            // Эмиссия события движения
            this.gameCore?.eventBus?.emit('playerMoved', {
                playerId: 'current',
                startPosition,
                newPosition,
                steps,
                track,
                timestamp: Date.now()
            });

            // Добавляем в историю
            this.addToHistory({
                startPosition,
                newPosition,
                steps,
                track,
                timestamp: Date.now()
            });

            console.log(`🚶 Игрок переместился с ${startPosition} на ${newPosition} (${steps} шагов)`);
            return newPosition;

        } catch (error) {
            console.error('Ошибка движения:', error);
            return startPosition;
        }
    }

    /**
     * Получение описания клетки
     * @param {number} position - Позиция
     * @param {string} track - Трек (inner/outer)
     */
    getCellDescription(position, track) {
        const config = this.gameCore.config.board;
        
        if (position === config.paydayPosition) {
            return 'Получите зарплату и оплатите расходы';
        }
        
        if (position === config.charityPosition) {
            return 'Помогите нуждающимся';
        }
        
        return 'Обычная клетка';
    }

    /**
     * Получение действий клетки
     * @param {number} position - Позиция
     * @param {string} track - Трек (inner/outer)
     */
    getCellActions(position, track) {
        const config = this.gameCore.config.board;
        
        if (position === config.paydayPosition) {
            return ['payday'];
        }
        
        if (position === config.charityPosition) {
            return ['charity'];
        }
        
        const type = this.getCellType(position, track);
        switch (type) {
            case 'opportunity':
                return ['drawCard', 'skip'];
            case 'expense':
                return ['drawCard', 'pay'];
            default:
                return ['skip'];
        }
    }

    /**
     * Движение игрока
     * @param {string} playerId - ID игрока
     * @param {number} steps - Количество шагов
     * @param {Object} options - Опции
     */
    async movePlayer(playerId, steps, options = {}) {
        if (this.isMoving) {
            console.warn('Движение уже выполняется');
            return null;
        }

        if (this.isDestroyed) {
            console.warn('MovementModule уничтожен, движение невозможно');
            return null;
        }

        try {
            this.isMoving = true;
            
            const playerManager = this.gameCore.getModule('playerManager');
            const player = playerManager.getPlayer(playerId);
            
            if (!player) {
                console.error(`Игрок с ID ${playerId} не найден`);
                return null;
            }

            const currentPosition = this.getPlayerPosition(playerId);
            const newPosition = this.calculateNewPosition(currentPosition, steps, player.track);
            
            // Эмиссия события начала движения
            this.gameCore.eventBus.emit('playerMovementStart', {
                playerId,
                from: currentPosition,
                to: newPosition,
                steps,
                timestamp: Date.now()
            });

            // Анимация движения
            if (options.animate !== false) {
                await this.animateMovement(playerId, currentPosition, newPosition);
            }

            // Обновление позиции
            this.updatePlayerPosition(playerId, newPosition);
            
            // Получение клетки
            const cell = this.getCell(newPosition, player.track);
            
            // Сохранение в историю
            this.saveToHistory(playerId, currentPosition, newPosition, steps);
            
            // Эмиссия события завершения движения
            this.gameCore.eventBus.emit('playerMoved', {
                playerId,
                from: currentPosition,
                to: newPosition,
                cell,
                steps,
                timestamp: Date.now()
            });

            console.log(`🚶 Игрок ${player.name} переместился с ${currentPosition} на ${newPosition}`);
            
            return { position: newPosition, cell };

        } catch (error) {
            console.error('Ошибка движения игрока:', error);
            this.gameCore.eventBus.emit('playerMovementError', { playerId, error });
            return null;
        } finally {
            this.isMoving = false;
        }
    }

    /**
     * Расчет новой позиции
     * @param {Object} currentPosition - Текущая позиция
     * @param {number} steps - Количество шагов
     * @param {string} track - Трек
     */
    calculateNewPosition(currentPosition, steps, track) {
        const trackConfig = this.board[track === 'inner' ? 'innerTrack' : 'outerTrack'];
        const totalCells = trackConfig.totalCells;
        
        let newPosition = currentPosition.position + steps;
        
        // Обработка перехода через начало
        if (newPosition >= totalCells) {
            newPosition = newPosition % totalCells;
            
            // Переход на внешний трек при достижении PAYDAY
            if (track === 'inner' && currentPosition.position === this.board.innerTrack.paydayPosition) {
                return {
                    position: 0,
                    track: 'outer'
                };
            }
        }
        
        return {
            position: newPosition,
            track: track
        };
    }

    /**
     * Получение позиции игрока
     * @param {string} playerId - ID игрока
     */
    getPlayerPosition(playerId) {
        return this.playerPositions.get(playerId) || {
            position: 0,
            track: 'inner'
        };
    }

    /**
     * Обновление позиции игрока
     * @param {string} playerId - ID игрока
     * @param {Object} newPosition - Новая позиция
     */
    updatePlayerPosition(playerId, newPosition) {
        this.playerPositions.set(playerId, newPosition);
        
        // Обновление в PlayerManager
        const playerManager = this.gameCore.getModule('playerManager');
        if (playerManager) {
            playerManager.updatePosition(playerId, newPosition.position, newPosition.track);
        }
    }

    /**
     * Получение клетки
     * @param {Object} position - Позиция
     * @param {string} track - Трек
     */
    getCell(position, track) {
        const trackConfig = this.board[track === 'inner' ? 'innerTrack' : 'outerTrack'];
        return trackConfig.cells[position.position] || null;
    }

    /**
     * Анимация движения
     * @param {string} playerId - ID игрока
     * @param {Object} from - Откуда
     * @param {Object} to - Куда
     */
    async animateMovement(playerId, from, to) {
        const animationDuration = this.gameCore.config.ui.animationDuration;
        
        // Получение DOM элемента игрока
        const playerElement = document.querySelector(`[data-player-id="${playerId}"]`);
        
        if (!playerElement) {
            // Если нет DOM элемента, просто ждем
            await this.delay(animationDuration);
            return;
        }

        // Расчет координат
        const fromCoords = this.getCellCoordinates(from);
        const toCoords = this.getCellCoordinates(to);
        
        // Анимация движения
        playerElement.style.transition = `transform ${animationDuration}ms ease-in-out`;
        playerElement.style.transform = `translate(${toCoords.x}px, ${toCoords.y}px)`;
        
        // Ожидание завершения анимации
        await this.delay(animationDuration);
        
        // Сброс анимации
        playerElement.style.transition = '';
    }

    /**
     * Получение координат клетки
     * @param {Object} position - Позиция
     */
    getCellCoordinates(position) {
        // Простая реализация координат
        // В реальной игре здесь будет более сложная логика
        const angle = (position.position / this.board.innerTrack.totalCells) * 2 * Math.PI;
        const radius = 200; // Радиус доски
        
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        };
    }

    /**
     * Проверка возможности движения на внешний трек
     * @param {string} playerId - ID игрока
     */
    canMoveToOuterTrack(playerId) {
        const position = this.getPlayerPosition(playerId);
        const paydayPosition = this.board.innerTrack.paydayPosition;
        
        return position.track === 'inner' && position.position === paydayPosition;
    }

    /**
     * Переход на внешний трек
     * @param {string} playerId - ID игрока
     */
    moveToOuterTrack(playerId) {
        if (!this.canMoveToOuterTrack(playerId)) {
            console.warn(`Игрок ${playerId} не может перейти на внешний трек`);
            return false;
        }
        
        const newPosition = {
            position: 0,
            track: 'outer'
        };
        
        this.updatePlayerPosition(playerId, newPosition);
        
        // Эмиссия события
        this.gameCore.eventBus.emit('playerMovedToOuterTrack', {
            playerId,
            position: newPosition
        });
        
        return true;
    }

    /**
     * Получение информации о доске
     */
    getBoardInfo() {
        return {
            innerTrack: {
                totalCells: this.board.innerTrack.totalCells,
                paydayPosition: this.board.innerTrack.paydayPosition,
                charityPosition: this.board.innerTrack.charityPosition
            },
            outerTrack: {
                totalCells: this.board.outerTrack.totalCells
            },
            playerPositions: Object.fromEntries(this.playerPositions)
        };
    }

    /**
     * Получение истории движений
     * @param {number} limit - Лимит записей
     */
    getHistory(limit = 10) {
        return this.movementHistory.slice(-limit);
    }

    /**
     * Сохранение в историю
     * @param {string} playerId - ID игрока
     * @param {Object} from - Откуда
     * @param {Object} to - Куда
     * @param {number} steps - Количество шагов
     */
    saveToHistory(playerId, from, to, steps) {
        this.movementHistory.push({
            playerId,
            from,
            to,
            steps,
            timestamp: Date.now()
        });

        // Ограничение размера истории
        if (this.movementHistory.length > this.maxHistorySize) {
            this.movementHistory.shift();
        }
    }

    /**
     * Получение статистики
     */
    getStats() {
        const totalMovements = this.movementHistory.length;
        const playersOnInnerTrack = Array.from(this.playerPositions.values())
            .filter(pos => pos.track === 'inner').length;
        const playersOnOuterTrack = Array.from(this.playerPositions.values())
            .filter(pos => pos.track === 'outer').length;
        
        return {
            totalMovements,
            playersOnInnerTrack,
            playersOnOuterTrack,
            isMoving: this.isMoving,
            boardInfo: this.getBoardInfo()
        };
    }

    /**
     * Утилита для задержки
     * @param {number} ms - Миллисекунды
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Обработчики событий
     */
    onDiceRolled(data) {
        // Автоматическое движение при броске кубиков
        if (data.result && data.result.total > 0) {
            const currentPlayer = this.gameCore.getModule('playerManager').getCurrentPlayer();
            if (currentPlayer) {
                this.movePlayer(currentPlayer.id, data.result.total);
            }
        }
    }

    onPlayerAdded(player) {
        // Инициализация позиции нового игрока
        this.playerPositions.set(player.id, {
            position: 0,
            track: 'inner'
        });
    }

    onPlayerTurnStarted(player) {
        // Сброс состояния движения при начале хода
        this.isMoving = false;
    }

    /**
     * Уничтожение модуля движения
     */
    destroy() {
        this.board = null;
        this.playerPositions.clear();
        this.movementHistory = [];
        this.isMoving = false;
        this.isDestroyed = true;
        console.log('🗑️ MovementModule уничтожен');
    }
}

export default MovementModule;
