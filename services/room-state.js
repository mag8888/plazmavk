const crypto = require('crypto');

const STARTING_BALANCE = 10000;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

const rooms = new Map();
const creditRooms = new Map();
const users = new Map(); // Хранилище пользователей в памяти

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const generateId = (prefix = 'id') => {
    if (crypto.randomUUID) {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const DREAMS = [
    { id: 1, name: 'Дом мечты', cost: 100000, icon: '🏠' },
    { id: 2, name: 'Путешествие мечты', cost: 150000, icon: '✈️' },
    { id: 3, name: 'Белоснежная яхта', cost: 300000, icon: '⛵' },
    { id: 4, name: 'Полет в космос', cost: 250000, icon: '🚀' }
];

const TOKENS = [
    { id: 'lion', icon: '🦁', name: 'Лев' },
    { id: 'tiger', icon: '🐯', name: 'Тигр' },
    { id: 'fox', icon: '🦊', name: 'Лиса' },
    { id: 'panda', icon: '🐼', name: 'Панда' },
    { id: 'frog', icon: '🐸', name: 'Лягушка' },
    { id: 'owl', icon: '🦉', name: 'Сова' },
    { id: 'octopus', icon: '🐙', name: 'Осьминог' },
    { id: 'whale', icon: '🐳', name: 'Кит' }
];

const SMALL_DEAL_CARDS = [
    { id: 'small_001', name: 'Акции компании', amount: 5000, income: 500, type: 'stock' },
    { id: 'small_002', name: 'Облигации', amount: 3000, income: 250, type: 'bond' },
    { id: 'small_003', name: 'Франшиза кофе-точки', amount: 8000, income: 900, type: 'business' },
    { id: 'small_004', name: 'Мини-склад', amount: 7500, income: 850, type: 'real_estate' }
];

const BIG_DEAL_CARDS = [
    { id: 'big_001', name: 'Жилой комплекс', amount: 45000, income: 5200, type: 'real_estate' },
    { id: 'big_002', name: 'Частная клиника', amount: 60000, income: 6500, type: 'business' },
    { id: 'big_003', name: 'IT-стартап', amount: 80000, income: 9000, type: 'business' },
    { id: 'big_004', name: 'Пакет акций корпорации', amount: 55000, income: 5000, type: 'stock' }
];

const EXPENSE_CARDS = [
    { id: 'exp_001', name: 'Налоги', amount: 2000, type: 'tax' },
    { id: 'exp_002', name: 'Медицинские расходы', amount: 1500, type: 'medical' },
    { id: 'exp_003', name: 'Ремонт дома', amount: 2500, type: 'repair' },
    { id: 'exp_004', name: 'Образование детей', amount: 3000, type: 'education' }
];

const shuffle = (array) => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

const createDeck = (cards) => ({
    cards: shuffle(cards.map(card => ({ ...card }))),
    original: cards.map(card => ({ ...card })),
    discard: []
});

const drawCard = (deck) => {
    if (!deck.cards.length) {
        deck.cards = shuffle(deck.original.map(card => ({ ...card })));
        deck.discard = [];
    }
    const card = deck.cards.shift();
    return card || null;
};

const drawFromDeck = (deck) => drawCard(deck);

const returnCardToDeck = (deck, card) => {
    if (!card) return;
    deck.discard.push({ ...card });
};

const createPlayerStats = () => ({
    turnsTaken: 0,
    diceRolled: 0,
    dealsBought: 0,
    dealsSkipped: 0,
    dealsTransferred: 0,
    assetsSold: 0,
    incomeReceived: 0,
    expensesPaid: 0
});

const createPlayer = ({ userId, name, avatar, isHost = false }) => ({
    userId: userId.toString(),
    name: name || 'Игрок',
    avatar: avatar || null,
    joinedAt: new Date().toISOString(),
    isHost,
    isReady: false,
    selectedDream: null,
    selectedToken: null,
    dreamAchieved: false,
    position: 0,
    track: 'small',
    cash: STARTING_BALANCE,
    passiveIncome: 0,
    assets: [],
    stats: createPlayerStats(),
    // Добавляем профессию по умолчанию
    profession: {
        id: 'entrepreneur',
        name: 'Предприниматель',
        description: 'Владелец бизнеса',
        salary: 10000,
        expenses: 6200,
        cashFlow: 3800,
        color: '#00ff96',
        icon: '🚀'
    },
    professionId: 'entrepreneur',
    children: 0
});

const sanitizePlayer = (player) => ({
    userId: player.userId,
    name: player.name,
    avatar: player.avatar,
    isHost: player.isHost,
    isReady: player.isReady,
    selectedDream: player.selectedDream,
    selectedToken: player.selectedToken,
    dreamAchieved: player.dreamAchieved,
    position: player.position,
    track: player.track,
    cash: player.cash,
    passiveIncome: player.passiveIncome,
    assets: player.assets,
    stats: player.stats,
    profession: player.profession,
    professionId: player.professionId,
    children: player.children || 0
});

const sanitizeRoom = (room, { includePlayers = false, userId = null } = {}) => {
    const readyPlayers = room.players.filter(player => player.isReady).length;
    const sanitized = {
        id: room.id,
        name: room.name,
        creatorId: room.creatorId,
        creatorName: room.creatorName,
        maxPlayers: room.maxPlayers,
        turnTime: room.turnTime,
        assignProfessions: room.assignProfessions,
        gameStarted: room.gameStarted,
        status: room.status,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        playersCount: room.players.length,
        readyCount: readyPlayers,
        canStart: room.players.length >= MIN_PLAYERS && readyPlayers >= MIN_PLAYERS,
        availableTokens: TOKENS.map(token => ({
            ...token,
            taken: room.players.some(player => player.selectedToken === token.id)
        })),
        availableDreams: DREAMS
    };

    if (includePlayers) {
        sanitized.players = room.players.map(player => sanitizePlayer(player));
    }

    if (userId) {
        sanitized.currentPlayer = room.players.find(player => player.userId === userId.toString()) || null;
    }

    return sanitized;
};

const createRoomInstance = ({
    id = generateId('room'),
    name,
    creator = {},
    maxPlayers = 4,
    turnTime = 3,
    assignProfessions = false,
    register = true
} = {}) => {
    const room = {
        id,
        name: name || `Комната ${id.slice(-4)}`,
        creatorId: creator.id ? creator.id.toString() : null,
        creatorName: creator.name || 'Создатель',
        creatorAvatar: creator.avatar || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        maxPlayers: clamp(Number(maxPlayers) || 4, MIN_PLAYERS, MAX_PLAYERS),
        minPlayers: MIN_PLAYERS,
        turnTime: clamp(Number(turnTime) || 3, 1, 20),
        assignProfessions: Boolean(assignProfessions),
        gameStarted: false,
        status: 'waiting',
        players: [],
        tokens: {
            available: TOKENS.map(token => ({ ...token })),
            assigned: {}
        },
        dreams: DREAMS.map(dream => ({ ...dream })),
        gameState: null,
        lastActivity: Date.now(),
        game_data: {
            player_balances: [],
            credit_data: {
                player_credits: [],
                credit_history: []
            },
            transfers_history: []
        }
    };
    if (register) {
        rooms.set(id, room);
    }
    return room;
};

const getRoomById = (roomId) => rooms.get(roomId);

const listRooms = () => Array.from(rooms.values());

const addPlayerToRoom = (room, { userId, name, avatar, isHost = false, isReady = false, selectedDream = null, selectedToken = null, position, track, cash, passiveIncome }) => {
    if (!room || !userId) {
        throw new Error('room and userId are required');
    }

    console.log(`🔍 addPlayerToRoom: добавляем игрока ${name} (${userId}), isHost: ${isHost}, isReady: ${isReady}`);

    const existingPlayer = room.players.find(player => player.userId === userId.toString());
    if (existingPlayer) {
        console.log(`🔄 addPlayerToRoom: обновляем существующего игрока ${existingPlayer.name}, старый isHost: ${existingPlayer.isHost}, новый isHost: ${isHost}`);
        existingPlayer.name = name || existingPlayer.name;
        existingPlayer.avatar = avatar || existingPlayer.avatar;
        existingPlayer.isHost = isHost !== undefined ? isHost : existingPlayer.isHost;
        existingPlayer.isReady = isReady !== undefined ? isReady : existingPlayer.isReady;
        existingPlayer.selectedDream = selectedDream !== undefined ? selectedDream : existingPlayer.selectedDream;
        existingPlayer.selectedToken = selectedToken !== undefined ? selectedToken : existingPlayer.selectedToken;
        if (position !== undefined) existingPlayer.position = Number(position) || 0;
        if (track !== undefined) existingPlayer.track = String(track);
        if (cash !== undefined) existingPlayer.cash = Math.floor(Number(cash) || existingPlayer.cash);
        if (passiveIncome !== undefined) existingPlayer.passiveIncome = Math.floor(Number(passiveIncome) || 0);
        console.log(`✅ addPlayerToRoom: игрок обновлен, isHost: ${existingPlayer.isHost}, isReady: ${existingPlayer.isReady}`);
        return existingPlayer;
    }

    if (room.players.length >= room.maxPlayers) {
        throw new Error('Комната заполнена');
    }

    console.log(`🔧 addPlayerToRoom: создание игрока с isHost=${isHost}, userId=${userId}, name=${name}`);
    const newPlayer = createPlayer({ userId, name, avatar });
    newPlayer.isHost = isHost;
    newPlayer.isReady = isReady;
    newPlayer.selectedDream = selectedDream;
    newPlayer.selectedToken = selectedToken;
    if (position !== undefined) newPlayer.position = Number(position) || 0;
    if (track !== undefined) newPlayer.track = String(track);
    if (cash !== undefined) newPlayer.cash = Math.floor(Number(cash) || newPlayer.cash);
    if (passiveIncome !== undefined) newPlayer.passiveIncome = Math.floor(Number(passiveIncome) || 0);
    console.log(`🔧 addPlayerToRoom: игрок создан, isHost=${newPlayer.isHost}, userId=${newPlayer.userId}`);
    room.players.push(newPlayer);
    room.game_data.player_balances.push(newPlayer.cash);
    room.game_data.credit_data.player_credits.push(0);
    room.updatedAt = new Date().toISOString();
    
    console.log(`✅ addPlayerToRoom: новый игрок ${newPlayer.name} создан, isHost: ${newPlayer.isHost}, isReady: ${newPlayer.isReady}, selectedDream: ${newPlayer.selectedDream}, selectedToken: ${newPlayer.selectedToken}`);
    room.lastActivity = Date.now();
    return newPlayer;
};

const removePlayerFromRoom = (room, userId) => {
    if (!room) return;
    const index = room.players.findIndex(player => player.userId === userId.toString());
    if (index === -1) return;

    const [removed] = room.players.splice(index, 1);
    room.game_data.player_balances.splice(index, 1);
    room.game_data.credit_data.player_credits.splice(index, 1);

    if (removed && removed.selectedToken) {
        delete room.tokens.assigned[removed.selectedToken];
    }

    if (room.players.length === 0) {
        rooms.delete(room.id);
        return;
    }

    if (removed.isHost) {
        room.players[0].isHost = true;
        room.creatorId = room.players[0].userId;
        room.creatorName = room.players[0].name;
    }

    room.updatedAt = new Date().toISOString();
    room.lastActivity = Date.now();
};

const toggleReadyStatus = (room, userId) => {
    const player = room.players.find(p => p.userId === userId.toString());
    if (!player) {
        throw new Error('Игрок не найден в комнате');
    }
    if (!player.selectedDream) {
        throw new Error('Сначала выберите мечту');
    }

    player.isReady = !player.isReady;
    room.updatedAt = new Date().toISOString();
    room.lastActivity = Date.now();
    return player.isReady;
};

const assignDreamToPlayer = (room, userId, dreamId) => {
    const player = room.players.find(p => p.userId === userId.toString());
    if (!player) {
        throw new Error('Игрок не найден в комнате');
    }
    const dream = DREAMS.find(d => d.id == dreamId);
    if (!dream) {
        throw new Error('Мечта не найдена');
    }
    player.selectedDream = dream.id;
    player.dreamAchieved = false;
    room.updatedAt = new Date().toISOString();
    room.lastActivity = Date.now();
};

const assignTokenToPlayer = (room, userId, tokenId) => {
    const player = room.players.find(p => p.userId === userId.toString());
    if (!player) {
        throw new Error('Игрок не найден в комнате');
    }
    const token = TOKENS.find(t => t.id === tokenId);
    if (!token) {
        throw new Error('Фишка не найдена');
    }
    if (room.players.some(p => p.selectedToken === tokenId && p.userId !== userId.toString())) {
        throw new Error('Эта фишка уже занята');
    }
    player.selectedToken = tokenId;
    room.tokens.assigned[tokenId] = userId.toString();
    room.updatedAt = new Date().toISOString();
    room.lastActivity = Date.now();
};

const syncCreditData = (room) => {
    if (!room || !room.game_data) return;
    room.players.forEach((player, index) => {
        room.game_data.player_balances[index] = player.cash;
        if (room.game_data.credit_data.player_credits[index] === undefined) {
            room.game_data.credit_data.player_credits[index] = 0;
        }
    });
};

const ensureCreditRoom = (roomId, playerIndex = 0, playerName) => {
    let room = creditRooms.get(roomId);
    if (!room) {
        room = {
            id: roomId,
            createdAt: new Date().toISOString(),
            players: [],
            game_data: {
                player_balances: [],
                credit_data: {
                    player_credits: [],
                    credit_history: []
                },
                transfers_history: []
            }
        };
        creditRooms.set(roomId, room);
    }

    while (room.players.length <= playerIndex) {
        const index = room.players.length;
        room.players.push({
            name: playerName || `Player ${index + 1}`
        });
    }

    while (room.game_data.player_balances.length <= playerIndex) {
        room.game_data.player_balances.push(0);
    }

    while (room.game_data.credit_data.player_credits.length <= playerIndex) {
        room.game_data.credit_data.player_credits.push(0);
    }

    return room;
};

const setPhase = (room, phase) => {
    if (!room.gameState) return;
    room.gameState.phase = phase;
};

const requireRoom = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
        const error = new Error('Комната не найдена');
        error.code = 'ROOM_NOT_FOUND';
        throw error;
    }
    return room;
};

