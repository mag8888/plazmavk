// Game Board v2.0 - Database Configuration
const mongoose = require('mongoose');

// MongoDB Configuration
const DB_CONFIG = {
    // Production MongoDB Atlas URI (замените на ваш)
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://gameboard:password123@cluster0.mongodb.net/gameboard?retryWrites=true&w=majority',
    
    // Local MongoDB URI (для разработки)
    MONGODB_LOCAL_URI: process.env.MONGODB_LOCAL_URI || 'mongodb://localhost:27017/gameboard',
    
    // Database settings
    DB_NAME: process.env.DB_NAME || 'gameboard',
    OPTIONS: {
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        bufferCommands: false // Disable mongoose buffering
    }
};

// Database Collections
const COLLECTIONS = {
    ROOMS: process.env.DB_COLLECTION_ROOMS || 'rooms',
    USERS: process.env.DB_COLLECTION_USERS || 'users',
    GAMES: process.env.DB_COLLECTION_GAMES || 'games',
    PROFESSIONS: process.env.DB_COLLECTION_PROFESSIONS || 'professions',
    BANK: process.env.DB_COLLECTION_BANK || 'bank'
};

// Connection state
let isConnected = false;
let connectionPromise = null;

/**
 * Connect to MongoDB
 * @param {boolean} useLocal - Use local MongoDB instead of Atlas
 * @returns {Promise<mongoose.Connection>}
 */
async function connectToDatabase(useLocal = false) {
    if (isConnected && mongoose.connection.readyState === 1) {
        console.log('📊 MongoDB already connected');
        return mongoose.connection;
    }

    if (connectionPromise) {
        console.log('🔄 MongoDB connection in progress...');
        return connectionPromise;
    }

    const uri = useLocal ? DB_CONFIG.MONGODB_LOCAL_URI : DB_CONFIG.MONGODB_URI;
    
    connectionPromise = mongoose.connect(uri, DB_CONFIG.OPTIONS)
        .then((connection) => {
            console.log('✅ MongoDB connected successfully!');
            console.log(`📊 Database: ${connection.connection.name}`);
            console.log(`🌐 Host: ${connection.connection.host}`);
            console.log(`🔌 Port: ${connection.connection.port}`);
            isConnected = true;
            return connection;
        })
        .catch((error) => {
            console.error('❌ MongoDB connection error:', error.message);
            isConnected = false;
            connectionPromise = null;
            throw error;
        });

    return connectionPromise;
}

/**
 * Disconnect from MongoDB
 */
async function disconnectFromDatabase() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        isConnected = false;
        connectionPromise = null;
        console.log('🔌 MongoDB disconnected');
    }
}

/**
 * Get database connection status
 * @returns {object}
 */
function getConnectionStatus() {
    return {
        isConnected: isConnected && mongoose.connection.readyState === 1,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
    };
}

// MongoDB Event Handlers
mongoose.connection.on('connected', () => {
    console.log('🎉 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('🔌 Mongoose disconnected from MongoDB');
    isConnected = false;
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await disconnectFromDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await disconnectFromDatabase();
    process.exit(0);
});

module.exports = {
    connectToDatabase,
    disconnectFromDatabase,
    getConnectionStatus,
    DB_CONFIG,
    COLLECTIONS
};
