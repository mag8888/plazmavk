// EM1 Game Board v2.0 - Hybrid Server with MongoDB Atlas and SQLite fallback
require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');

// Database configuration
let dbConnected = false;
let db = null;
let usingMongoDB = false;

// Try MongoDB first, fallback to SQLite
const initializeDatabase = async () => {
    // Try MongoDB Atlas first
    if (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('mongodb')) {
        try {
            console.log('🔄 Attempting MongoDB Atlas connection...');
            const { connectToMongoDB, setModels, dbWrapper } = require('./game-board/config/database-mongodb');
            const UserModel = require('./game-board/models/UserModel');
            const RoomModel = require('./game-board/models/RoomModel');

            await connectToMongoDB();
            setModels(UserModel, RoomModel);
            db = dbWrapper;
            usingMongoDB = true;
            dbConnected = true;
            console.log('✅ Connected to MongoDB Atlas');
            return;
        } catch (error) {
            console.log('⚠️ MongoDB connection failed, falling back to SQLite:', error.message);
        }
    }

    // Fallback to SQLite
    try {
        console.log('🔄 Initializing SQLite database...');
        const Database = require('./database-sqlite');
        db = new Database();
        await db.init();
        usingMongoDB = false;
        dbConnected = true;
        console.log('✅ Connected to SQLite database');
    } catch (error) {
        console.error('❌ Failed to initialize any database:', error);
        throw error;
    }
};

// Modules
const registerAuthModule = require('./modules/auth');
const registerRoomsModule = require('./modules/rooms');
// Hold auth module reference for other modules
let authModuleRef = null;
const roomState = require('./services/room-state');

// --- Shared services -----------------------------------------------------
const { rooms, creditRooms, users, createRoomInstance, addPlayerToRoom, loadUsersFromDatabase, setDatabase } = roomState;

// --- Helpers -------------------------------------------------------------
const resolvePath = (relativePath) => path.join(__dirname, relativePath);

const registerPage = (route, file) => {
    app.get(route, (req, res) => {
        res.sendFile(resolvePath(file));
    });
};

const setupTestData = async () => {
    try {
        // Create test user if it doesn't exist
        const testUser = usingMongoDB
            ? await db.getUserByEmail('test@example.com')
            : await db.getUserByEmail('test@example.com');

        if (!testUser) {
            const userData = {
                email: 'test@example.com',
                password: 'test123',
                username: 'testuser',
                first_name: 'Test',
                last_name: 'User'
            };

            if (usingMongoDB) {
                await db.createUser(userData);
            } else {
                await db.createUser(userData);
            }
            console.log('✅ Created test user: test@example.com / test123');
        }

        // Set database reference in room-state
        setDatabase(db);

        // Load users from database into memory
        await loadUsersFromDatabase(db);

    } catch (error) {
        console.error('❌ Error setting up test data:', error);
    }
};

// --- Express Configuration -----------------------------------------------
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:8080',
        'https://em1-production.up.railway.app',
        /\.railway\.app$/,
        /\.vercel\.app$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/game-board', express.static(path.join(__dirname, 'game-board')));

// --- Database Initialization ---------------------------------------------
initializeDatabase()
    .then(setupTestData)
    .catch(error => {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    });

// --- Authentication Module Registration ----------------------------------
setTimeout(() => {
    if (dbConnected) {
        try {
            authModuleRef = registerAuthModule({
                app,
                db,
                jwtSecret: JWT_SECRET,
                roomState
            });
            console.log('✅ Auth module registered successfully');
        } catch (error) {
            console.error('❌ Failed to register auth module:', error);
        }
    } else {
        console.error('❌ Cannot register auth module: database not connected');
    }
}, 1000);

// --- Rooms Module Registration -------------------------------------------
setTimeout(() => {
    if (dbConnected) {
        try {
            registerRoomsModule({
                app,
                db,
                auth: authModuleRef,
                isDbReady: () => dbConnected
            });
            console.log('✅ Rooms module registered successfully');
        } catch (error) {
            console.error('❌ Failed to register rooms module:', error);
        }
    }
}, 1500);

// --- Static Routes -------------------------------------------------------
registerPage('/', 'index.html');
registerPage('/game', 'game-board/index.html');
registerPage('/game/lobby', 'game-board/lobby.html');
registerPage('/game/room/:roomId', 'game-board/room.html');

// User profile route
app.get('/game/u/:username', async (req, res) => {
    try {
        const { username } = req.params;

        if (!dbConnected) {
            return res.status(500).send('Database not connected');
        }

        // Try to find user by username
        const user = usingMongoDB
            ? await db.getUserByUsername(username)
            : await db.getUserByUsername(username);

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Serve the profile page with user data
        res.sendFile(resolvePath('game-board/profile.html'));
    } catch (error) {
        console.error('Error loading user profile:', error);
        res.status(500).send('Internal server error');
    }
});

// API endpoint to get current user profile data
app.get('/api/user/profile', async (req, res) => {
    try {
        // For now, return a default profile or handle authentication
        // This should be enhanced with proper JWT authentication
        res.json({
            id: 'current_user',
            username: 'guest',
            first_name: 'Guest',
            last_name: 'User',
            level: 1,
            experience: 0,
            games_played: 0,
            wins_count: 0,
            created_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching current user profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to get user profile data by username
app.get('/api/user/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;

        if (!dbConnected) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const user = usingMongoDB
            ? await db.getUserByUsername(username)
            : await db.getUserByUsername(username);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return sanitized user data
        res.json({
            id: user._id || user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            level: user.level || 1,
            experience: user.experience || 0,
            games_played: user.games_played || 0,
            wins_count: user.wins_count || 0,
            created_at: user.created_at
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint for cards
app.get('/api/cards', (req, res) => {
    res.json([
        { id: 1, name: 'Карта 1', description: 'Описание карты 1' },
        { id: 2, name: 'Карта 2', description: 'Описание карты 2' }
    ]);
});

// API endpoint for game cells
app.get('/api/game-cells', (req, res) => {
    res.json([
        { id: 1, name: 'Ячейка 1', type: 'start' },
        { id: 2, name: 'Ячейка 2', type: 'property' }
    ]);
});

// API endpoint for dreams
app.get('/api/dreams', (req, res) => {
    res.json([
        { id: 1, name: 'Мечта 1', description: 'Описание мечты 1' },
        { id: 2, name: 'Мечта 2', description: 'Описание мечты 2' }
    ]);
});

// API endpoint for room dream selection
app.post('/api/room/select-dream', (req, res) => {
    res.json({ success: true, message: 'Мечта выбрана' });
});

// API endpoint for bank transfer
app.post('/api/bank/transfer', (req, res) => {
    res.json({ success: true, message: 'Перевод выполнен' });
});

// --- Health Check --------------------------------------------------------
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        database: dbConnected ? (usingMongoDB ? 'MongoDB Atlas' : 'SQLite') : 'disconnected',
        timestamp: new Date().toISOString(),
        rooms: rooms.size,
        users: users.size
    });
});

// --- Socket.IO Setup -----------------------------------------------------
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: [
            'http://localhost:3000',
            'http://localhost:8080',
            'https://em1-production.up.railway.app',
            /\.railway\.app$/,
            /\.vercel\.app$/
        ],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });

    // Room-related socket events
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on('leave-room', (roomId) => {
        socket.leave(roomId);
        console.log(`Socket ${socket.id} left room ${roomId}`);
    });
});

// --- Server Startup -----------------------------------------------------
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`💾 Database: ${usingMongoDB ? 'MongoDB Atlas' : 'SQLite'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

module.exports = app;