const initializeGame = (room) => {
    const readyPlayers = room.players.filter(player => player.isReady);
    if (readyPlayers.length < MIN_PLAYERS) {
        throw new Error('Недостаточно готовых игроков для начала игры');
    }

    if (readyPlayers.some(player => !player.selectedDream || !player.selectedToken)) {
        throw new Error('Все готовые игроки должны выбрать мечту и фишку');
    }

    // Назначаем одинаковую профессию всем игрокам
    const defaultProfession = {
        id: 'entrepreneur',
        name: 'Предприниматель',
        description: 'Владелец бизнеса',
        salary: 10000,
        expenses: 6200,
        cashFlow: 3800,
        color: '#00ff96',
        icon: '🚀'
    };

    room.players.forEach(player => {
        player.isReady = true;
        player.position = 0;
        // Все начинают с малого круга
        player.track = 'small';
        player.cash = STARTING_BALANCE;
        player.passiveIncome = 0;
        player.assets = [];
        player.stats = createPlayerStats();
        player.dreamAchieved = false;
        // Назначаем одинаковую профессию всем игрокам
        player.profession = defaultProfession;
        player.professionId = 'entrepreneur';
    });

    // Создаем рандомный порядок ходов
    const shuffledTurnOrder = shuffle(readyPlayers.map(player => player.userId.toString()));
    
    // Назначаем нового хоста - первый игрок в рандомном порядке
    const newHostId = shuffledTurnOrder[0];
    
    // Обновляем статус хоста у всех игроков
    room.players.forEach(player => {
        player.isHost = (player.userId.toString() === newHostId);
    });
    
    // Обновляем информацию о создателе комнаты
    const newHost = room.players.find(p => p.userId.toString() === newHostId);
    if (newHost) {
        room.creatorId = newHost.userId;
        room.creatorName = newHost.name;
    }

    room.gameState = {
        startedAt: Date.now(),
        activePlayerIndex: 0,
        turnOrder: shuffledTurnOrder,
        phase: 'awaiting_roll',
        lastRoll: null,
        pendingDeal: null,
        decks: {
            small: createDeck(SMALL_DEAL_CARDS),
            big: createDeck(BIG_DEAL_CARDS),
            expense: createDeck(EXPENSE_CARDS)
        },
        history: []
    };

    room.gameStarted = true;
    room.status = 'playing';
    room.updatedAt = new Date().toISOString();
    room.lastActivity = Date.now();
    syncCreditData(room);
};

