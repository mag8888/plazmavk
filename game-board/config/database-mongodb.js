const { MongoClient, ServerApiVersion } = require('mongodb');

let client;
let db;
let isConnected = false;

const connectToMongoDB = async () => {
    if (isConnected) {
        return;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI is not defined in environment variables.');
        throw new Error('MONGODB_URI is not defined.');
    }

    client = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });

    try {
        await client.connect();
        db = client.db(process.env.MONGODB_DB_NAME || 'em2_game');
        isConnected = true;
        console.log('✅ Connected to MongoDB Atlas');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB Atlas:', error);
        isConnected = false;
        throw error;
    }
};

const getDb = () => {
    if (!isConnected) {
        throw new Error('Database not connected. Call connectToMongoDB first.');
    }
    return db;
};

const closeMongoDBConnection = async () => {
    if (client) {
        await client.close();
        isConnected = false;
        console.log('🔌 MongoDB connection closed.');
    }
};

const getConnectionStatus = () => ({
    isConnected: isConnected,
    name: 'MongoDB'
});

let UserModel;
let RoomModel;

const setModels = (userModel, roomModel) => {
    UserModel = userModel;
    RoomModel = roomModel;
};

const dbWrapper = {
    async createUser(userData) {
        if (!UserModel) throw new Error("UserModel not set");
        return await UserModel.createUser(userData);
    },
    async getUserByEmail(email) {
        if (!UserModel) throw new Error("UserModel not set");
        return await UserModel.findByEmail(email);
    },
    async getUserByUsername(username) {
        if (!UserModel) throw new Error("UserModel not set");
        return await UserModel.findByUsername(username);
    },
    async getUserById(id) {
        if (!UserModel) throw new Error("UserModel not set");
        return await UserModel.findById(id);
    },
    async updateUser(id, updateData) {
        if (!UserModel) throw new Error("UserModel not set");
        return await UserModel.updateOne(id, updateData);
    },
    async getAllUsers() {
        if (!UserModel) throw new Error("UserModel not set");
        return await UserModel.getAllUsers();
    },
    async createRoom(roomData) {
        if (!RoomModel) throw new Error("RoomModel not set");
        const room = new RoomModel(roomData);
        return await room.save();
    },
    async getRoom(roomId) {
        if (!RoomModel) throw new Error("RoomModel not set");
        return await RoomModel.findById(roomId);
    },
    async getAllRooms() {
        if (!RoomModel) throw new Error("RoomModel not set");
        return await RoomModel.find();
    },
    async updateRoom(roomId, updateData) {
        if (!RoomModel) throw new Error("RoomModel not set");
        return await RoomModel.updateOne(roomId, updateData);
    }
};

module.exports = {
    connectToMongoDB,
    getDb,
    closeMongoDBConnection,
    getConnectionStatus,
    setModels,
    dbWrapper
};

