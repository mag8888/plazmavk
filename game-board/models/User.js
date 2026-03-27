// Game Board v2.0 - User Model
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    profile: {
        avatar: {
            type: String,
            default: null
        },
        firstName: {
            type: String,
            trim: true,
            maxlength: 50
        },
        lastName: {
            type: String,
            trim: true,
            maxlength: 50
        },
        bio: {
            type: String,
            maxlength: 500
        }
    },
    gameStats: {
        gamesPlayed: {
            type: Number,
            default: 0
        },
        gamesWon: {
            type: Number,
            default: 0
        },
        totalScore: {
            type: Number,
            default: 0
        },
        bestScore: {
            type: Number,
            default: 0
        },
        averageScore: {
            type: Number,
            default: 0
        },
        winRate: {
            type: Number,
            default: 0
        }
    },
    preferences: {
        language: {
            type: String,
            default: 'ru',
            enum: ['ru', 'en']
        },
        theme: {
            type: String,
            default: 'dark',
            enum: ['dark', 'light']
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            push: {
                type: Boolean,
                default: true
            },
            gameInvites: {
                type: Boolean,
                default: true
            }
        }
    },
    status: {
        isOnline: {
            type: Boolean,
            default: false
        },
        lastSeen: {
            type: Date,
            default: Date.now
        },
        currentRoom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            default: null
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'users'
});

// Indexes
userSchema.index({ username: 1 });
userSchema.index({ email: 1 }, { sparse: true });
userSchema.index({ 'status.isOnline': 1 });
userSchema.index({ 'gameStats.gamesPlayed': -1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    if (this.profile.firstName && this.profile.lastName) {
        return `${this.profile.firstName} ${this.profile.lastName}`;
    }
    return this.username;
});

// Virtual for win rate percentage
userSchema.virtual('winRatePercentage').get(function() {
    if (this.gameStats.gamesPlayed === 0) return 0;
    return Math.round((this.gameStats.gamesWon / this.gameStats.gamesPlayed) * 100);
});

// Methods
userSchema.methods.updateLastSeen = function() {
    this.status.lastSeen = new Date();
    return this.save();
};

userSchema.methods.setOnline = function() {
    this.status.isOnline = true;
    this.status.lastSeen = new Date();
    return this.save();
};

userSchema.methods.setOffline = function() {
    this.status.isOnline = false;
    this.status.lastSeen = new Date();
    return this.save();
};

userSchema.methods.joinRoom = function(roomId) {
    this.status.currentRoom = roomId;
    return this.save();
};

userSchema.methods.leaveRoom = function() {
    this.status.currentRoom = null;
    return this.save();
};

userSchema.methods.updateGameStats = function(gameResult) {
    this.gameStats.gamesPlayed += 1;
    
    if (gameResult.won) {
        this.gameStats.gamesWon += 1;
    }
    
    if (gameResult.score) {
        this.gameStats.totalScore += gameResult.score;
        this.gameStats.bestScore = Math.max(this.gameStats.bestScore, gameResult.score);
        this.gameStats.averageScore = Math.round(this.gameStats.totalScore / this.gameStats.gamesPlayed);
    }
    
    this.gameStats.winRate = this.winRatePercentage;
    
    return this.save();
};

userSchema.methods.toPublicJSON = function() {
    const userObject = this.toObject();
    
    // Remove sensitive data
    delete userObject.password;
    delete userObject.email;
    
    return userObject;
};

// Static methods
userSchema.statics.findOnlineUsers = function() {
    return this.find({ 'status.isOnline': true }).sort({ 'status.lastSeen': -1 });
};

userSchema.statics.findTopPlayers = function(limit = 10) {
    return this.find().sort({ 'gameStats.totalScore': -1 }).limit(limit);
};

userSchema.statics.findByRoom = function(roomId) {
    return this.find({ 'status.currentRoom': roomId });
};

userSchema.statics.cleanupInactiveUsers = function() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.deleteMany({
        'status.lastSeen': { $lt: thirtyDaysAgo },
        'status.isOnline': false
    });
};

// Pre-save middleware
userSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Update average score when games played changes
    if (this.gameStats.gamesPlayed > 0) {
        this.gameStats.averageScore = Math.round(this.gameStats.totalScore / this.gameStats.gamesPlayed);
        this.gameStats.winRate = this.winRatePercentage;
    }
    
    next();
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