const getActivePlayer = (room) => {
    if (!room.gameState || !room.gameState.turnOrder.length) return null;
    const activePlayerId = room.gameState.turnOrder[room.gameState.activePlayerIndex];
    return room.players.find(player => player.userId === activePlayerId) || null;
};

const serializeGameState = (room, requestingUserId = null) => {
    const activePlayer = getActivePlayer(room);
    return {
        roomId: room.id,
        name: room.name,
        gameStarted: room.gameStarted,
        phase: room.gameState?.phase || 'awaiting_roll',
        activePlayerId: activePlayer?.userId || null,
        turnOrder: room.gameState?.turnOrder || [],
        lastRoll: room.gameState?.lastRoll || null,
        pendingDeal: room.gameState?.pendingDeal || null,
        decks: {
            smallRemaining: room.gameState?.decks?.small?.cards.length || 0,
            bigRemaining: room.gameState?.decks?.big?.cards.length || 0,
            expenseRemaining: room.gameState?.decks?.expense?.cards.length || 0
        },
        players: room.players.map(player => ({
            ...sanitizePlayer(player),
            isActiveTurn: activePlayer ? player.userId === activePlayer.userId : false
        })),
        requestingPlayer: requestingUserId ? sanitizePlayer(
            room.players.find(player => player.userId === requestingUserId.toString()) || {}
        ) : null
    };
};

