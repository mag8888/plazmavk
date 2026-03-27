const mongoose = require('mongoose');
const ServerConfig = require('../server-config');

// Схема в "старом" формате, который ожидает фронтенд (first_name, balance и т.п.)
const serverConfig = new ServerConfig();

const legacyUserSchema = new mongoose.Schema({
    telegram_id: { type: Number, sparse: true },
    username: { type: String, default: '' },
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: serverConfig.getStartingBalance() },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    games_played: { type: Number, default: 0 },
    wins_count: { type: Number, default: 0 },
    referrals_count: { type: Number, default: 0 },
    referral_earnings: { type: Number, default: 0 },
    referral_code: { type: String, unique: true, sparse: true },
    referred_by: { type: mongoose.Schema.Types.ObjectId, ref: 'LegacyUser', default: null },
    is_active: { type: Boolean, default: true }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

legacyUserSchema.pre('save', function(next) {
    if (!this.referral_code) {
        this.referral_code = `REF${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    }
    next();
});

module.exports = mongoose.models.LegacyUser || mongoose.model('LegacyUser', legacyUserSchema, 'users');