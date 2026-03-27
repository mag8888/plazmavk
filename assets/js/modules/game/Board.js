/**
 * Board - модуль отображения игрового поля «Энергия денег»
 * Рендерит внешний и внутренний круги по конфигурации и показывает всплывающие карточки
 */

const OUTER_CELL_THEMES = {
    money: {
        className: 'cell-teal',
        accent: '#25d0ff',
        icon: '💰',
        label: 'Доход'
    },
    business: {
        className: 'cell-green',
        accent: '#32df8d',
        icon: '📈',
        label: 'Бизнес'
    },
    dream: {
        className: 'cell-pink',
        accent: '#ff4f93',
        icon: '🌟',
        label: 'Мечта'
    },
    loss: {
        className: 'cell-red',
        accent: '#ff6b6b',
        icon: '⚠️',
        label: 'Потеря'
    },
    charity: {
        className: 'cell-yellow',
        accent: '#ffd65a',
        icon: '❤️',
        label: 'Благотворительность'
    },
    default: {
        className: 'cell-slate',
        accent: '#475569',
        icon: '🎲',
        label: 'Клетка'
    }
};

const INNER_CELL_THEMES = {
    green_opportunity: {
        className: 'cell-green',
        accent: '#32df8d',
        icon: '📈',
        label: 'Зелёная возможность'
    },
    pink_expense: {
        className: 'cell-pink',
        accent: '#ff4f93',
        icon: '💳',
        label: 'Расходы'
    },
    orange_charity: {
        className: 'cell-orange',
        accent: '#ff8c42',
        icon: '❤️',
        label: 'Благотворительность'
    },
    yellow_payday: {
        className: 'cell-yellow',
        accent: '#ffd65a',
        icon: '💰',
        label: 'PAYDAY'
    },
    blue_market: {
        className: 'cell-blue',
        accent: '#4e95ff',
        icon: '🛒',
        label: 'Рынок'
    },
    purple_baby: {
        className: 'cell-purple',
        accent: '#a769ff',
        icon: '👶',
        label: 'Семья'
    },
    black_loss: {
        className: 'cell-black',
        accent: '#111827',
        icon: '⚠️',
        label: 'Потеря'
    },
    default: {
        className: 'cell-slate',
        accent: '#475569',
        icon: '🎲',
        label: 'Клетка'
    }
};

function parseCssNumber(variableName, fallback) {
    try {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(variableName);
        const value = parseFloat(raw);
        return Number.isFinite(value) ? value : fallback;
    } catch (error) {
        return fallback;
    }
}

function getBoardSizeFallback() {
    return parseCssNumber('--board-size', 700);
}