const getCellByIndex = (index, cells = []) => {
    if (!Array.isArray(cells) || cells.length === 0) {
        return null;
    }
    const normalized = ((index % cells.length) + cells.length) % cells.length;
    return cells[normalized];
};

const isDealCell = (cell) => cell && (cell.type === 'business' || cell.type === 'opportunity');
const isExpenseCell = (cell) => cell && (cell.type === 'loss' || cell.type === 'expense');
const isIncomeCell = (cell) => cell && (cell.type === 'money');

const logGameEvent = (room, event) => {
    if (!room.gameState) return;
    room.gameState.history.push({ ...event, timestamp: Date.now() });
    if (room.gameState.history.length > 200) {
        room.gameState.history.shift();
    }
};

const applyIncome = (player, amount) => {
    const income = Number(amount) || 0;
    if (!income) return 0;
    player.cash += income;
    player.stats.incomeReceived += income;
    return income;
};

const applyExpense = (player, amount) => {
    const expense = Number(amount) || 0;
    if (!expense) return 0;
    player.cash -= expense;
    player.stats.expensesPaid += expense;
    return expense;
};

const handleIncomeCell = (room, player, cell) => {
    const income = applyIncome(player, cell.amount || 0);
    setPhase(room, 'awaiting_end');
    logGameEvent(room, { type: 'income', playerId: player.userId, amount: income, cellId: cell.id });
    return { income };
};

