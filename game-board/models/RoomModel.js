const { ObjectId } = require("mongodb");
const { getDb } = require("../config/database-mongodb");

class Room {
    constructor({ id, name, maxPlayers, turnTime, players, status, createdAt, updatedAt, assignProfessions, password, creatorId, creatorEmail, creator_id, creator_name, creator_avatar, max_players, min_players, turn_time, assign_professions, game_started, last_activity, gameState = {} }) {
        this._id = id ? new ObjectId(id) : new ObjectId();
        this.id = this._id.toString();
        this.name = name;
        this.maxPlayers = maxPlayers || max_players || 4;
        this.max_players = this.maxPlayers;
        this.min_players = min_players || 2;
        this.turnTime = turnTime || turn_time || 3;
        this.turn_time = this.turnTime;
        this.players = players || [];
        this.status = status || "waiting";
        this.createdAt = createdAt || new Date().toISOString();
        this.updatedAt = updatedAt || new Date().toISOString();
        this.created_at = this.createdAt;
        this.updated_at = this.updatedAt;
        this.assignProfessions = assignProfessions || assign_professions || false;
        this.assign_professions = this.assignProfessions;
        this.password = password || null;
        this.creatorId = creatorId || creator_id;
        this.creator_id = this.creatorId;
        this.creatorEmail = creatorEmail;
        this.creator_name = creator_name || '';
        this.creator_avatar = creator_avatar || null;
        this.game_started = game_started || false;
        this.last_activity = last_activity || Date.now();
        this.gameState = gameState;
    }

    static collection() {
        try {
            return getDb().collection("rooms");
        } catch (error) {
            console.error('Database connection error in RoomModel:', error);
            throw error;
        }
    }

    async save() {
        try {
            const doc = { 
                ...this, 
                _id: this._id,
                updated_at: new Date(),
                updatedAt: new Date().toISOString()
            };
            await Room.collection().updateOne(
                { _id: this._id },
                { $set: doc },
                { upsert: true }
            );
            return this;
        } catch (error) {
            console.error('Error saving room:', error);
            return this;
        }
    }

    static async findById(id) {
        try {
            const room = await Room.collection().findOne({ _id: new ObjectId(id) });
            return room ? new Room(room) : null;
        } catch (error) {
            console.error('Error finding room by id:', error);
            return null;
        }
    }

    static async find(query = {}) {
        try {
            const rooms = await Room.collection().find(query).toArray();
            return rooms.map(room => new Room(room));
        } catch (error) {
            console.error('Error finding rooms:', error);
            return [];
        }
    }

    static async deleteById(id) {
        try {
            const result = await Room.collection().deleteOne({ _id: new ObjectId(id) });
            return result.deletedCount > 0;
        } catch (error) {
            console.error('Error deleting room:', error);
            return false;
        }
    }

    static async updateOne(id, update) {
        try {
            const result = await Room.collection().updateOne(
                { _id: new ObjectId(id) },
                { $set: { ...update, updated_at: new Date(), updatedAt: new Date().toISOString() } }
            );
            return result.modifiedCount > 0;
        } catch (error) {
            console.error('Error updating room:', error);
            return false;
        }
    }

    static async createRoom(roomData) {
        try {
            const room = new Room({
                ...roomData,
                created_at: new Date(),
                updated_at: new Date(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            await room.save();
            return room;
        } catch (error) {
            console.error('Error creating room:', error);
            throw error;
        }
    }
}

module.exports = Room;
