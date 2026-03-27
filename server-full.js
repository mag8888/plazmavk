/**
 * EM1 Game Board v2.0 - Unified Server
 * Единый сервер с MongoDB Atlas интеграцией и исправленной аутентификацией
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Database imports
const { connectToMongoDB, getDb, getConnectionStatus } = require('./game-board/config/database-mongodb');
const RoomModel = require('./game-board/models/RoomModel');
const UserModel = require('./game-board/models/UserModel');
const BankAccountModel = require('./game-board/models/BankAccountModel');

// Game configuration
const { GAME_CELLS, GameCellsUtils } = require('./game-board/config/game-cells');
const { MARKET_CARDS, EXPENSE_CARDS, SMALL_DEALS, BIG_DEALS } = require('./game-board/config/cards-config');
const userManager = require('./game-board/utils/userManager');

// Initialize auth module
const authModule = require('./modules/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: false,
        allowedHeaders: ["*"]
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000
});

const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

app.use(express.static(path.join(__dirname)));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/game-board', express.static(path.join(__dirname, 'game-board')));
app.use('/favicon.svg', express.static(path.join(__dirname, 'favicon.svg')));
app.use(express.json());

// Initialize Database Connection
async function initializeDatabase() {
    try {
        await connectToMongoDB();
        console.log("✅ MongoDB Atlas connection established");
    } catch (error) {
        console.error("❌ MongoDB Atlas connection failed:", error.message);
        console.log("🔄 Continuing with in-memory storage for local testing...");
        // Don't exit the process for local testing, allow fallback to in-memory storage
    }
}

// In-memory storage for rooms and game data (with MongoDB persistence)
let serverRooms = [];
let connectedUsers = new Map();

// MongoDB persistence functions
const saveRoomToMongoDB = async (room) => {
    try {
        const dbStatus = getConnectionStatus();
        if (dbStatus.isConnected) {
            const roomModel = new RoomModel(room);
            await roomModel.save();
        }
    } catch (error) {
        console.error('❌ Error saving room to MongoDB:', error);
    }
};

const loadRoomsFromMongoDB = async () => {
    try {
        const dbStatus = getConnectionStatus();
        if (dbStatus.isConnected) {
            const rooms = await RoomModel.find();
            serverRooms = rooms.map(room => ({
                id: room._id.toString(),
                name: room.name,
                maxPlayers: room.maxPlayers,
                turnTime: room.turnTime,
                players: room.players || [],
                status: room.status,
                createdAt: room.createdAt,
                updatedAt: room.updatedAt,
                assignProfessions: room.assignProfessions,
                password: room.password,
                creatorId: room.creatorId,
                creatorEmail: room.creatorEmail,
                gameState: room.gameState || {}
            }));
            console.log(`✅ Loaded ${serverRooms.length} rooms from MongoDB`);
        }
    } catch (error) {
        console.error('❌ Error loading rooms from MongoDB:', error);
    }
};

const saveUserToMongoDB = async (user) => {
    try {
        const dbStatus = getConnectionStatus();
        if (dbStatus.isConnected) {
            const userModel = new UserModel(user);
            await userModel.save();
        }
    } catch (error) {
        console.error('❌ Error saving user to MongoDB:', error);
    }
};

// Helper functions
const getPlayerIdentifier = (player) => player?.userId || player?.id || null;

const DEFAULT_STATS = () => ({
    turnsTaken: 0,
    diceRolled: 0,
    dealsBought: 0,
    dealsSkipped: 0,
    assetsOwned: 0,
    incomeReceived: 0,
    expensesPaid: 0
});

const createRoomPlayer = ({ user, isHost = false, socketId = null }) => ({
    userId: user.id,
    id: user.id,
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
    stats: DEFAULT_STATS()
});

const sanitizePlayer = (player = {}) => ({
    userId: player.userId || player.id || null,
    name: player.name || 'Игрок',
    email: player.email || null,
    isHost: Boolean(player.isHost),
    isReady: Boolean(player.isReady),
    selectedToken: player.selectedToken ?? null,
    selectedDream: player.selectedDream ?? null,
    joinedAt: player.joinedAt || null,
    position: player.position || 0,
    cash: player.cash ?? 10000,
    passiveIncome: player.passiveIncome ?? 0,
    assets: Array.isArray(player.assets) ? player.assets : [],
    stats: player.stats || DEFAULT_STATS()
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

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/game-board', (req, res) => {
    res.sendFile(path.join(__dirname, 'game-board', 'game.html'));
});

app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-game-integration.html'));
});

// Health Check endpoints
app.get('/health', (req, res) => {
    const dbStatus = getConnectionStatus();
    res.json({
        status: 'ok',
        service: 'EM1 Game Board v2.0',
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        database: dbStatus.isConnected ? 'MongoDB Atlas' : 'Memory',
        rooms: serverRooms.length,
        users: connectedUsers.size
    });
});

// API Health Check
app.get('/api/health', (req, res) => {
    const dbStatus = getConnectionStatus();
    res.json({
        status: 'ok',
        service: 'EM1 Game Board v2.0',
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        database: {
            connected: dbStatus.isConnected,
            name: dbStatus.name || 'memory'
        },
        gameLogic: {
            cellsAvailable: GAME_CELLS.length,
            cardsAvailable: {
                market: MARKET_CARDS.length,
                expense: EXPENSE_CARDS.length,
                smallDeals: SMALL_DEALS.length,
                bigDeals: BIG_DEALS.length
            }
        }
    });
});

// API для игровых клеток
app.get('/api/game-cells', (req, res) => {
    try {
        const { type, category } = req.query;
        let cells = GAME_CELLS;
        
        if (type) {
            cells = cells.filter(cell => cell.type === type);
        }
        
        res.json({
            success: true,
            cells: cells,
            total: cells.length
        });
    } catch (error) {
        console.error('Ошибка получения игровых клеток:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения игровых клеток' 
        });
    }
});

// API для карт
app.get('/api/cards', (req, res) => {
    try {
        res.json({
            success: true,
            marketCards: MARKET_CARDS,
            expenseCards: EXPENSE_CARDS,
            smallDeals: SMALL_DEALS,
            bigDeals: BIG_DEALS,
            stats: {
                total: MARKET_CARDS.length + EXPENSE_CARDS.length + SMALL_DEALS.length + BIG_DEALS.length,
                market: MARKET_CARDS.length,
                expense: EXPENSE_CARDS.length,
                smallDeals: SMALL_DEALS.length,
                bigDeals: BIG_DEALS.length
            }
        });
    } catch (error) {
        console.error('Ошибка получения карточек:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения карточек сделок'
        });
    }
});

// API для мечт
app.get('/api/dreams', (req, res) => {
    try {
        const dreams = GameCellsUtils.getDreams();
        res.json({
            success: true,
            dreams: dreams,
            total: dreams.length
        });
    } catch (error) {
        console.error('Ошибка получения мечт:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения мечт' 
        });
    }
});

// API для комнат
app.get('/api/rooms', (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            rooms: serverRooms.map(room => sanitizeRoom(room)),
            total: serverRooms.length
        });
    } catch (error) {
        console.error('Ошибка получения списка комнат:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.post('/api/rooms', async (req, res) => {
    try {
        const { name, max_players, turn_time, assign_professions, password } = req.body;
        
        if (!name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Название комнаты обязательно' 
            });
        }

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
            creatorId: user.id,
            creatorEmail: user.email
        };
        
        serverRooms.push(newRoom);
        
        // Save to MongoDB
        await saveRoomToMongoDB(newRoom);
        
        console.log(`🏠 Комната "${name}" создана пользователем ${user.username} (${user.id})`);

        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            room: sanitizeRoom(newRoom, { requestingUserId: user.id })
        });
    } catch (error) {
        console.error('Ошибка создания комнаты:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API для пользователя
app.get('/api/user/profile', (req, res) => {
    try {
        const userEmail = req.headers['x-user-name'] || 'guest@example.com';
        const user = userManager.getUserByEmail(userEmail) || userManager.registerUser({
            email: userEmail,
            username: userEmail.split('@')[0]
        });
        
        const profile = {
            id: user.id,
            username: user.username,
            first_name: user.first_name,
            email: user.email,
            balance: 10000,
            registeredAt: user.registeredAt,
            lastSeen: user.lastSeen,
            isOnline: user.isOnline,
            connections: user.socketConnections.size
        };
        
        res.json(profile);
    } catch (error) {
        console.error('Ошибка получения профиля пользователя:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// WebSocket connections
io.on('connection', (socket) => {
    console.log('👤 Пользователь подключился:', socket.id);
    
    socket.on('disconnect', (reason) => {
        console.log('👋 Пользователь отключился:', socket.id, 'Причина:', reason);
    });
    
    // Регистрация пользователя
    socket.on('registerUser', (userData) => {
        try {
            if (!userData || !userData.email) {
                userData = {
                    email: `guest_${Date.now()}@example.com`,
                    username: 'Гость',
                    first_name: 'Гость'
                };
            }
            
            const validatedData = userManager.validateUserData(userData);
            const user = userManager.registerUser(validatedData);
            userManager.addSocketConnection(user.id, socket.id);
            
            connectedUsers.set(socket.id, user);
            
            console.log('👤 Пользователь подключился:', user.username, 'ID:', user.id, 'Socket:', socket.id);
            
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
            creatorId: user.id,
            creatorEmail: user.email
        };

        serverRooms.push(newRoom);
        broadcastRoomsUpdate();
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
            socket.emit('error', { message: 'Комната не найдена' });
            return;
        }
        
        if (room.players.length >= room.maxPlayers) {
            socket.emit('error', { message: 'Комната заполнена' });
            return;
        }
        
        room.players.push(createRoomPlayer({ user, isHost: false, socketId: socket.id }));
        room.updatedAt = new Date().toISOString();

        socket.join(roomId);
        broadcastRoomsUpdate();
        io.to(roomId).emit('roomUpdate', sanitizeRoom(room));
        socket.emit('roomJoined', sanitizeRoom(room, { requestingUserId: user.id }));
        
        console.log(`🏠 Пользователь ${user.username} присоединился к комнате ${roomId}`);
    });
    
    // Покидание комнаты
    socket.on('leaveRoom', (roomId) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;
        
        const room = serverRooms.find(r => r.id === roomId);
        if (!room) return;
        
        room.players = room.players.filter(p => p.socketId !== socket.id);

        if (room.players.length > 0) {
            room.players[0].isHost = true;
        }

        if (room.players.length === 0) {
            serverRooms = serverRooms.filter(r => r.id !== roomId);
        }
        
        room.updatedAt = new Date().toISOString();

        socket.leave(roomId);
        broadcastRoomsUpdate();
        
        if (room.players.length > 0) {
            io.to(roomId).emit('roomUpdate', sanitizeRoom(room));
        }

        console.log(`🚪 Пользователь ${user.username} покинул комнату ${roomId}`);
    });
    
    // Отключение
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            console.log('👋 Пользователь отключился:', user.username, 'ID:', user.id, 'Socket:', socket.id);
            
            userManager.removeSocketConnection(user.id, socket.id);
            
            serverRooms.forEach(room => {
                const playerIndex = room.players.findIndex(p => getPlayerIdentifier(p) === user.id);
                if (playerIndex !== -1) {
                    const player = room.players[playerIndex];
                    room.players.splice(playerIndex, 1);
                    
                    if (player.isHost && room.players.length > 0) {
                        room.players[0].isHost = true;
                    }
                    
                    if (room.players.length === 0) {
                        serverRooms = serverRooms.filter(r => r.id !== room.id);
                    } else {
                        room.updatedAt = new Date().toISOString();
                        io.to(room.id).emit('roomUpdate', sanitizeRoom(room));
                    }
                }
            });
            
            broadcastRoomsUpdate();
            connectedUsers.delete(socket.id);
        }
    });
});

// Обработка 404
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'Страница не найдена',
        requested: req.originalUrl,
        availableRoutes: [
            '/',
            '/game-board',
            '/test',
            '/api/health',
            '/api/game-cells',
            '/api/cards',
            '/api/dreams',
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

// Запуск сервера
async function startServer() {
    try {
        await initializeDatabase();
        
        // Initialize auth module with app after database connection
        const jwtSecret = process.env.JWT_SECRET || 'em1-production-secret-key-2024-railway';
        console.log('🔐 Initializing auth module...');
        
        // Create database wrapper for auth module
        const dbWrapper = {
            createUser: async (userData) => {
                try {
                    console.log('Creating user:', userData.username);
                    const userModel = new UserModel(userData);
                    const savedUser = await userModel.save();
                    console.log('User created successfully:', savedUser.username);
                    return savedUser;
                } catch (error) {
                    console.error('Error creating user:', error);
                    throw error;
                }
            },
            getUserByEmail: async (email) => {
                try {
                    console.log('Finding user by email:', email);
                    const user = await UserModel.findByEmail(email);
                    console.log('User found by email:', user ? user.username : 'not found');
                    return user;
                } catch (error) {
                    console.error('Error finding user by email:', error);
                    return null;
                }
            },
            getUserByUsername: async (username) => {
                try {
                    console.log('Finding user by username:', username);
                    const user = await UserModel.findByUsername(username);
                    console.log('User found by username:', user ? user.username : 'not found');
                    return user;
                } catch (error) {
                    console.error('Error finding user by username:', error);
                    return null;
                }
            }
        };
        
        const authResult = authModule({ 
            app, 
            db: dbWrapper, 
            jwtSecret,
            roomState: {
                addUserToMemory: (user) => connectedUsers.set(user.id, user),
                getUserFromMemory: (userId) => connectedUsers.get(userId),
                getUserByEmailFromMemory: (email) => {
                    for (let user of connectedUsers.values()) {
                        if (user.email === email) return user;
                    }
                    return null;
                },
                updateUserInMemory: (userId, userData) => connectedUsers.set(userId, userData)
            }
        });
        console.log('✅ Auth module initialized with database wrapper and room state');
        
        // Add direct registration API endpoint as fallback
        const bcrypt = require('bcryptjs');
        const jwt = require('jsonwebtoken');
        
        app.post('/api/auth/register', async (req, res) => {
            try {
                console.log('📝 Registration request received:', req.body);
                const { username, email, password, confirmPassword } = req.body;
                
                // Validation
                if (!username || !email || !password) {
                    return res.status(400).json({ error: 'Все поля обязательны' });
                }
                
                if (password !== confirmPassword) {
                    return res.status(400).json({ error: 'Пароли не совпадают' });
                }
                
                // Check if user exists
                const existingUser = await dbWrapper.findUserByEmail(email);
                if (existingUser) {
                    return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
                }
                
                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);
                
                // Create user
                const newUser = {
                    username,
                    email,
                    password: hashedPassword,
                    createdAt: new Date(),
                    isActive: true
                };
                
                const savedUser = await dbWrapper.createUser(newUser);
                console.log('✅ User created successfully:', savedUser.username);
                
                // Generate JWT token
                const token = jwt.sign(
                    { userId: savedUser._id || savedUser.id, email: savedUser.email },
                    jwtSecret,
                    { expiresIn: '7d' }
                );
                
                res.status(201).json({
                    message: 'Пользователь успешно зарегистрирован',
                    token,
                    user: {
                        id: savedUser._id || savedUser.id,
                        username: savedUser.username,
                        email: savedUser.email
                    }
                });
                
            } catch (error) {
                console.error('❌ Registration error:', error);
                res.status(500).json({ error: 'Ошибка сервера при регистрации' });
            }
        });
        
        console.log('✅ Direct registration API endpoint added');
        
        // Load existing rooms from MongoDB
        await loadRoomsFromMongoDB();
        
        server.listen(PORT, () => {
            console.log('🎮 EM1 Game Board v2.0 Server запущен!');
            console.log(`🚀 Сервер работает на порту ${PORT}`);
            console.log(`📱 Локальный адрес: http://localhost:${PORT}`);
            console.log(`🌐 Railway адрес: https://your-app.railway.app`);
            console.log('✅ Готов к обслуживанию файлов');
            console.log('🔌 WebSocket сервер активен');
            console.log('🎯 Обновленная игровая логика активна');
            
            const dbStatus = getConnectionStatus();
            if (dbStatus.isConnected) {
                console.log(`📊 База данных подключена: ${dbStatus.name}`);
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