const handleExpenseCell = (room, player, cell) => {
    const expense = applyExpense(player, cell.amount || 0);
    setPhase(room, 'awaiting_end');
    logGameEvent(room, { type: 'expense', playerId: player.userId, amount: expense, cellId: cell.id });
    return { expense };
};

const handleDealCell = (room, player, cell) => {
    room.gameState.pendingDeal = {
        playerId: player.userId,
        stage: 'size',
        cellId: cell.id
    };
    setPhase(room, 'awaiting_deal_choice');
    logGameEvent(room, { type: 'deal_offer', playerId: player.userId, cellId: cell.id });
    return { dealAvailable: true };
};

const movePlayer = (room, player, steps) => {
    const size = room.dreams?.length || DREAMS.length;
    player.position = (player.position + steps) % size;
    player.stats.diceRolled = (player.stats.diceRolled || 0) + 1;
};

const movePlayerAndResolve = (room, player, roll) => {
    movePlayer(room, player, roll);
    syncCreditData(room);
    const result = { roll, position: player.position };
    setPhase(room, 'awaiting_end');
    return result;
};

const rollDice = () => Math.floor(Math.random() * 6) + 1;

const drawDealCard = (room, size) => {
    const deck = size === 'small' ? room.gameState.decks.small : room.gameState.decks.big;
    if (!deck) {
        throw new Error('Колода сделок недоступна');
    }
    const card = drawFromDeck(deck);
    if (!card) {
        throw new Error('Карты в колоде закончились');
    }
    return card;
};

