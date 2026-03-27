const { getDb } = require("../config/database-mongodb");
const { ObjectId } = require("mongodb");

class BankAccount {
    constructor({ id, userId, roomId, balance, createdAt, updatedAt }) {
        this._id = id ? new ObjectId(id) : new ObjectId();
        this.userId = userId;
        this.roomId = roomId;
        this.balance = balance || 0;
        this.createdAt = createdAt || new Date().toISOString();
        this.updatedAt = updatedAt || new Date().toISOString();
    }

    static collection() {
        return getDb().collection("bankAccounts");
    }

    async save() {
        const doc = { ...this, _id: this._id };
        await BankAccount.collection().updateOne(
            { _id: this._id },
            { $set: doc },
            { upsert: true }
        );
        return this;
    }

    static async findByUserIdAndRoomId(userId, roomId) {
        const account = await BankAccount.collection().findOne({ userId: userId, roomId: roomId });
        return account ? new BankAccount(account) : null;
    }

    static async updateBalance(userId, roomId, amount) {
        const result = await BankAccount.collection().updateOne(
            { userId: userId, roomId: roomId },
            { $inc: { balance: amount }, $set: { updatedAt: new Date().toISOString() } },
            { upsert: true }
        );
        return result.modifiedCount > 0 || result.upsertedCount > 0;
    }

    static async getBalance(userId, roomId) {
        const account = await BankAccount.collection().findOne({ userId: userId, roomId: roomId });
        return account ? account.balance : 0;
    }
}

module.exports = BankAccount;