function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(71, 85, 105, ${alpha})`;
    const sanitized = hex.replace('#', '');
    if (sanitized.length !== 6) {
        return `rgba(71, 85, 105, ${alpha})`;
    }
    const bigint = parseInt(sanitized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatCurrency(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return null;
    }
    const formatter = new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    });
    return formatter.format(value);
}

function sanitizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value);
}

class Board {
    constructor(gameCore = null, containerId = null) {
        this.gameCore = gameCore;
        this.containerId = containerId;

        this.boardElement = null;
        this.outerTrackElement = null;
        this.innerTrackElement = null;
        this.playerTokensElement = null;

        this.outerCellsConfig = [];
        this.innerCellsConfig = [];

        this.cells = [];
        this.cellIndexMap = new Map(); // trackIndex -> record
        this.cellDataById = new Map(); // unique cell id -> record
        this.cellPositions = new Map(); // unique cell id -> { x, y, layer }

        this.outerCellEntries = [];
        this.innerCellEntries = [];

        this.players = new Map();
        this.playerPositions = new Map(); // playerId -> cellId
        this.cellOccupancy = new Map(); // cellId -> [playerId]

        this.modalElements = {
            root: null,
            card: null,
            icon: null,
            title: null,
            text: null,
            action: null
        };

        this.eventBus = gameCore?.eventBus || null;
        this.state = gameCore?.state || null;

        this.boundHandlers = {
            playerMoved: this.onPlayerMoved.bind(this),
            playerAdded: this.onPlayerAdded.bind(this),
            playerRemoved: this.onPlayerRemoved.bind(this),
            gameStateUpdated: this.onGameStateUpdated.bind(this)
        };

        this.handleResize = this.handleResize.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.hideCellModal = this.hideCellModal.bind(this);

        this.isInitialized = false;
    }

    async init() {
        this.cacheElements();
        this.loadConfig();
        this.addBoardStyles();
        this.initializeCells();
        this.renderBoard();
        this.setupEvents();
        this.isInitialized = true;
        console.log('✅ Board module initialized');
    }

    cacheElements() {
        const containerFromId = this.containerId ? document.getElementById(this.containerId) : null;
        if (containerFromId && containerFromId.classList.contains('board-frame')) {
            this.boardElement = containerFromId;
        } else if (containerFromId) {
            this.boardElement = containerFromId.closest('.board-frame');
        }
        if (!this.boardElement) {
            this.boardElement = document.querySelector('.board-frame');
        }

        this.outerTrackElement = this.boardElement?.querySelector('#outerTrack') || document.getElementById('outerTrack');
        this.innerTrackElement = this.boardElement?.querySelector('#innerTrack') || document.getElementById('innerTrack');
        this.playerTokensElement = this.boardElement?.querySelector('#playerTokens') || document.getElementById('playerTokens');

        this.modalElements.root = document.getElementById('cellModal');
        this.modalElements.card = document.getElementById('modalCard');
        this.modalElements.icon = document.getElementById('modalIcon');
        this.modalElements.title = document.getElementById('modalTitle');
        this.modalElements.text = document.getElementById('modalText');
        this.modalElements.action = document.getElementById('modalAction');
    }

    loadConfig() {
        console.log('🔍 Board: Loading configuration...');
        console.log('🔍 Board: window.BIG_CIRCLE_CELLS:', window.BIG_CIRCLE_CELLS);
        console.log('🔍 Board: window.SMALL_CIRCLE_CELLS:', window.SMALL_CIRCLE_CELLS);
        
        const outer = Array.isArray(window.BIG_CIRCLE_CELLS) ? window.BIG_CIRCLE_CELLS : [];
        const inner = Array.isArray(window.SMALL_CIRCLE_CELLS) ? window.SMALL_CIRCLE_CELLS : [];

        if (!outer.length) {
            console.warn('Board: BIG_CIRCLE_CELLS not found or empty');
        }
        if (!inner.length) {
            console.warn('Board: SMALL_CIRCLE_CELLS not found or empty');
        }

        this.outerCellsConfig = outer.map((cell) => ({ ...cell }));
        this.innerCellsConfig = inner.map((cell) => ({ ...cell }));
        
        console.log('🔍 Board: Loaded config - outer:', this.outerCellsConfig.length, 'inner:', this.innerCellsConfig.length);
    }

    initializeCells() {
        this.cells = [];
        this.cellIndexMap.clear();
        this.cellDataById.clear();
        this.cellPositions.clear();
        this.outerCellEntries = [];
        this.innerCellEntries = [];

        let trackIndex = 0;

        this.outerCellsRecords = this.outerCellsConfig.map((cellConfig, index) => {
            const theme = OUTER_CELL_THEMES[cellConfig.type] || OUTER_CELL_THEMES.default;
            const record = {
                id: cellConfig.id,
                trackIndex: trackIndex++,
                displayId: cellConfig.id,
                type: cellConfig.type,
                name: cellConfig.name || 'Клетка',
                description: cellConfig.description || '',
                income: typeof cellConfig.income === 'number' ? cellConfig.income : 0,
                cost: typeof cellConfig.cost === 'number' ? cellConfig.cost : 0,
                isPercentage: Boolean(cellConfig.isPercentage),
                icon: theme.icon,
                accent: theme.accent,
                className: theme.className,
                layer: 'outer',
                source: cellConfig
            };
            this.cells.push(record);
            this.cellIndexMap.set(record.trackIndex, record);
            this.cellDataById.set(record.id, record);
            return record;
        });

        this.innerCellsRecords = this.innerCellsConfig.map((cellConfig) => {
            const theme = INNER_CELL_THEMES[cellConfig.type] || INNER_CELL_THEMES.default;
            const record = {
                id: this.outerCellsConfig.length + cellConfig.id,
                trackIndex: trackIndex++,
                displayId: cellConfig.id,
                type: cellConfig.type,
                name: cellConfig.name || 'Клетка',
                description: cellConfig.description || '',
                icon: theme.icon,
                accent: theme.accent,
                className: theme.className,
                layer: 'inner',
                source: cellConfig
            };
            this.cells.push(record);
            this.cellIndexMap.set(record.trackIndex, record);
            this.cellDataById.set(record.id, record);
            return record;
        });

        console.log(`🎯 Board cells initialized: ${this.outerCellsRecords.length} outer + ${this.innerCellsRecords.length} inner`);
    }

    renderBoard() {
        if (!this.outerTrackElement || !this.innerTrackElement) {
            console.error('Board: track elements not found');
            return;
        }

        this.outerTrackElement.innerHTML = '';
        this.innerTrackElement.innerHTML = '';
        this.outerCellEntries = [];
        this.innerCellEntries = [];
        this.cellPositions.clear();

        this.outerCellsRecords.forEach((record, index) => {
            const element = this.createCellElement(record);
            element.dataset.index = String(index);
            element.dataset.layer = 'outer';
            this.outerTrackElement.appendChild(element);
            this.outerCellEntries.push({ element, record, index });
            record.element = element;
        });

        this.innerCellsRecords.forEach((record, index) => {
            const element = this.createCellElement(record);
            element.dataset.index = String(index);
            element.dataset.layer = 'inner';
            this.innerTrackElement.appendChild(element);
            this.innerCellEntries.push({ element, record, index });
            record.element = element;
        });

        this.positionAllCells();
    }

    createCellElement(record) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `track-cell ${record.className}`;
        button.dataset.trackIndex = String(record.trackIndex);
        button.dataset.cellDisplay = String(record.displayId);
        button.setAttribute('aria-label', `${record.displayId}. ${sanitizeText(record.name)}`);
        button.innerHTML = `
            <span class="cell-number">${record.displayId}</span>
            <span class="cell-icon">${record.icon || '🎲'}</span>
            <span class="cell-players"></span>
        `;
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            this.handleCellClick(record);
        });
        return button;
    }

    positionAllCells() {
        const boardSize = this.getBoardSize();
        if (!boardSize) return;

        const outerCellSize = this.getOuterCellSize();
        const innerCellSize = this.getInnerCellSize();

        const outerRadius = this.computeOuterRadius(boardSize, outerCellSize);
        const innerRadius = this.computeInnerRadius(boardSize, innerCellSize);

        const outerTotal = Math.max(this.outerCellEntries.length, 1);
        const innerTotal = Math.max(this.innerCellEntries.length, 1);

        this.outerCellEntries.forEach((entry) => {
            this.positionCell(entry, outerTotal, outerRadius, boardSize);
        });

        this.innerCellEntries.forEach((entry) => {
            this.positionCell(entry, innerTotal, innerRadius, boardSize);
        });

        this.updatePlayerTokens();
    }

    positionCell(entry, total, radius, boardSize) {
        const angleStep = (Math.PI * 2) / total;
        const startAngle = -Math.PI / 2; // 12 часов
        const angle = startAngle + entry.index * angleStep;
        const center = boardSize / 2;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);

        entry.element.style.left = `${x}px`;
        entry.element.style.top = `${y}px`;
        entry.element.style.transform = 'translate(-50%, -50%)';

        this.cellPositions.set(entry.record.id, {
            x,
            y,
            layer: entry.record.layer
        });
    }

    getBoardSize() {
        if (this.boardElement) {
            const size = this.boardElement.clientWidth;
            if (size) {
                this.boardElement.style.setProperty('--computed-board-size', `${size}px`);
                return size;
            }
        }
        return getBoardSizeFallback();
    }

    getOuterCellSize() {
        return parseCssNumber('--outer-cell-size', 54);
    }

    getInnerCellSize() {
        return parseCssNumber('--inner-cell-size', 48);
    }

    computeOuterRadius(boardSize, cellSize) {
        const padding = Math.max(cellSize, boardSize * 0.08);
        return boardSize / 2 - padding;
    }

    computeInnerRadius(boardSize, cellSize) {
        const padding = Math.max(cellSize * 1.5, boardSize * 0.27);
        return boardSize / 2 - padding;
    }

    setupEvents() {
        if (this.eventBus) {
            this.eventBus.on('playerMoved', this.boundHandlers.playerMoved);
            this.eventBus.on('playerAdded', this.boundHandlers.playerAdded);
            this.eventBus.on('playerRemoved', this.boundHandlers.playerRemoved);
            this.eventBus.on('gameStateUpdated', this.boundHandlers.gameStateUpdated);
        }

        if (this.modalElements.action) {
            this.modalElements.action.addEventListener('click', this.hideCellModal);
            this.modalElements.action.textContent = 'Закрыть';
        }
        const closeButton = document.getElementById('modalClose');
        if (closeButton) {
            closeButton.addEventListener('click', this.hideCellModal);
        }
        if (this.modalElements.root) {
            this.modalElements.root.addEventListener('click', (event) => {
                if (event.target === this.modalElements.root) {
                    this.hideCellModal();
                }
            });
        }

        window.addEventListener('resize', this.handleResize);
        document.addEventListener('keydown', this.handleKeyDown);
    }

    handleResize() {
        window.requestAnimationFrame(() => {
            this.positionAllCells();
        });
    }

    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.hideCellModal();
        }
    }

    handleCellClick(record) {
        if (this.eventBus) {
            this.eventBus.emit('cellClicked', {
                cell: record,
                cellId: record.id,
                layer: record.layer
            });
        }
        this.showCellModal(record);
    }

    showCellModal(record) {
        if (!this.modalElements.root || !this.modalElements.card) return;

        const themeLabel = record.layer === 'outer'
            ? (OUTER_CELL_THEMES[record.type]?.label || OUTER_CELL_THEMES.default.label)
            : (INNER_CELL_THEMES[record.type]?.label || INNER_CELL_THEMES.default.label);

        const accent = record.accent || '#475569';
        const accentGradient = `linear-gradient(135deg, ${hexToRgba(accent, 0.45)} 0%, ${hexToRgba(accent, 0.2)} 100%)`;
        this.modalElements.card.style.setProperty('--modal-accent', accentGradient);

        if (this.modalElements.icon) {
            this.modalElements.icon.textContent = record.icon || '🎲';
        }
        if (this.modalElements.title) {
            this.modalElements.title.textContent = `Клетка ${record.displayId}. ${sanitizeText(record.name)}`;
        }
        this.renderModalContent(record, themeLabel);

        this.modalElements.root.classList.add('show');
    }

    renderModalContent(record, themeLabel) {
        const container = this.modalElements.text;
        if (!container) return;
        container.innerHTML = '';

        const description = document.createElement('p');
        description.className = 'modal-description';
        description.textContent = sanitizeText(record.description || record.source?.description || '—');
        container.appendChild(description);

        const stats = document.createElement('div');
        stats.className = 'modal-stats';

        const addStat = (label, value, tone = null) => {
            if (!value && value !== 0) return;
            const row = document.createElement('div');
            row.className = 'modal-stat';
            if (tone) {
                row.classList.add(`modal-stat--${tone}`);
            }
            const labelSpan = document.createElement('span');
            labelSpan.textContent = label;
            const valueSpan = document.createElement('strong');
            valueSpan.textContent = sanitizeText(value);
            row.appendChild(labelSpan);
            row.appendChild(valueSpan);
            stats.appendChild(row);
        };

        addStat('Тип', themeLabel);

        if (record.layer === 'outer') {
            const incomeValue = formatCurrency(record.income);
            if (incomeValue && record.income !== 0) {
                addStat('Доход', incomeValue, 'positive');
            }
            if (typeof record.source.cost === 'number' && record.source.cost !== 0) {
                if (record.isPercentage) {
                    addStat('Изменение средств', `${Math.round(Math.abs(record.source.cost) * 100)}%`, record.source.cost < 0 ? 'negative' : 'positive');
                } else {
                    const costValue = formatCurrency(Math.abs(record.source.cost));
                    addStat(record.source.cost < 0 ? 'Расход' : 'Стоимость', costValue, record.source.cost < 0 ? 'negative' : 'neutral');
                }
            }
        } else {
            const innerSource = record.source || {};
            if (innerSource.action) {
                addStat('Действие', sanitizeText(innerSource.action));
            }
            if (typeof innerSource.minCost === 'number') {
                addStat('Мин. сумма', formatCurrency(innerSource.minCost), 'negative');
            }
            if (typeof innerSource.maxCost === 'number') {
                addStat('Макс. сумма', formatCurrency(innerSource.maxCost));
            }
            if (innerSource.percentage) {
                addStat('Процент', `${Math.round(innerSource.percentage * 100)}%`);
            }
            if (innerSource.benefit) {
                addStat('Эффект', sanitizeText(innerSource.benefit));
            }
        }

        if (stats.children.length) {
            container.appendChild(stats);
        }
    }

    hideCellModal() {
        if (this.modalElements.root) {
            this.modalElements.root.classList.remove('show');
        }
    }

    onPlayerMoved(data) {
        const { playerId, newPosition } = data;
        this.movePlayerToken(playerId, newPosition);
    }

    onPlayerAdded(data) {
        const { player } = data;
        this.addPlayerToken(player);
    }

    onPlayerRemoved(data) {
        const { player } = data;
        this.removePlayerToken(player.id);
    }

    onGameStateUpdated(gameState) {
        if (!gameState?.players) return;
        gameState.players.forEach((player) => {
            this.updatePlayerPosition(player);
        });
    }

    addPlayerToken(player) {
        if (!player?.id || this.players.has(player.id)) return;

        const token = document.createElement('div');
        token.className = 'player-token';
        token.dataset.playerId = player.id;
        token.textContent = sanitizeText(player.name || player.id).charAt(0).toUpperCase();
        token.style.backgroundColor = this.getPlayerColor(player.id);
        token.style.transform = 'translate(-50%, -50%)';

        if (this.playerTokensElement) {
            this.playerTokensElement.appendChild(token);
        }

        this.players.set(player.id, token);
        this.movePlayerToken(player.id, player.position || 0);
    }

    removePlayerToken(playerId) {
        const token = this.players.get(playerId);
        if (token?.parentNode) {
            token.parentNode.removeChild(token);
        }
        this.players.delete(playerId);
        const previousCell = this.playerPositions.get(playerId);
        if (previousCell !== undefined) {
            const occupants = this.cellOccupancy.get(previousCell);
            if (occupants) {
                this.cellOccupancy.set(previousCell, occupants.filter((id) => id !== playerId));
            }
        }
        this.playerPositions.delete(playerId);
    }

    movePlayerToken(playerId, newPosition) {
        const token = this.players.get(playerId);
        if (!token) return;

        let record = this.cellIndexMap.get(newPosition);
        if (!record) {
            record = this.cellDataById.get(newPosition);
        }
        if (!record) {
            console.warn(`Board: unable to resolve cell for position ${newPosition}`);
            return;
        }

        const coords = this.cellPositions.get(record.id);
        if (!coords) {
            console.warn(`Board: coordinates missing for cell ${record.id}`);
            return;
        }

        const previousCellId = this.playerPositions.get(playerId);
        if (previousCellId !== undefined) {
            const prevOccupants = this.cellOccupancy.get(previousCellId) || [];
            this.cellOccupancy.set(previousCellId, prevOccupants.filter((id) => id !== playerId));
        }

        const occupants = this.cellOccupancy.get(record.id) || [];
        if (!occupants.includes(playerId)) {
            occupants.push(playerId);
            this.cellOccupancy.set(record.id, occupants);
        }
        this.playerPositions.set(playerId, record.id);

        const offset = this.computePlayerOffset(Math.max(0, occupants.indexOf(playerId)), occupants.length, record.layer);
        token.style.left = `${coords.x + offset.x}px`;
        token.style.top = `${coords.y + offset.y}px`;
    }

    computePlayerOffset(index, total, layer) {
        if (total <= 1) {
            return { x: 0, y: 0 };
        }
        const spread = layer === 'outer' ? 12 : 10;
        const angle = (index / total) * 2 * Math.PI;
        return {
            x: Math.cos(angle) * spread,
            y: Math.sin(angle) * spread
        };
    }

    updatePlayerPosition(player) {
        if (!player?.id) return;
        if (this.players.has(player.id)) {
            this.movePlayerToken(player.id, player.position || 0);
        } else {
            this.addPlayerToken(player);
        }
    }

    updatePlayerTokens() {
        this.players.forEach((token, playerId) => {
            const cellId = this.playerPositions.get(playerId);
            if (cellId === undefined) return;
            const coords = this.cellPositions.get(cellId);
            if (!coords) return;
            const occupants = this.cellOccupancy.get(cellId) || [];
            const index = Math.max(0, occupants.indexOf(playerId));
            const offset = this.computePlayerOffset(index, occupants.length, coords.layer);
            token.style.left = `${coords.x + offset.x}px`;
            token.style.top = `${coords.y + offset.y}px`;
        });
    }

    getPlayerColor(playerId) {
        const palette = ['#FF6B6B', '#4ECDC4', '#4F86F7', '#FFC107', '#9C27B0', '#00BCD4', '#8BC34A', '#FF9800'];
        let hash = 0;
        for (let i = 0; i < playerId.length; i++) {
            hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return palette[Math.abs(hash) % palette.length];
    }

    getCell(cellId) {
        return this.cellDataById.get(cellId) || null;
    }

    getAllCells() {
        return [...this.cells];
    }

    clearBoard() {
        this.players.forEach((token) => {
            if (token.parentNode) {
                token.parentNode.removeChild(token);
            }
        });
        this.players.clear();
        this.playerPositions.clear();
        this.cellOccupancy.clear();
        if (this.outerTrackElement) {
            this.outerTrackElement.innerHTML = '';
        }
        if (this.innerTrackElement) {
            this.innerTrackElement.innerHTML = '';
        }
    }

    redraw() {
        this.renderBoard();
    }

    destroy() {
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('keydown', this.handleKeyDown);
        if (this.eventBus) {
            this.eventBus.off?.('playerMoved', this.boundHandlers.playerMoved);
            this.eventBus.off?.('playerAdded', this.boundHandlers.playerAdded);
            this.eventBus.off?.('playerRemoved', this.boundHandlers.playerRemoved);
            this.eventBus.off?.('gameStateUpdated', this.boundHandlers.gameStateUpdated);
        }
        this.clearBoard();
        this.hideCellModal();
        this.isInitialized = false;
    }

    addBoardStyles() {
        if (document.getElementById('board-styles')) return;

        const style = document.createElement('style');
        style.id = 'board-styles';
        style.textContent = `
            :root {
                --board-size: 700px;
                --outer-cell-size: 54px;
                --outer-cell-gap: 4px;
                --inner-cell-size: 50px;
            }

            .board-frame {
                position: relative;
                width: var(--board-size);
                height: var(--board-size);
                border-radius: 48px;
                background: linear-gradient(160deg, #151d30 0%, #111527 45%, #0f1422 100%);
                box-shadow: 0 40px 120px rgba(0, 0, 0, 0.6), inset 0 0 60px rgba(255, 255, 255, 0.04);
                overflow: visible;
            }

            .board-frame::before {
                content: '';
                position: absolute;
                inset: 16px;
                border-radius: 40px;
                background: radial-gradient(circle at 50% 42%, rgba(255, 205, 64, 0.12) 0%, transparent 60%),
                            linear-gradient(200deg, rgba(32, 48, 78, 0.7) 0%, rgba(16, 22, 34, 0.95) 62%);
                border: 1px solid rgba(255, 255, 255, 0.05);
                pointer-events: none;
            }

            .outer-track,
            .inner-track {
                position: absolute;
                inset: 0;
                pointer-events: none;
            }

            .track-cell {
                position: absolute;
                width: var(--outer-cell-size);
                height: var(--outer-cell-size);
                border-radius: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                gap: 4px;
                font-size: 20px;
                font-weight: 700;
                color: #fff;
                box-shadow: 0 12px 26px rgba(0, 0, 0, 0.45);
                border: 2px solid rgba(255, 255, 255, 0.14);
                pointer-events: auto;
                transition: transform 0.25s ease, box-shadow 0.25s ease;
                cursor: pointer;
            }

            .track-cell:focus {
                outline: none;
            }

            .track-cell:focus-visible {
                box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.4), 0 12px 26px rgba(0, 0, 0, 0.45);
            }

            .track-cell:hover {
                transform: translate(-50%, -50%) scale(1.05);
                box-shadow: 0 22px 46px rgba(0, 0, 0, 0.55);
            }

            .cell-number {
                position: absolute;
                top: 6px;
                left: 8px;
                font-size: 12px;
                font-weight: 800;
                color: rgba(255, 255, 255, 0.92);
                text-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
            }

            .cell-icon {
                font-size: 22px;
                filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.35));
            }

            .cell-players {
                position: absolute;
                inset: 0;
                pointer-events: none;
            }

            .cell-pink { background: linear-gradient(145deg, #ff4f93 0%, #ff2780 100%); }
            .cell-green { background: linear-gradient(145deg, #32df8d 0%, #19b86a 100%); }
            .cell-teal { background: linear-gradient(145deg, #25d0ff 0%, #0090f5 100%); }
            .cell-purple { background: linear-gradient(145deg, #a769ff 0%, #7351ff 100%); }
            .cell-orange { background: linear-gradient(145deg, #ffb347 0%, #ff8c42 100%); }
            .cell-yellow { background: linear-gradient(145deg, #ffd65a 0%, #ffb700 100%); color: #2f2600; }
            .cell-blue { background: linear-gradient(145deg, #4e95ff 0%, #2563eb 100%); }
            .cell-red { background: linear-gradient(145deg, #ff6b6b 0%, #ff3b3b 100%); }
            .cell-slate { background: linear-gradient(145deg, #34435a 0%, #1e2838 100%); }
            .cell-black { background: linear-gradient(145deg, #1f2937 0%, #0f172a 100%); border-color: rgba(255, 255, 255, 0.1); }

            .inner-track .track-cell {
                width: var(--inner-cell-size);
                height: var(--inner-cell-size);
                font-size: 18px;
                border-width: 1.5px;
            }

            .inner-track .cell-number {
                right: 8px;
                left: auto;
                font-size: 12px;
            }

            .center-wheel {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: calc(var(--computed-board-size, var(--board-size)) * 0.32);
                height: calc(var(--computed-board-size, var(--board-size)) * 0.32);
                max-width: 230px;
                max-height: 230px;
                min-width: 170px;
                min-height: 170px;
                border-radius: 50%;
                background: radial-gradient(circle at 50% 40%, rgba(255, 209, 64, 0.78) 0%, rgba(255, 166, 0, 0.82) 34%, rgba(25, 25, 25, 0.96) 64%);
                box-shadow: 0 0 50px rgba(255, 196, 0, 0.5), inset 0 0 40px rgba(0, 0, 0, 0.55);
                border: 4px solid rgba(255, 205, 92, 0.55);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: transform 0.4s ease, box-shadow 0.4s ease;
            }

            .center-wheel::before {
                content: '';
                position: absolute;
                inset: 18px;
                border-radius: 50%;
                background: radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.92) 0%, rgba(40, 40, 40, 1) 65%, rgba(0, 0, 0, 0.94) 100%);
                border: 2px solid rgba(255, 205, 92, 0.45);
            }

            .center-wheel:hover {
                transform: translate(-50%, -50%) scale(1.03);
                box-shadow: 0 0 70px rgba(255, 196, 0, 0.65), inset 0 0 44px rgba(0, 0, 0, 0.6);
            }

            .wheel-number {
                position: relative;
                font-size: clamp(48px, calc(var(--computed-board-size, var(--board-size)) * 0.12), 82px);
                font-weight: 800;
                color: #ffd15a;
                text-shadow: 0 0 20px rgba(255, 196, 0, 0.55);
                z-index: 2;
            }

            .player-tokens {
                position: absolute;
                inset: 0;
                pointer-events: none;
            }

            .player-token {
                position: absolute;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                font-weight: 700;
                color: #fff;
                box-shadow: 0 12px 20px rgba(0, 0, 0, 0.35);
                border: 2px solid rgba(255, 255, 255, 0.22);
                transform: translate(-50%, -50%);
            }

            .cell-modal {
                position: fixed;
                inset: 0;
                background: rgba(7, 12, 20, 0.78);
                backdrop-filter: blur(12px);
                display: none;
                align-items: center;
                justify-content: center;
                padding: 24px;
                z-index: 1050;
            }

            .cell-modal.show {
                display: flex;
            }

            .modal-card {
                position: relative;
                width: min(420px, 100%);
                border-radius: 28px;
                padding: 32px 28px 28px;
                background: linear-gradient(165deg, rgba(20, 27, 44, 0.95), rgba(13, 18, 32, 0.95));
                border: 1px solid rgba(255, 255, 255, 0.12);
                box-shadow: 0 28px 66px rgba(0, 0, 0, 0.55);
                display: flex;
                flex-direction: column;
                gap: 18px;
            }

            .modal-card::before {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: 28px;
                background: var(--modal-accent, linear-gradient(135deg, rgba(79, 172, 254, 0.35), rgba(0, 242, 254, 0.22)));
                opacity: 0.7;
                z-index: -1;
            }

            .modal-description {
                font-size: 15px;
                line-height: 1.6;
                color: rgba(240, 244, 255, 0.88);
            }

            .modal-stats {
                display: flex;
                flex-direction: column;
                gap: 8px;
                font-size: 13px;
            }

            .modal-stat {
                display: flex;
                justify-content: space-between;
                color: rgba(230, 236, 255, 0.76);
            }

            .modal-stat strong {
                color: #f9fafc;
            }

            .modal-stat--positive strong { color: #4ade80; }
            .modal-stat--negative strong { color: #f87171; }

            @media (max-width: 960px) {
                :root {
                    --board-size: 560px;
                    --outer-cell-size: 40px;
                    --inner-cell-size: 40px;
                }
            }

            @media (max-width: 640px) {
                :root {
                    --board-size: 480px;
                    --outer-cell-size: 32px;
                    --inner-cell-size: 34px;
                }
            }
        `;

        document.head.appendChild(style);
    }
}

window.Board = Board;