const chooseDeal = (room, player, size) => {
    if (!room.gameState || !room.gameState.pendingDeal || room.gameState.pendingDeal.playerId !== player.userId) {
        throw new Error('Нет ожидаемой сделки для игрока');
    }
    const normalizedSize = size === 'small' ? 'small' : 'big';
    const card = drawDealCard(room, normalizedSize);
    room.gameState.pendingDeal = {
        ...room.gameState.pendingDeal,
        stage: 'resolution',
        size: normalizedSize,
        card
    };
    setPhase(room, 'awaiting_deal_resolution');
    logGameEvent(room, { type: 'deal_drawn', playerId: player.userId, size: normalizedSize, cardId: card.id });
    return card;
};

const addAssetToPlayer = (player, card, size) => {
    const asset = {
        id: card.id,
        cardId: card.id,
        name: card.name,
        type: card.type,
        size,
        purchasePrice: card.amount || 0,
        monthlyIncome: card.income || 0,
        acquiredAt: Date.now()
    };
    player.assets.push(asset);
    player.stats.dealsBought += 1;
    player.stats.assetsOwned = player.assets.length;
    return asset;
};

const resolveDeal = (room, player, action) => {
    if (!room.gameState || !room.gameState.pendingDeal || room.gameState.pendingDeal.playerId !== player.userId) {
        throw new Error('Нет ожидаемой сделки для игрока');
    }
    const pending = room.gameState.pendingDeal;
    const deck = pending.size === 'small' ? room.gameState.decks.small : room.gameState.decks.big;
    if (action === 'buy') {
        const price = pending.card.amount || 0;
        if (player.cash < price) {
            throw new Error('Недостаточно средств для покупки');
        }
        applyExpense(player, price);
        const asset = addAssetToPlayer(player, pending.card, pending.size);
        setPhase(room, 'awaiting_end');
        room.gameState.pendingDeal = null;
        logGameEvent(room, { type: 'deal_purchase', playerId: player.userId, cardId: pending.card.id, price });
        syncCreditData(room);
        return { asset };
    }

    returnCardToDeck(deck, pending.card);
    player.stats.dealsSkipped += 1;
    room.gameState.pendingDeal = null;
    setPhase(room, 'awaiting_end');
    logGameEvent(room, { type: 'deal_skipped', playerId: player.userId, cardId: pending.card.id });
    syncCreditData(room);
    return { skipped: true };
};

