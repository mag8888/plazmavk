/**
 * Game Board v2.0 Server
 * Express сервер для развертывания на Railway
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Database imports
const { connectToDatabase, getConnectionStatus } = require('./config/database');
const Room = require('./models/Room');
const User = require('./models/User');
const Profession = require('./models/Profession');
const BankAccount = require('./models/BankAccount');
const { GAME_CELLS, GameCellsUtils } = require('./config/game-cells');
const { MARKET_CARDS, EXPENSE_CARDS, SMALL_DEALS, BIG_DEALS, CardsUtils } = require('./config/cards-config');
const userManager = require('./utils/userManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: (origin, callback) => callback(null, origin || true),
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
        allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization", "X-User-ID", "X-User-Name"]
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000
});
const PORT = process.env.PORT || 8080;

// Express CORS middleware (reflect origin + allow credentials)
app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-User-ID, X-User-Name, Cache-Control, Pragma');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    res.header('Access-Control-Expose-Headers', 'Content-Length, X-JSON, Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Initialize Database Connection
async function initializeDatabase() {
    try {
        await connectToDatabase();
        console.log('✅ Database connection established');
        
        // Initialize default profession if not exists
        await initializeDefaultProfession();
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.log('🔄 Continuing with in-memory storage...');
    }
}

// Initialize default profession
async function initializeDefaultProfession() {
    try {
        const existingProfession = await Profession.findOne({ name: 'Предприниматель' });
        if (!existingProfession) {
            const defaultProfession = new Profession({
                name: 'Предприниматель',
                description: 'Владелец бизнеса',
                category: 'entrepreneur',
                difficulty: 'medium',
                startingFinancials: {
                    income: 10000,
                    expenses: 6200,
                    cashflow: 3800,
                    startingBalance: 1000
                },
                liabilities: [
                    { name: 'Налоги', type: 'tax', payment: 1300, principal: 0 },
                    { name: 'Прочие расходы', type: 'expense', payment: 1500, principal: 0 },
                    { name: 'Кредит на авто', type: 'loan', payment: 700, principal: 14000 },
                    { name: 'Образовательный кредит', type: 'loan', payment: 500, principal: 10000 },
                    { name: 'Ипотека', type: 'mortgage', payment: 1200, principal: 240000 },
                    { name: 'Кредитные карты', type: 'credit_card', payment: 1000, principal: 20000 }
                ],
                totalLiabilities: 284000,
                paths: [
                    {
                        name: 'Business',
                        description: 'Развитие бизнеса',
                        difficulty: 'business',
                        requirements: { minIncome: 8000, minCashflow: 2000, maxLiabilities: 300000 },
                        benefits: { incomeMultiplier: 1.2, expenseReduction: 500 }
                    },
                    {
                        name: 'Сложный',
                        description: 'Сложный путь развития',
                        difficulty: 'hard',
                        requirements: { minIncome: 12000, minCashflow: 4000, maxLiabilities: 200000 },
                        benefits: { incomeMultiplier: 1.5, expenseReduction: 1000 }
                    }
                ]
            });
            
            await defaultProfession.save();
            console.log('✅ Default profession created');
        }
    } catch (error) {
        console.error('❌ Failed to create default profession:', error.message);
    }
}

// Middleware
app.use(express.static(path.join(__dirname)));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use('/favicon.svg', express.static(path.join(__dirname, '..', 'favicon.svg')));
app.use(express.json());

// Helpers --------------------------------------------------------------
const getPlayerIdentifier = (player) => player?.userId || player?.id || null;

const DEFAULT_STATS = () => ({
    turnsTaken: 0,
    diceRolled: 0,
    dealsBought: 0,
    dealsSkipped: 0,
    dealsTransferred: 0,
    assetsOwned: 0,
    assetsSold: 0,
    incomeReceived: 0,
    expensesPaid: 0
});

const PROFESSIONS_INDEX = {
    entrepreneur: {
        id: 'entrepreneur',
        name: 'Предприниматель',
        description: 'Владелец успешного бизнеса',
        salary: 10000,
        expenses: 6200,
        cashFlow: 3800,
        icon: '🚀'
    },
    doctor: {
        id: 'doctor',
        name: 'Врач',
        description: 'Специалист в области медицины',
        salary: 8000,
        expenses: 4500,
        cashFlow: 3500,
        icon: '👨‍⚕️'
    }
};

const getProfessionCard = (professionId) => {
    return PROFESSIONS_INDEX[professionId] || PROFESSIONS_INDEX.entrepreneur;
};

const createRoomPlayer = ({ user, isHost = false, socketId = null, professionId = 'entrepreneur' }) => ({
    userId: user.id,
    id: user.id, // alias for backward compatibility
    name: user.username,
    email: user.email,
    isHost,
    isReady: false,
    selectedToken: null,
    selectedDream: null,
    socketId,
    joinedAt: new Date().toISOString(),
    position: 0,
    cash: 10000,
    passiveIncome: 0,
    assets: [],
    stats: DEFAULT_STATS(),
    professionId,
    profession: getProfessionCard(professionId)
});

const sanitizePlayer = (player = {}) => ({
    userId: player.userId || player.id || null,
    name: player.name || 'Игрок',
    email: player.email || null,
    isHost: Boolean(player.isHost),
    isReady: Boolean(player.isReady),
    selectedToken: player.selectedToken ?? player.token ?? null,
    selectedDream: player.selectedDream ?? player.dream ?? null,
    joinedAt: player.joinedAt || null,
    position: player.position || 0,
    cash: player.cash ?? 10000,
    passiveIncome: player.passiveIncome ?? 0,
    assets: Array.isArray(player.assets) ? player.assets : [],
    stats: player.stats || DEFAULT_STATS(),
    profession: getProfessionCard(player.professionId)
});

const sanitizeRoom = (room, { requestingUserId = null } = {}) => {
    const players = (room?.players || []).map(sanitizePlayer);
    const readyCount = players.filter(player => player.isReady).length;
    const playerCount = players.length;
    const host = players.find(player => player.isHost) || null;
    const currentPlayer = requestingUserId
        ? players.find(player => player.userId === requestingUserId.toString()) || null
        : null;

    return {
        id: room.id,
        name: room.name,
        maxPlayers: room.maxPlayers,
        turnTime: room.turnTime,
        status: room.status,
        gameStarted: room.status === 'playing',
        assignProfessions: Boolean(room.assignProfessions),
        defaultProfession: room.defaultProfession || null,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt || room.createdAt,
        creatorId: room.creatorId || host?.userId || null,
        creatorName: room.creatorName || host?.name || null,
        players,
        playerCount,
        readyCount,
        canStart: playerCount >= 2 && readyCount >= 2,
        currentPlayer
    };
};

const broadcastRoomsUpdate = () => {
    io.emit('roomsUpdate', serverRooms.map(room => sanitizeRoom(room)));
};

const normalizeTurnOrder = (room) => {
    if (!room.gameState) return;
    const existingIds = new Set(room.players.map(player => getPlayerIdentifier(player)));
    room.gameState.turnOrder = (room.gameState.turnOrder || []).filter(id => existingIds.has(id));
    if (room.gameState.turnOrder.length === 0) {
        room.gameState.turnOrder = Array.from(existingIds);
        room.gameState.activePlayerIndex = 0;
    } else {
        room.gameState.activePlayerIndex = room.gameState.activePlayerIndex % room.gameState.turnOrder.length;
    }
};

const getRequestUserId = (req) => {
    const id = req.headers['x-user-id'] || req.body?.user_id || req.query?.user_id;
    return id ? id.toString() : '';
};

const requireServerRoom = (roomId) => {
    const room = serverRooms.find(r => r.id === roomId);
    if (!room) {
        const error = new Error('Комната не найдена');
        error.status = 404;
        throw error;
    }
    return room;
};

const requireRoomPlayer = (room, userId) => {
    if (!userId) {
        const error = new Error('Не указан идентификатор пользователя');
        error.status = 400;
        throw error;
    }
    const player = room.players.find(p => getPlayerIdentifier(p) === userId);
    if (!player) {
        const error = new Error('Игрок не найден в комнате');
        error.status = 404;
        throw error;
    }
    return player;
};

const sendRoomError = (res, error) => {
    const status = error.status || 400;
    res.status(status).json({ success: false, message: error.message });
};

const respondWithRoom = (res, room, userId, { includePlayers = true } = {}) => {
    res.json({
        success: true,
        room: sanitizeRoom(room, { includePlayers, requestingUserId: userId })
    });
};

const ensureGameState = (room) => {
    if (!room.gameState) {
        // Назначаем одинаковую профессию всем игрокам при начале игры
        const defaultProfession = room.defaultProfession || 'entrepreneur';
        const professionCard = getProfessionCard(defaultProfession);
        
        room.players.forEach(player => {
            player.professionId = defaultProfession;
            player.profession = professionCard;
        });
        
        const turnOrder = room.players.map(player => getPlayerIdentifier(player)).filter(Boolean);
        room.gameState = {
            startedAt: new Date().toISOString(),
            activePlayerIndex: 0,
            turnOrder,
            roundsCompleted: 0,
            lastRoll: null,
            history: []
        };
    }
    normalizeTurnOrder(room);
    return room.gameState;
};

const buildGameState = (room, userId) => {
    const gameState = ensureGameState(room);
    const playersMap = new Map(room.players.map(player => [getPlayerIdentifier(player), player]));
    const players = gameState.turnOrder
        .map(id => playersMap.get(id))
        .filter(Boolean)
        .map(player => ({
            userId: player.userId,
            name: player.name,
            isHost: Boolean(player.isHost),
            isReady: Boolean(player.isReady),
            selectedDream: player.selectedDream || null,
            selectedToken: player.selectedToken || null,
            position: player.position || 0,
            cash: player.cash ?? 10000,
            passiveIncome: player.passiveIncome ?? 0,
            profession: player.profession || null,
            professionId: player.professionId || null
        }));

    const activePlayerId = gameState.turnOrder[gameState.activePlayerIndex] || null;
    const currentPlayer = userId ? players.find(player => player.userId === userId) || null : null;

    return {
        roomId: room.id,
        name: room.name,
        status: room.status,
        startedAt: gameState.startedAt,
        turnTime: room.turnTime,
        activePlayerId,
        turnOrder: [...gameState.turnOrder],
        roundsCompleted: gameState.roundsCompleted,
        lastRoll: gameState.lastRoll,
        players,
        currentPlayer
    };
};

const rollDiceValues = () => {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    return {
        values: [die1, die2],
        total: die1 + die2,
        isDouble: die1 === die2
    };
};

const getActivePlayer = (room) => {
    if (!room.gameState || !room.gameState.turnOrder.length) return null;
    const activePlayerId = room.gameState.turnOrder[room.gameState.activePlayerIndex];
    return room.players.find(player => getPlayerIdentifier(player) === activePlayerId) || null;
};

const advanceTurn = (room) => {
    if (!room.gameState || !room.gameState.turnOrder.length) {
        return;
    }
    room.gameState.activePlayerIndex = (room.gameState.activePlayerIndex + 1) % room.gameState.turnOrder.length;
    room.gameState.lastRoll = null;
    room.gameState.phase = 'awaiting_roll';
    room.gameState.roundsCompleted += room.gameState.activePlayerIndex === 0 ? 1 : 0;
};

const BOARD_SIZE = GAME_CELLS.length || 40;
const PASS_START_BONUS = 2000;

const applyCellEffects = (room, player, cell, events) => {
    if (!cell) return;
    const effects = cell.effects || {};

    if (effects.income) {
        const income = 2000;
        player.cash += income;
        player.stats.incomeReceived += income;
        events.push({ type: 'income', amount: income, description: cell.name });
    }

    if (typeof effects.cashMultiplier === 'number') {
        const delta = Math.round(player.cash * effects.cashMultiplier);
        player.cash += delta;
        if (delta >= 0) {
            events.push({ type: 'bonus', amount: delta, description: cell.name });
        } else {
            player.stats.expensesPaid += Math.abs(delta);
            events.push({ type: 'expense', amount: delta, description: cell.name });
        }
    }

    if (typeof effects.monthlyIncome === 'number') {
        player.passiveIncome += effects.monthlyIncome;
        events.push({ type: 'income', amount: effects.monthlyIncome, description: `Пассивный доход: ${cell.name}` });
    }

    if (cell.type === 'dream') {
        player.dreamAchieved = true;
        events.push({ type: 'dream', description: `Мечта достигнута: ${cell.name}` });
    }
};

const movePlayer = (room, player, rollResult) => {
    const oldPosition = player.position || 0;
    const totalSteps = rollResult.total;
    const rawPosition = oldPosition + totalSteps;
    const newPosition = BOARD_SIZE
        ? ((rawPosition % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE
        : rawPosition;

    let passedStart = false;
    if (BOARD_SIZE && rawPosition >= BOARD_SIZE) {
        passedStart = true;
        player.cash += PASS_START_BONUS;
        player.stats.incomeReceived += PASS_START_BONUS;
    }

    player.position = newPosition;

    const cell = BOARD_SIZE ? GAME_CELLS[newPosition] : null;
    const events = [];

    applyCellEffects(room, player, cell, events);

    player.stats.diceRolled += 1;

    return {
        playerId: player.userId,
        oldPosition,
        newPosition,
        passedStart,
        cell: cell
            ? {
                id: cell.id,
                name: cell.name,
                type: cell.type,
                icon: cell.icon
            }
            : null,
        events
    };
};

// Банковские данные (в реальном проекте это была бы база данных)
const bankData = {
    balances: {}, // { userId: { amount: 1000, roomId: 'room123' } }
    transferHistory: [] // { from: 'user1', to: 'user2', amount: 100, timestamp: Date, roomId: 'room123' }
};

// Функции банковских операций
function getBalance(userId, roomId) {
    const key = `${userId}_${roomId}`;
    return bankData.balances[key] || { amount: 1000, roomId }; // Стартовый баланс 1000
}

function setBalance(userId, roomId, amount) {
    const key = `${userId}_${roomId}`;
    bankData.balances[key] = { amount, roomId };
}

function addTransferHistory(from, to, amount, roomId) {
    bankData.transferHistory.push({
        from,
        to,
        amount,
        timestamp: new Date(),
        roomId
    });
}

function getTransferHistory(roomId) {
    return bankData.transferHistory.filter(t => t.roomId === roomId);
}

// Основной маршрут
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Страницы комнаты (используем общий room.html из корня)
const rootRoomPath = path.join(__dirname, '..', 'room.html');

app.get('/room', (req, res) => {
    res.sendFile(rootRoomPath);
});

app.get('/room/:roomId', (req, res) => {
    res.sendFile(rootRoomPath);
});

app.get('/game/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'game.html'));
});

// Маршруты для страниц
app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth.html'));
});

app.get('/lobby', (req, res) => {
    res.sendFile(path.join(__dirname, 'lobby.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'game.html'));
});

app.get('/game-board', (req, res) => {
    res.sendFile(path.join(__dirname, 'game-board.html'));
});

// Старый маршрут банковского модуля удален - используется v4

app.get('/profession-card', (req, res) => {
    res.sendFile(path.join(__dirname, 'profession-card.html'));
});

// API для мечт
app.get('/api/dreams', (req, res) => {
    try {
        const dreams = GameCellsUtils.getDreams();
        res.json(dreams);
    } catch (error) {
        console.error('Ошибка получения мечт:', error);
        res.status(500).json({ error: 'Ошибка получения мечт' });
    }
});

app.get('/api/dreams/random', (req, res) => {
    try {
        const randomDream = GameCellsUtils.getRandomCellByType('dream');
        res.json(randomDream);
    } catch (error) {
        console.error('Ошибка получения случайной мечты:', error);
        res.status(500).json({ error: 'Ошибка получения случайной мечты' });
    }
});

app.post('/api/room/select-dream', (req, res) => {
    try {
        const { userId, roomId, dream } = req.body;
        
        if (!userId || !roomId || !dream) {
            return res.status(400).json({ error: 'Недостаточно данных для выбора мечты' });
        }
        
        // Сохраняем выбранную мечту (в реальном проекте это будет в БД)
        const key = `dream_${userId}_${roomId}`;
        if (!bankData.selectedDreams) {
            bankData.selectedDreams = {};
        }
        
        bankData.selectedDreams[key] = {
            userId,
            roomId,
            dream,
            selectedAt: new Date()
        };
        
        // Отправляем push-событие всем участникам комнаты
        io.to(roomId).emit('dreamSelected', {
            type: 'dreamSelected',
            userId,
            roomId,
            dream,
            timestamp: new Date()
        });
        
        res.json({ 
            success: true, 
            message: 'Мечта успешно выбрана',
            dream: dream
        });
        
    } catch (error) {
        console.error('Ошибка выбора мечты:', error);
        res.status(500).json({ error: 'Ошибка выбора мечты' });
    }
});

app.get('/api/room/:roomId/dreams', (req, res) => {
    try {
        const { roomId } = req.params;
        const selectedDreams = {};
        
        // Получаем все выбранные мечты для комнаты
        if (bankData.selectedDreams) {
            Object.keys(bankData.selectedDreams).forEach(key => {
                const dreamData = bankData.selectedDreams[key];
                if (dreamData.roomId === roomId) {
                    selectedDreams[dreamData.userId] = dreamData.dream;
                }
            });
        }
        
        res.json(selectedDreams);
        
    } catch (error) {
        console.error('Ошибка получения мечт комнаты:', error);
        res.status(500).json({ error: 'Ошибка получения мечт комнаты' });
    }
});

// API для игровых клеток
app.get('/api/game-cells', (req, res) => {
    try {
        const { type, category } = req.query;
        let cells = GAME_CELLS;
        
        if (type) {
            cells = cells.filter(cell => cell.type === type);
        }
        
        res.json(cells);
    } catch (error) {
        console.error('Ошибка получения игровых клеток:', error);
        res.status(500).json({ error: 'Ошибка получения игровых клеток' });
    }
});

app.get('/api/game-cells/stats', (req, res) => {
    try {
        const stats = GameCellsUtils.getCellsStatistics();
        res.json(stats);
    } catch (error) {
        console.error('Ошибка получения статистики клеток:', error);
        res.status(500).json({ error: 'Ошибка получения статистики клеток' });
    }
});

app.get('/api/game-cells/:id', (req, res) => {
    try {
        const { id } = req.params;
        const cell = GameCellsUtils.getCellById(parseInt(id));
        
        if (!cell) {
            return res.status(404).json({ error: 'Клетка не найдена' });
        }
        
        res.json(cell);
    } catch (error) {
        console.error('Ошибка получения клетки:', error);
        res.status(500).json({ error: 'Ошибка получения клетки' });
    }
});

app.get('/dream-selection', (req, res) => {
    res.sendFile(path.join(__dirname, 'dream-selection.html'));
});

app.get('/room-entry', (req, res) => {
    res.sendFile(path.join(__dirname, 'room-entry.html'));
});

app.get('/room-dream-selection', (req, res) => {
    res.sendFile(path.join(__dirname, 'room-dream-selection.html'));
});

app.get('/deals-module', (req, res) => {
    res.sendFile(path.join(__dirname, 'deals-module.html'));
});

app.get('/lobby-module', (req, res) => {
    res.sendFile(path.join(__dirname, 'lobby-module.html'));
});

// Serve test routes page
app.get('/test-routes', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-routes.html'));
});

// API маршруты для Game Board
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Game Board v2.0',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// Банковские API маршруты
app.get('/api/bank/balance/:userId/:roomId', (req, res) => {
    const { userId, roomId } = req.params;
    const balance = getBalance(userId, roomId);
    res.json(balance);
});

app.post('/api/bank/transfer', (req, res) => {
    const { from, to, amount, roomId } = req.body;
    
    // Валидация
    if (!from || !to || !amount || !roomId) {
        return res.status(400).json({ error: 'Недостаточно данных для перевода' });
    }
    
    if (from === to) {
        return res.status(400).json({ error: 'Нельзя переводить самому себе' });
    }
    
    if (amount <= 0) {
        return res.status(400).json({ error: 'Сумма должна быть положительной' });
    }
    
    const fromBalance = getBalance(from, roomId);
    if (fromBalance.amount < amount) {
        return res.status(400).json({ error: 'Недостаточно средств для перевода' });
    }
    
    // Выполняем перевод
    const toBalance = getBalance(to, roomId);
    
    // Списываем у отправителя
    setBalance(from, roomId, fromBalance.amount - amount);
    
    // Зачисляем получателю
    setBalance(to, roomId, toBalance.amount + amount);
    
    // Добавляем в историю
    addTransferHistory(from, to, amount, roomId);
    
    // Отправляем push-события всем участникам комнаты
    io.to(roomId).emit('bankUpdate', {
        type: 'transfer',
        from,
        to,
        amount,
        roomId,
        timestamp: new Date()
    });
    
    res.json({ 
        success: true, 
        message: 'Перевод выполнен успешно',
        newBalance: getBalance(from, roomId)
    });
});

app.get('/api/bank/history/:roomId', (req, res) => {
    const { roomId } = req.params;
    const history = getTransferHistory(roomId);
    res.json(history);
});

app.get('/api/bank/room-balances/:roomId', (req, res) => {
    const { roomId } = req.params;
    const balances = {};
    
    // Получаем все балансы для комнаты
    Object.keys(bankData.balances).forEach(key => {
        const [userId, userRoomId] = key.split('_');
        if (userRoomId === roomId) {
            balances[userId] = bankData.balances[key];
        }
    });
    
    res.json(balances);
});

// API для управления профессиями
app.get('/api/profession/:userId/:roomId', (req, res) => {
    const { userId, roomId } = req.params;
    const key = `profession_${userId}_${roomId}`;
    
    // Возвращаем данные профессии или начальные значения
    const professionData = bankData.professions?.[key] || {
        profession: 'Предприниматель',
        income: 10000,
        expenses: 6200,
        cashflow: 3800,
        liabilities: {
            taxes: 1300,
            other: 1500,
            carLoan: { payment: 700, principal: 14000 },
            educationLoan: { payment: 500, principal: 10000 },
            mortgage: { payment: 1200, principal: 240000 },
            creditCards: { payment: 1000, principal: 20000 }
        },
        totalLiabilities: 284000
    };
    
    res.json(professionData);
});

app.post('/api/profession/update', (req, res) => {
    const { userId, roomId, updates } = req.body;
    
    if (!userId || !roomId || !updates) {
        return res.status(400).json({ error: 'Недостаточно данных для обновления' });
    }
    
    const key = `profession_${userId}_${roomId}`;
    
    // Инициализируем структуру данных профессий если нужно
    if (!bankData.professions) {
        bankData.professions = {};
    }
    
    // Получаем текущие данные или создаем новые
    const currentData = bankData.professions[key] || {
        profession: 'Предприниматель',
        income: 10000,
        expenses: 6200,
        cashflow: 3800,
        liabilities: {
            taxes: 1300,
            other: 1500,
            carLoan: { payment: 700, principal: 14000 },
            educationLoan: { payment: 500, principal: 10000 },
            mortgage: { payment: 1200, principal: 240000 },
            creditCards: { payment: 1000, principal: 20000 }
        },
        totalLiabilities: 284000
    };
    
    // Обновляем данные
    const updatedData = { ...currentData, ...updates };
    
    // Пересчитываем денежный поток
    updatedData.cashflow = updatedData.income - updatedData.expenses;
    
    // Пересчитываем общий долг
    if (updatedData.liabilities) {
        updatedData.totalLiabilities = 
            updatedData.liabilities.carLoan?.principal || 0 +
            updatedData.liabilities.educationLoan?.principal || 0 +
            updatedData.liabilities.mortgage?.principal || 0 +
            updatedData.liabilities.creditCards?.principal || 0;
    }
    
    // Сохраняем обновленные данные
    bankData.professions[key] = updatedData;
    
    // Отправляем push-событие всем участникам комнаты
    io.to(roomId).emit('professionUpdate', {
        type: 'professionChanged',
        userId,
        roomId,
        professionData: updatedData,
        timestamp: new Date()
    });
    
    res.json({ 
        success: true, 
        message: 'Данные профессии обновлены',
        professionData: updatedData
    });
});

// API для получения карточек сделок
app.get('/api/cards', (req, res) => {
    try {
        res.json({
            success: true,
            marketCards: MARKET_CARDS,
            expenseCards: EXPENSE_CARDS,
            smallDeals: SMALL_DEALS,
            bigDeals: BIG_DEALS,
            stats: CardsUtils.getCardsStatistics()
        });
    } catch (error) {
        console.error('Ошибка получения карточек:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения карточек сделок'
        });
    }
});

// API для получения карт рынка
app.get('/api/cards/market', (req, res) => {
    try {
        res.json({
            success: true,
            cards: MARKET_CARDS,
            count: MARKET_CARDS.length
        });
    } catch (error) {
        console.error('Ошибка получения карт рынка:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения карт рынка'
        });
    }
});

// API для получения карт расходов
app.get('/api/cards/expense', (req, res) => {
    try {
        res.json({
            success: true,
            cards: EXPENSE_CARDS,
            count: EXPENSE_CARDS.length
        });
    } catch (error) {
        console.error('Ошибка получения карт расходов:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения карт расходов'
        });
    }
});

// API для получения малых сделок
app.get('/api/cards/small-deals', (req, res) => {
    try {
        res.json({
            success: true,
            cards: SMALL_DEALS,
            count: SMALL_DEALS.length
        });
    } catch (error) {
        console.error('Ошибка получения малых сделок:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения малых сделок'
        });
    }
});

// API для получения больших сделок
app.get('/api/cards/big-deals', (req, res) => {
    try {
        res.json({
            success: true,
            cards: BIG_DEALS,
            count: BIG_DEALS.length
        });
    } catch (error) {
        console.error('Ошибка получения больших сделок:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения больших сделок'
        });
    }
});

// Маршрут для тестовой страницы
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-board.html'));
});

// Маршрут для документации
app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'README.md'));
});

// API маршруты для комнат (для LobbyModule)
app.get('/api/rooms', (req, res) => {
    try {
        res.json({
            success: true,
            rooms: serverRooms.map(room => sanitizeRoom(room))
        });
    } catch (error) {
        console.error('Ошибка получения списка комнат:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/rooms', (req, res) => {
    try {
        const { name, max_players, turn_time, assign_professions, password, profession } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, error: 'Название комнаты обязательно' });
        }

        // Получаем пользователя из заголовков
        const userEmail = req.headers['x-user-name'] || 'guest@example.com';
        const user = userManager.getUserByEmail(userEmail) || userManager.registerUser({
            email: userEmail,
            username: userEmail.split('@')[0]
        });

        const newRoom = {
            id: Date.now().toString(),
            name,
            maxPlayers: max_players || 4,
            turnTime: turn_time || 3,
            players: [],
            status: 'waiting',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            assignProfessions: Boolean(assign_professions),
            password: password || null,
            defaultProfession: profession || 'entrepreneur',
            creatorId: user.id,
            creatorEmail: user.email
        };
        
        serverRooms.push(newRoom);
        
        console.log(`🏠 Комната "${name}" создана пользователем ${user.username} (${user.id})`);

        res.json({
            success: true,
            room: sanitizeRoom(newRoom, { requestingUserId: user.id })
        });
    } catch (error) {
        console.error('Ошибка создания комнаты:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/rooms/:roomId/join', (req, res) => {
    try {
        const { roomId } = req.params;
        const { password } = req.body;
        
        const room = serverRooms.find(r => r.id === roomId);
        if (!room) {
            return res.status(404).json({ success: false, error: 'Комната не найдена' });
        }
        
        if (room.players.length >= room.maxPlayers) {
            return res.status(400).json({ success: false, error: 'Комната заполнена' });
        }
        
        // Проверка пароля (если требуется)
        if (room.password && room.password !== password) {
            return res.status(401).json({ success: false, error: 'Неверный пароль' });
        }
        
        // Получаем пользователя из заголовков
        const userEmail = req.headers['x-user-name'] || 'guest@example.com';
        const user = userManager.getUserByEmail(userEmail) || userManager.registerUser({
            email: userEmail,
            username: userEmail.split('@')[0]
        });
        
        // Проверяем, не находится ли пользователь уже в комнате
        const existingPlayer = room.players.find(p => getPlayerIdentifier(p) === user.id);
        if (existingPlayer) {
            existingPlayer.socketId = existingPlayer.socketId || null;
            existingPlayer.isReady = Boolean(existingPlayer.isReady);
            existingPlayer.stats = existingPlayer.stats || DEFAULT_STATS();
            respondWithRoom(res, room, user.id);
            return;
        }
        
        // Добавляем игрока
        const newPlayer = createRoomPlayer({
            user,
            isHost: room.players.length === 0,
            professionId: room.defaultProfession || 'entrepreneur'
        });

        room.players.push(newPlayer);
        room.updatedAt = new Date().toISOString();

        if (room.gameState) {
            const turnOrder = new Set(room.gameState.turnOrder);
            turnOrder.add(newPlayer.userId);
            room.gameState.turnOrder = Array.from(turnOrder);
        }

        broadcastRoomsUpdate();

        respondWithRoom(res, room, user.id);
    } catch (error) {
        console.error('Ошибка присоединения к комнате:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/rooms/:roomId/leave', (req, res) => {
    try {
        const { roomId } = req.params;
        const userEmail = req.headers['x-user-name'] || 'guest@example.com';
        const user = userManager.getUserByEmail(userEmail);
        
        if (!user) {
            return res.status(400).json({ success: false, error: 'Пользователь не найден' });
        }
        
        const room = serverRooms.find(r => r.id === roomId);
        if (!room) {
            return res.status(404).json({ success: false, error: 'Комната не найдена' });
        }
        
        // Удаляем игрока из комнаты
        const playerIndex = room.players.findIndex(p => getPlayerIdentifier(p) === user.id);
        if (playerIndex === -1) {
            return res.status(400).json({ success: false, error: 'Вы не находитесь в этой комнате' });
        }
        
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        // Если это был хост и в комнате остались игроки, назначаем нового хоста
        if (player.isHost && room.players.length > 0) {
            room.players[0].isHost = true;
        }

        // Если комната пустая, удаляем её
        if (room.players.length === 0) {
            serverRooms.splice(serverRooms.indexOf(room), 1);
        }
        
        room.updatedAt = new Date().toISOString();

        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка выхода из комнаты:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/rooms/:roomId', (req, res) => {
    try {
        const { roomId } = req.params;
        const room = requireServerRoom(roomId);
        const requestingUserId = getRequestUserId(req);
        res.json({
            success: true,
            room: sanitizeRoom(room, { requestingUserId })
        });
    } catch (error) {
        console.error('Ошибка получения комнаты:', error);
        sendRoomError(res, error);
    }
});

app.post('/api/rooms/:roomId/dream', (req, res) => {
    try {
        const { roomId } = req.params;
        const room = requireServerRoom(roomId);
        const userId = getRequestUserId(req);
        const player = requireRoomPlayer(room, userId);

        const dreamId = req.body?.dream_id || req.body?.dreamId;
        if (!dreamId) {
            throw Object.assign(new Error('Не указана мечта'), { status: 400 });
        }

        player.selectedDream = dreamId;
        player.isReady = false;
        room.updatedAt = new Date().toISOString();

        broadcastRoomsUpdate();
        respondWithRoom(res, room, userId);
    } catch (error) {
        console.error('Ошибка выбора мечты:', error);
        sendRoomError(res, error);
    }
});

app.post('/api/rooms/:roomId/token', (req, res) => {
    try {
        const { roomId } = req.params;
        const room = requireServerRoom(roomId);
        const userId = getRequestUserId(req);
        const player = requireRoomPlayer(room, userId);

        const tokenId = req.body?.token_id || req.body?.tokenId;
        if (!tokenId) {
            throw Object.assign(new Error('Не указана фишка'), { status: 400 });
        }

        const takenByOther = room.players.some(
            p => p.selectedToken === tokenId && getPlayerIdentifier(p) !== userId
        );
        if (takenByOther) {
            throw Object.assign(new Error('Эта фишка уже выбрана другим игроком'), { status: 409 });
        }

        player.selectedToken = tokenId;
        player.isReady = false;
        room.updatedAt = new Date().toISOString();

        broadcastRoomsUpdate();
        respondWithRoom(res, room, userId);
    } catch (error) {
        console.error('Ошибка выбора фишки:', error);
        sendRoomError(res, error);
    }
});

app.post('/api/rooms/:roomId/ready', (req, res) => {
    try {
        const { roomId } = req.params;
        const room = requireServerRoom(roomId);
        const userId = getRequestUserId(req);
        const player = requireRoomPlayer(room, userId);

        if (!player.selectedDream || !player.selectedToken) {
            throw Object.assign(new Error('Выберите мечту и фишку перед готовностью'), { status: 400 });
        }

        player.isReady = !player.isReady;
        room.updatedAt = new Date().toISOString();

        broadcastRoomsUpdate();
        respondWithRoom(res, room, userId);
    } catch (error) {
        console.error('Ошибка изменения статуса готовности:', error);
        sendRoomError(res, error);
    }
});

app.post('/api/rooms/:roomId/start', (req, res) => {
    try {
        const { roomId } = req.params;
        const room = requireServerRoom(roomId);
        const userId = getRequestUserId(req);
        const player = requireRoomPlayer(room, userId);

        if (!player.isHost) {
            throw Object.assign(new Error('Только создатель комнаты может начать игру'), { status: 403 });
        }

        const readyPlayers = room.players.filter(p => p.isReady);
        if (readyPlayers.length < 2) {
            throw Object.assign(new Error('Для старта требуется минимум два готовых игрока'), { status: 400 });
        }

        room.status = 'playing';
        room.startedAt = new Date().toISOString();
        room.updatedAt = new Date().toISOString();
        ensureGameState(room);

        broadcastRoomsUpdate();
        respondWithRoom(res, room, userId);
    } catch (error) {
        console.error('Ошибка запуска игры:', error);
        sendRoomError(res, error);
    }
});

app.get('/api/rooms/:roomId/game-state', (req, res) => {
    try {
        const { roomId } = req.params;
        const room = requireServerRoom(roomId);
        const userId = getRequestUserId(req);
        const gameState = buildGameState(room, userId);
        res.json({ success: true, state: gameState });
    } catch (error) {
        console.error('Ошибка получения состояния игры:', error);
        sendRoomError(res, error);
    }
});

app.post('/api/rooms/:roomId/roll', (req, res) => {
    try {
        const { roomId } = req.params;
        const room = requireServerRoom(roomId);
        const userId = getRequestUserId(req);
        const player = requireRoomPlayer(room, userId);

        ensureGameState(room);
        const activePlayer = getActivePlayer(room);
        if (!activePlayer || getPlayerIdentifier(activePlayer) !== userId) {
            throw Object.assign(new Error('Сейчас не ваш ход'), { status: 403 });
        }

        const phase = room.gameState.phase || 'awaiting_roll';
        if (phase !== 'awaiting_roll') {
            throw Object.assign(new Error('Бросок кубиков сейчас недоступен'), { status: 400 });
        }

        const roll = rollDiceValues();
        const move = movePlayer(room, player, roll);

        room.gameState.lastRoll = {
            playerId: player.userId,
            values: roll.values,
            total: roll.total,
            cell: move.cell
        };
        room.gameState.phase = 'awaiting_end';
        room.gameState.history.push({
            type: 'roll',
            playerId: player.userId,
            values: roll.values,
            total: roll.total,
            timestamp: Date.now()
        });

        player.stats.turnsTaken = player.stats.turnsTaken || 0;

        broadcastRoomsUpdate();

        res.json({
            success: true,
            roll,
            move,
            state: buildGameState(room, userId)
        });
    } catch (error) {
        console.error('Ошибка броска кубиков:', error);
        sendRoomError(res, error);
    }
});

app.post('/api/rooms/:roomId/end-turn', (req, res) => {
    try {
        const { roomId } = req.params;
        const room = requireServerRoom(roomId);
        const userId = getRequestUserId(req);
        const player = requireRoomPlayer(room, userId);

        ensureGameState(room);
        const activePlayer = getActivePlayer(room);
        if (!activePlayer || getPlayerIdentifier(activePlayer) !== userId) {
            throw Object.assign(new Error('Сейчас не ваш ход'), { status: 403 });
        }

        if (!(room.gameState.phase === 'awaiting_end' || room.gameState.phase === 'awaiting_roll')) {
            throw Object.assign(new Error('Невозможно завершить ход сейчас'), { status: 400 });
        }

        player.stats.turnsTaken = (player.stats.turnsTaken || 0) + 1;

        advanceTurn(room);
        broadcastRoomsUpdate();

        res.json({ success: true, state: buildGameState(room, userId) });
    } catch (error) {
        console.error('Ошибка завершения хода:', error);
        sendRoomError(res, error);
    }
});

// API маршруты для пользователя
app.get('/api/user/profile', (req, res) => {
    try {
        const userEmail = req.headers['x-user-name'] || 'guest@example.com';
        const user = userManager.getUserByEmail(userEmail) || userManager.registerUser({
            email: userEmail,
            username: userEmail.split('@')[0]
        });
        
        // Добавляем игровые данные
        const profile = {
            id: user.id,
            username: user.username,
            first_name: user.first_name,
            email: user.email,
            balance: 10000, // Можно добавить в userManager
            registeredAt: user.registeredAt,
            lastSeen: user.lastSeen,
            isOnline: user.isOnline,
            connections: user.socketConnections.size
        };
        
        res.json(profile);
    } catch (error) {
        console.error('Ошибка получения профиля пользователя:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/user/stats', (req, res) => {
    try {
        const userEmail = req.headers['x-user-name'] || 'guest@example.com';
        const user = userManager.getUserByEmail(userEmail);
        
        // Генерируем статистику на основе ID пользователя для стабильности
        const userHash = user ? parseInt(user.id.replace('user_', ''), 36) : Math.random() * 1000000;
        
        const stats = {
            gamesPlayed: Math.floor((userHash % 100) + 1),
            wins: Math.floor((userHash % 50) + 1),
            level: Math.floor((userHash % 20) + 1),
            totalUsers: userManager.getUserCount(),
            onlineUsers: userManager.getOnlineUserCount(),
            userId: user ? user.id : 'guest'
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Ошибка получения статистики пользователя:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Обработка 404
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'Страница не найдена',
        requested: req.originalUrl,
        availableRoutes: [
            '/',
            '/auth',
            '/lobby', 
            '/game',
            '/lobby-module',
            '/test-routes',
            '/test',
            '/docs',
            '/api/health',
            '/api/rooms',
            '/api/user/profile'
        ]
    });
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'Произошла внутренняя ошибка сервера'
    });
});

// Серверное хранилище комнат и пользователей
let serverRooms = [];
let connectedUsers = new Map();

// WebSocket подключения
io.on('connection', (socket) => {
    console.log('👤 Пользователь подключился:', socket.id);
    console.log('🔌 Transport:', socket.conn.transport.name);
    console.log('🌐 Origin:', socket.handshake.headers.origin);
    
    // Обработка ошибок подключения
    socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error);
    });
    
    socket.on('disconnect', (reason) => {
        console.log('👋 Пользователь отключился:', socket.id, 'Причина:', reason);
    });
    
                // Регистрация пользователя
                socket.on('registerUser', (userData) => {
                    try {
                        // Если нет данных пользователя, создаем гостевого пользователя
                        if (!userData || !userData.email) {
                            userData = {
                                email: `guest_${Date.now()}@example.com`,
                                username: 'Гость',
                                first_name: 'Гость'
                            };
                        }
                        
                        // Валидируем данные пользователя
                        const validatedData = userManager.validateUserData(userData);
                        
                        // Регистрируем пользователя с единым ID
                        const user = userManager.registerUser(validatedData);
                        
                        // Добавляем WebSocket соединение
                        userManager.addSocketConnection(user.id, socket.id);
                        
                        // Сохраняем связь socket.id -> user.id
                        connectedUsers.set(socket.id, user);
                        
                        console.log('👤 Пользователь подключился:', user.username, 'ID:', user.id, 'Socket:', socket.id);
                        console.log('📊 Статистика:', userManager.getStats());
                        
                        // Отправляем обновленный список комнат
                        socket.emit('roomsUpdate', serverRooms.map(room => sanitizeRoom(room, { requestingUserId: user.id })));
                        
                    } catch (error) {
                        console.error('❌ Ошибка регистрации пользователя:', error.message);
                        socket.emit('error', { message: error.message });
                    }
                });
    
    // Создание комнаты
    socket.on('createRoom', (roomData) => {
        const user = connectedUsers.get(socket.id);
        if (!user) {
            socket.emit('error', { message: 'Пользователь не зарегистрирован' });
            return;
        }
        
        const newRoom = {
            id: Date.now().toString(),
            name: roomData.name,
            maxPlayers: roomData.maxPlayers,
            turnTime: roomData.turnTime,
            players: [createRoomPlayer({ user, isHost: true, socketId: socket.id })],
            status: 'waiting',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            assignProfessions: Boolean(roomData.assignProfessions),
            defaultProfession: roomData.defaultProfession || roomData.profession || 'entrepreneur',
            creatorId: user.id,
            creatorEmail: user.email
        };

        serverRooms.push(newRoom);

        // Отправляем обновленный список всем пользователям
        broadcastRoomsUpdate();

        // Присоединяем создателя к комнате
        socket.join(newRoom.id);
        socket.emit('roomCreated', sanitizeRoom(newRoom, { requestingUserId: user.id }));

        console.log(`🏠 Создана комната ${newRoom.id} пользователем ${user.username}`);
    });
    
    // Присоединение к комнате
    socket.on('joinRoom', (roomId) => {
        const user = connectedUsers.get(socket.id);
        if (!user) {
            socket.emit('error', { message: 'Пользователь не зарегистрирован' });
            return;
        }
        
        const room = serverRooms.find(r => r.id === roomId);
        if (!room) {
            console.log(`❌ Комната ${roomId} не найдена. Доступные комнаты:`, serverRooms.map(r => r.id));
            socket.emit('error', { message: 'Комната не найдена' });
            return;
        }
        
        if (room.players.length >= room.maxPlayers) {
            socket.emit('error', { message: 'Комната заполнена' });
            return;
        }
        
        // Проверяем, не находится ли пользователь уже в этой комнате
        const existingPlayer = room.players.find(p => p.socketId === socket.id);
        if (existingPlayer) {
            socket.emit('error', { message: 'Вы уже в этой комнате' });
            return;
        }
        
        // Добавляем игрока в комнату
        room.players.push(createRoomPlayer({ user, isHost: false, socketId: socket.id }));
        room.updatedAt = new Date().toISOString();

        socket.join(roomId);

        // Отправляем обновленный список всем пользователям
        broadcastRoomsUpdate();

        // Отправляем обновление комнаты всем участникам
        io.to(roomId).emit('roomUpdate', sanitizeRoom(room));

        // Уведомляем пользователя об успешном присоединении
        socket.emit('roomJoined', sanitizeRoom(room, { requestingUserId: user.id }));
        
        console.log(`🏠 Пользователь ${user.username} присоединился к комнате ${roomId}`);
    });
    
    // Покидание комнаты
    socket.on('leaveRoom', (roomId) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;
        
        const room = serverRooms.find(r => r.id === roomId);
        if (!room) return;
        
        // Удаляем игрока из комнаты
        room.players = room.players.filter(p => p.socketId !== socket.id);

        // Если это был хост и в комнате остались игроки, назначаем нового хоста
        if (room.players.length > 0) {
            room.players[0].isHost = true;
        }

        // Если комната пустая, удаляем её
        if (room.players.length === 0) {
            serverRooms = serverRooms.filter(r => r.id !== roomId);
        }
        
        room.updatedAt = new Date().toISOString();

        socket.leave(roomId);

        // Отправляем обновления
        broadcastRoomsUpdate();
        if (room.players.length > 0) {
            io.to(roomId).emit('roomUpdate', sanitizeRoom(room));
        }

        console.log(`🚪 Пользователь ${user.username} покинул комнату ${roomId}`);
    });
    
    // Выбор фишки
    socket.on('selectToken', (data) => {
        const { roomId, tokenId } = data;
        const user = connectedUsers.get(socket.id);
        if (!user) return;
        
        const room = serverRooms.find(r => r.id === roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;
        
        // Проверяем, не выбрана ли уже эта фишка другим игроком
        const tokenInUse = room.players.some(p => p.selectedToken === tokenId && p.socketId !== socket.id);
        if (tokenInUse) {
            socket.emit('error', { message: 'Эта фишка уже выбрана другим игроком' });
            return;
        }
        
        // Присваиваем фишку игроку
        player.selectedToken = tokenId;
        room.updatedAt = new Date().toISOString();

        // Отправляем обновление комнаты всем участникам
        io.to(roomId).emit('roomUpdate', sanitizeRoom(room));

        console.log(`🎯 Игрок ${user.username} выбрал фишку ${tokenId} в комнате ${roomId}`);
    });
    
    // Выбор мечты
    socket.on('selectDream', (data) => {
        const { roomId, dreamId } = data;
        const user = connectedUsers.get(socket.id);
        if (!user) return;
        
        const room = serverRooms.find(r => r.id === roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;
        
        // Присваиваем мечту игроку
        player.selectedDream = dreamId;
        room.updatedAt = new Date().toISOString();

        // Отправляем обновление комнаты всем участникам
        io.to(roomId).emit('roomUpdate', sanitizeRoom(room));

        console.log(`🌟 Игрок ${user.username} выбрал мечту ${dreamId} в комнате ${roomId}`);
    });
    
    // Отключение от комнаты
    socket.on('leaveRoom', (roomId) => {
        socket.leave(roomId);
        console.log(`🚪 Пользователь ${socket.id} покинул комнату ${roomId}`);
    });
    
    // Отключение
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            console.log('👋 Пользователь отключился:', user.username, 'ID:', user.id, 'Socket:', socket.id);
            
            // Удаляем WebSocket соединение
            userManager.removeSocketConnection(user.id, socket.id);
            
            // Удаляем пользователя из всех комнат
            serverRooms.forEach(room => {
                const playerIndex = room.players.findIndex(p => getPlayerIdentifier(p) === user.id);
                if (playerIndex !== -1) {
                    const player = room.players[playerIndex];
                    room.players.splice(playerIndex, 1);
                    
                    // Если это был хост и в комнате остались игроки, назначаем нового хоста
                    if (player.isHost && room.players.length > 0) {
                        room.players[0].isHost = true;
                    }
                    
                    // Если комната пустая, удаляем её
                    if (room.players.length === 0) {
                        serverRooms = serverRooms.filter(r => r.id !== room.id);
                    } else {
                        room.updatedAt = new Date().toISOString();
                        // Отправляем обновление комнаты оставшимся участникам
                        io.to(room.id).emit('roomUpdate', sanitizeRoom(room));
                    }
                }
            });
            
            // Отправляем обновленный список комнат всем пользователям
            broadcastRoomsUpdate();
            
            // Удаляем пользователя из списка подключенных
            connectedUsers.delete(socket.id);
            
            console.log('📊 Статистика после отключения:', userManager.getStats());
        } else {
            console.log('👋 Неизвестный пользователь отключился:', socket.id);
        }
    });
});

// Запуск сервера
async function startServer() {
    try {
        // Initialize database first
        await initializeDatabase();
        
        // Start server
        server.listen(PORT, () => {
            console.log('🎮 Game Board v2.8 Server запущен!');
            console.log(`🚀 Сервер работает на порту ${PORT}`);
            console.log(`📱 Локальный адрес: http://localhost:${PORT}`);
            console.log(`🌐 Railway адрес: https://your-app.railway.app`);
            console.log('✅ Готов к обслуживанию файлов');
            console.log('🔌 WebSocket сервер активен');
            
            // Display database status
            const dbStatus = getConnectionStatus();
            if (dbStatus.isConnected) {
                console.log(`📊 База данных подключена: ${dbStatus.name}@${dbStatus.host}`);
            } else {
                console.log('⚠️  База данных недоступна - используется локальное хранилище');
            }
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Получен сигнал SIGTERM, завершение работы...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Получен сигнал SIGINT, завершение работы...');
    process.exit(0);
});
