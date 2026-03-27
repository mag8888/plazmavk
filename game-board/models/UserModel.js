const { ObjectId } = require("mongodb");
const { getDb } = require("../config/database-mongodb");

class User {
    constructor({ id, email, username, first_name, last_name, password, telegram_id, balance, level, experience, games_played, wins_count, referrals_count, referral_code, referral_earnings, is_active, registeredAt, lastSeen, isOnline = false, socketConnections = [], created_at, updated_at }) {
        this._id = id ? new ObjectId(id) : new ObjectId();
        this.id = this._id.toString();
        this.email = email;
        this.username = username || '';
        this.first_name = first_name || '';
        this.last_name = last_name || '';
        this.password = password;
        this.telegram_id = telegram_id || null;
        this.balance = balance || 10000;
        this.level = level || 1;
        this.experience = experience || 0;
        this.games_played = games_played || 0;
        this.wins_count = wins_count || 0;
        this.referrals_count = referrals_count || 0;
        this.referral_code = referral_code || null;
        this.referral_earnings = referral_earnings || 0;
        this.is_active = is_active !== false;
        this.registeredAt = registeredAt || new Date().toISOString();
        this.lastSeen = lastSeen || new Date().toISOString();
        this.isOnline = isOnline;
        this.socketConnections = socketConnections || [];
        this.created_at = created_at || new Date();
        this.updated_at = updated_at || new Date();
    }

    static collection() {
        try {
            return getDb().collection("users");
        } catch (error) {
            console.error('Database connection error in UserModel:', error);
            throw error;
        }
    }

    async save() {
        try {
            const doc = { 
                ...this, 
                _id: this._id,
                updated_at: new Date()
            };
            await User.collection().updateOne(
                { _id: this._id },
                { $set: doc },
                { upsert: true }
            );
            return this;
        } catch (error) {
            console.error('Error saving user:', error);
            // Fallback: return the user object for in-memory storage
            if (!this.id) {
                this.id = this._id.toString();
                this.created_at = new Date();
                this.updated_at = new Date();
            }
            return this;
        }
    }

    static async findById(id) {
        try {
            const user = await User.collection().findOne({ _id: new ObjectId(id) });
            return user ? new User(user) : null;
        } catch (error) {
            console.error('Error finding user by id:', error);
            return null;
        }
    }

    static async findByEmail(email) {
        try {
            const user = await User.collection().findOne({ email: email });
            return user ? new User(user) : null;
        } catch (error) {
            console.error('Error finding user by email:', error);
            return null;
        }
    }

    static async findByUsername(username) {
        try {
            const user = await User.collection().findOne({ username: username });
            return user ? new User(user) : null;
        } catch (error) {
            console.error('Error finding user by username:', error);
            return null;
        }
    }

    static async createUser(userData) {
        try {
            const user = new User({
                ...userData,
                created_at: new Date(),
                updated_at: new Date()
            });
            await user.save();
            return user;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    static async updateOne(id, update) {
        try {
            const result = await User.collection().updateOne(
                { _id: new ObjectId(id) },
                { $set: { ...update, updated_at: new Date(), lastSeen: new Date().toISOString() } }
            );
            
            if (result.modifiedCount > 0) {
                return await User.findById(id);
            }
            return null;
        } catch (error) {
            console.error('Error updating user:', error);
            return null;
        }
    }

    static async addSocketConnection(userId, socketId) {
        try {
            const result = await User.collection().updateOne(
                { _id: new ObjectId(userId) },
                { $addToSet: { socketConnections: socketId }, $set: { isOnline: true, lastSeen: new Date().toISOString() } }
            );
            return result.modifiedCount > 0;
        } catch (error) {
            console.error('Error adding socket connection:', error);
            return false;
        }
    }

    static async removeSocketConnection(userId, socketId) {
        try {
            const result = await User.collection().updateOne(
                { _id: new ObjectId(userId) },
                { $pull: { socketConnections: socketId }, $set: { lastSeen: new Date().toISOString() } }
            );
            
            // Check if user has any remaining socket connections, if not, set isOnline to false
            const user = await User.findById(userId);
            if (user && user.socketConnections.length === 0) {
                await User.collection().updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: { isOnline: false } }
                );
            }
            return result.modifiedCount > 0;
        } catch (error) {
            console.error('Error removing socket connection:', error);
            return false;
        }
    }

    static async getAllUsers() {
        try {
            const users = await User.collection().find({}).toArray();
            return users.map(user => new User(user));
        } catch (error) {
            console.error('Error getting all users:', error);
            return [];
        }
    }
}

module.exports = User;