const sellAsset = (room, player, assetId) => {
    const index = player.assets.findIndex(asset => asset.id === assetId || asset.cardId === assetId);
    if (index === -1) {
        throw new Error('Актив не найден');
    }
    const [asset] = player.assets.splice(index, 1);
    const deck = asset.size === 'small' ? room.gameState.decks.small : room.gameState.decks.big;
    returnCardToDeck(deck, {
        id: asset.cardId,
        name: asset.name,
        amount: asset.purchasePrice,
        income: asset.monthlyIncome,
        type: asset.type
    });
    player.stats.assetsOwned = player.assets.length;
    player.stats.assetsSold += 1;
    applyIncome(player, asset.purchasePrice);
    syncCreditData(room);
    logGameEvent(room, { type: 'asset_sold', playerId: player.userId, assetId: asset.cardId, price: asset.purchasePrice });
    return asset;
};

const transferAsset = (room, fromPlayer, toPlayer, assetId) => {
    const index = fromPlayer.assets.findIndex(asset => asset.id === assetId || asset.cardId === assetId);
    if (index === -1) {
        throw new Error('Актив не найден у отправителя');
    }
    const [asset] = fromPlayer.assets.splice(index, 1);
    fromPlayer.stats.dealsTransferred += 1;
    toPlayer.assets.push(asset);
    toPlayer.stats.assetsOwned = toPlayer.assets.length;
    syncCreditData(room);
    logGameEvent(room, { type: 'asset_transferred', from: fromPlayer.userId, to: toPlayer.userId, assetId: asset.cardId });
    return asset;
};

const advanceTurn = (room) => {
    if (!room.gameState || !room.gameState.turnOrder.length) {
        return;
    }
    room.gameState.activePlayerIndex = (room.gameState.activePlayerIndex + 1) % room.gameState.turnOrder.length;
    room.gameState.lastRoll = null;
    room.gameState.pendingDeal = null;
    setPhase(room, 'awaiting_roll');
    logGameEvent(room, { type: 'turn_advanced', activePlayerId: getActivePlayer(room)?.userId || null });
};

// Функции для работы с пользователями в памяти
const addUserToMemory = (user) => {
    if (!user || !user.id) return null;
    users.set(user.id, { ...user });
    return users.get(user.id);
};

const getUserFromMemory = (userId) => {
    return users.get(userId) || null;
};

const getUserByEmailFromMemory = (email) => {
    for (const user of users.values()) {
        if (user.email === email) {
            return user;
        }
    }
    return null;
};

const updateUserInMemory = (userId, updateData) => {
    const user = users.get(userId);
    if (!user) return null;
    
    Object.assign(user, updateData);
    users.set(userId, user);
    return user;
};

const removeUserFromMemory = (userId) => {
    return users.delete(userId);
};

const getAllUsersFromMemory = () => {
    return Array.from(users.values());
};

