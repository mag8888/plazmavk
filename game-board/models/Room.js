// Game Board v2.0 - Room Model
const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    isHost: {
        type: Boolean,
        default: false
    },
    isReady: {
        type: Boolean,
        default: false
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    lastActivity: {
        type: Date,
        default: Date.now
    }
});

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        index: true
    },
    maxPlayers: {
        type: Number,
        required: true,
        min: 2,
        max: 8,
        default: 4
    },
    players: [playerSchema],
    status: {
        type: String,
        enum: ['waiting', 'full', 'playing', 'finished'],
        default: 'waiting',
        index: true
    },
    hostId: {
        type: String,
        required: true
    },
    gameSettings: {
        profession: {
            type: String,
            default: 'Предприниматель'
        },
        difficulty: {
            type: String,
            enum: ['business', 'hard'],
            default: 'business'
        },
        startingBalance: {
            type: Number,
            default: 1000
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    startedAt: {
        type: Date,
        default: null
    },
    finishedAt: {
        type: Date,
        default: null
    },
    lastActivity: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true,
    collection: 'rooms'
});

// Indexes for better performance
roomSchema.index({ status: 1, createdAt: -1 });
roomSchema.index({ hostId: 1 });
roomSchema.index({ 'players.name': 1 });

// Virtual for player count
roomSchema.virtual('playerCount').get(function() {
    return this.players.length;
});

// Virtual for available slots
roomSchema.virtual('availableSlots').get(function() {
    return this.maxPlayers - this.players.length;
});

// Virtual for is full
roomSchema.virtual('isFull').get(function() {
    return this.players.length >= this.maxPlayers;
});

// Virtual for can start
roomSchema.virtual('canStart').get(function() {
    return this.players.length >= 2 && this.status === 'waiting';
});

// Methods
roomSchema.methods.addPlayer = function(playerName) {
    if (this.isFull) {
        throw new Error('Room is full');
    }
    
    if (this.status !== 'waiting') {
        throw new Error('Room is not accepting new players');
    }
    
    // Check if player already exists
    const existingPlayer = this.players.find(p => p.name === playerName);
    if (existingPlayer) {
        return existingPlayer;
    }
    
    const newPlayer = {
        name: playerName,
        isHost: false,
        isReady: false,
        joinedAt: new Date(),
        lastActivity: new Date()
    };
    
    this.players.push(newPlayer);
    this.lastActivity = new Date();
    
    // Update room status
    if (this.isFull) {
        this.status = 'full';
    }
    
    return newPlayer;
};

roomSchema.methods.removePlayer = function(playerName) {
    const playerIndex = this.players.findIndex(p => p.name === playerName);
    if (playerIndex === -1) {
        return false;
    }
    
    const player = this.players[playerIndex];
    
    // If removing host, assign new host or close room
    if (player.isHost) {
        if (this.players.length === 1) {
            // Last player leaving - close room
            this.status = 'finished';
            this.finishedAt = new Date();
        } else {
            // Assign new host (first remaining player)
            this.players.forEach(p => p.isHost = false);
            this.players[0].isHost = true;
            this.hostId = this.players[0].name;
        }
    }
    
    this.players.splice(playerIndex, 1);
    this.lastActivity = new Date();
    
    // Update room status
    if (this.status === 'full' && !this.isFull) {
        this.status = 'waiting';
    }
    
    return true;
};

roomSchema.methods.startGame = function() {
    if (!this.canStart) {
        throw new Error('Cannot start game - not enough players or wrong status');
    }
    
    this.status = 'playing';
    this.startedAt = new Date();
    this.lastActivity = new Date();
    
    return this;
};

roomSchema.methods.finishGame = function() {
    this.status = 'finished';
    this.finishedAt = new Date();
    this.lastActivity = new Date();
    
    return this;
};

// Static methods
roomSchema.statics.findActiveRooms = function() {
    return this.find({
        status: { $in: ['waiting', 'full', 'playing'] }
    }).sort({ createdAt: -1 });
};

roomSchema.statics.findByPlayer = function(playerName) {
    return this.findOne({
        'players.name': playerName,
        status: { $in: ['waiting', 'full', 'playing'] }
    });
};

roomSchema.statics.cleanupOldRooms = function() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.deleteMany({
        status: 'finished',
        finishedAt: { $lt: oneDayAgo }
    });
};

// Ensure virtual fields are serialized
roomSchema.set('toJSON', { virtuals: true });
roomSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Room', roomSchema);