const loadUsersFromDatabase = async (db) => {
    try {
        console.log('🔄 Загружаем пользователей из SQLite...');
        const dbUsers = await db.getAllUsers();
        console.log(`📋 Найдено пользователей в SQLite: ${dbUsers.length}`);
        
        for (const user of dbUsers) {
            console.log(`👤 Загружаем пользователя: ${user.email} (ID: ${user.id})`);
            addUserToMemory(user);
        }
        
        console.log(`✅ Загружено пользователей в память: ${users.size}`);
        
        // Выводим список загруженных пользователей для отладки
        console.log('📋 Загруженные пользователи:');
        for (const [id, user] of users) {
            console.log(`  - ${user.email} (ID: ${id})`);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки пользователей из SQLite:', error);
    }
};

// Глобальная ссылка на базу данных для сохранения
let globalDb = null;

// Устанавливаем ссылку на базу данных
const setDatabase = (db) => {
    globalDb = db;
};

// Принудительное сохранение комнаты
const forceSaveRoom = async (roomId) => {
    if (!globalDb) {
        console.warn('⚠️ База данных не инициализирована для сохранения');
        return false;
    }
    
    const room = rooms.get(roomId);
    if (!room) {
        console.warn(`⚠️ Комната ${roomId} не найдена в памяти`);
        return false;
    }
    
    try {
        console.log(`💾 Принудительное сохранение комнаты: ${room.name} (${roomId})`);
        
        // Обновляем данные комнаты
        await globalDb.updateRoom(roomId, {
            name: room.name,
            status: room.gameStarted ? 'playing' : 'waiting',
            gameStarted: room.gameStarted,
            updated_at: new Date().toISOString()
        });
        
        // Обновляем данные всех игроков
        for (const player of room.players) {
            await globalDb.updatePlayerSelection(roomId, player.userId, {
                dreamId: player.selectedDream,
                tokenId: player.selectedToken
            });
            await globalDb.updatePlayerReady(roomId, player.userId, player.isReady);
        }
        
        console.log(`✅ Комната ${room.name} успешно сохранена`);
        return true;
    } catch (error) {
        console.error(`❌ Ошибка принудительного сохранения комнаты ${roomId}:`, error);
        return false;
    }
};

// Принудительное сохранение всех комнат
const forceSaveAllRooms = async () => {
    if (!globalDb) {
        console.warn('⚠️ База данных не инициализирована для сохранения');
        return false;
    }
    
    console.log(`💾 Принудительное сохранение всех комнат (${rooms.size} комнат)`);
    let savedCount = 0;
    let errorCount = 0;
    
    for (const [roomId, room] of rooms) {
        const success = await forceSaveRoom(roomId);
        if (success) {
            savedCount++;
        } else {
            errorCount++;
        }
    }
    
    console.log(`✅ Сохранение завершено: ${savedCount} успешно, ${errorCount} с ошибками`);
    return errorCount === 0;
};

module.exports = {
    rooms,
    creditRooms,
    users,
    STARTING_BALANCE,
    MIN_PLAYERS,
    MAX_PLAYERS,
    DREAMS,
    TOKENS,
    SMALL_DEAL_CARDS,
    BIG_DEAL_CARDS,
    EXPENSE_CARDS,
    clamp,
    generateId,
    createPlayerStats,
    createPlayer,
    createRoomInstance,
    sanitizePlayer,
    sanitizeRoom,
    getRoomById,
    listRooms,
    addPlayerToRoom,
    removePlayerFromRoom,
    toggleReadyStatus,
    assignDreamToPlayer,
    assignTokenToPlayer,
    syncCreditData,
    ensureCreditRoom,
    requireRoom,
    setPhase,
    initializeGame,
    getActivePlayer,
    serializeGameState,
    getCellByIndex,
    isDealCell,
    isExpenseCell,
    isIncomeCell,
    logGameEvent,
    applyIncome,
    applyExpense,
    handleIncomeCell,
    handleExpenseCell,
    handleDealCell,
    movePlayer,
    movePlayerAndResolve,
    rollDice,
    drawDealCard,
    chooseDeal,
    addAssetToPlayer,
    resolveDeal,
    sellAsset,
    transferAsset,
    advanceTurn,
    drawFromDeck,
    returnCardToDeck,
    createDeck,
    // Функции для работы с пользователями
    addUserToMemory,
    getUserFromMemory,
    getUserByEmailFromMemory,
    updateUserInMemory,
    removeUserFromMemory,
    getAllUsersFromMemory,
    loadUsersFromDatabase,
    // Функции для принудительного сохранения
    setDatabase,
    forceSaveRoom,
    forceSaveAllRooms
};
