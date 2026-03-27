// Game Board v2.0 - Bank Account Model
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['transfer', 'income', 'expense', 'investment', 'loan', 'payment'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    from: {
        type: String,
        required: function() {
            return this.type === 'transfer';
        }
    },
    to: {
        type: String,
        required: function() {
            return this.type === 'transfer';
        }
    },
    description: {
        type: String,
        required: true,
        maxlength: 200
    },
    category: {
        type: String,
        enum: ['salary', 'business', 'investment', 'loan', 'expense', 'transfer', 'other'],
        default: 'other'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    metadata: {
        roomId: String,
        gameId: String,
        profession: String,
        isAutomated: {
            type: Boolean,
            default: false
        }
    }
});

const bankAccountSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    roomId: {
        type: String,
        required: true,
        index: true
    },
    gameId: {
        type: String,
        index: true
    },
    balance: {
        type: Number,
        required: true,
        default: 1000
    },
    startingBalance: {
        type: Number,
        required: true,
        default: 1000
    },
    transactions: [transactionSchema],
    accountType: {
        type: String,
        enum: ['checking', 'savings', 'business'],
        default: 'checking'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastTransactionAt: {
        type: Date,
        default: Date.now
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
    collection: 'bank_accounts'
});

// Compound indexes
bankAccountSchema.index({ userId: 1, roomId: 1 }, { unique: true });
bankAccountSchema.index({ roomId: 1, createdAt: -1 });
bankAccountSchema.index({ 'transactions.timestamp': -1 });

// Virtual for transaction count
bankAccountSchema.virtual('transactionCount').get(function() {
    return this.transactions.length;
});

// Virtual for total income
bankAccountSchema.virtual('totalIncome').get(function() {
    return this.transactions
        .filter(t => t.type === 'income' || (t.type === 'transfer' && t.to === this.userId))
        .reduce((sum, t) => sum + t.amount, 0);
});

// Virtual for total expenses
bankAccountSchema.virtual('totalExpenses').get(function() {
    return this.transactions
        .filter(t => t.type === 'expense' || (t.type === 'transfer' && t.from === this.userId))
        .reduce((sum, t) => sum + t.amount, 0);
});

// Virtual for net worth
bankAccountSchema.virtual('netWorth').get(function() {
    return this.balance + this.totalIncome - this.totalExpenses;
});

// Methods
bankAccountSchema.methods.addTransaction = function(transactionData) {
    const transaction = {
        type: transactionData.type,
        amount: transactionData.amount,
        from: transactionData.from,
        to: transactionData.to,
        description: transactionData.description,
        category: transactionData.category || 'other',
        metadata: transactionData.metadata || {},
        timestamp: new Date()
    };
    
    this.transactions.push(transaction);
    this.lastTransactionAt = new Date();
    this.updatedAt = new Date();
    
    return this.save();
};

bankAccountSchema.methods.transfer = function(toUserId, amount, description = 'Transfer') {
    if (this.balance < amount) {
        throw new Error('Insufficient funds');
    }
    
    if (amount <= 0) {
        throw new Error('Transfer amount must be positive');
    }
    
    // Add outgoing transaction
    this.addTransaction({
        type: 'transfer',
        amount: -amount,
        from: this.userId,
        to: toUserId,
        description: `Transfer to ${toUserId}: ${description}`,
        category: 'transfer'
    });
    
    // Update balance
    this.balance -= amount;
    
    return this.save();
};

bankAccountSchema.methods.receiveTransfer = function(fromUserId, amount, description = 'Transfer') {
    // Add incoming transaction
    this.addTransaction({
        type: 'transfer',
        amount: amount,
        from: fromUserId,
        to: this.userId,
        description: `Transfer from ${fromUserId}: ${description}`,
        category: 'transfer'
    });
    
    // Update balance
    this.balance += amount;
    
    return this.save();
};

bankAccountSchema.methods.addIncome = function(amount, description, category = 'salary') {
    this.addTransaction({
        type: 'income',
        amount: amount,
        description: description,
        category: category
    });
    
    this.balance += amount;
    
    return this.save();
};

bankAccountSchema.methods.addExpense = function(amount, description, category = 'expense') {
    if (this.balance < amount) {
        throw new Error('Insufficient funds');
    }
    
    this.addTransaction({
        type: 'expense',
        amount: -amount,
        description: description,
        category: category
    });
    
    this.balance -= amount;
    
    return this.save();
};

bankAccountSchema.methods.getTransactionHistory = function(limit = 50, offset = 0) {
    return this.transactions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(offset, offset + limit);
};

bankAccountSchema.methods.getTransactionsByType = function(type) {
    return this.transactions.filter(t => t.type === type);
};

bankAccountSchema.methods.getMonthlySummary = function(month, year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    const monthlyTransactions = this.transactions.filter(t => 
        t.timestamp >= startDate && t.timestamp <= endDate
    );
    
    const income = monthlyTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = monthlyTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    return {
        month,
        year,
        income,
        expenses,
        netCashflow: income - expenses,
        transactionCount: monthlyTransactions.length
    };
};

// Static methods
bankAccountSchema.statics.findByUser = function(userId, roomId) {
    return this.findOne({ userId, roomId });
};

bankAccountSchema.statics.findByRoom = function(roomId) {
    return this.find({ roomId, isActive: true });
};

bankAccountSchema.statics.getRoomBalances = function(roomId) {
    return this.find({ roomId, isActive: true }).select('userId balance');
};

bankAccountSchema.statics.createAccount = function(userId, roomId, startingBalance = 1000) {
    return this.create({
        userId,
        roomId,
        balance: startingBalance,
        startingBalance: startingBalance
    });
};

bankAccountSchema.statics.transferBetweenAccounts = async function(fromUserId, toUserId, roomId, amount, description) {
    const fromAccount = await this.findByUser(fromUserId, roomId);
    const toAccount = await this.findByUser(toUserId, roomId);
    
    if (!fromAccount) {
        throw new Error('Sender account not found');
    }
    
    if (!toAccount) {
        throw new Error('Receiver account not found');
    }
    
    // Perform transfer
    await fromAccount.transfer(toUserId, amount, description);
    await toAccount.receiveTransfer(fromUserId, amount, description);
    
    return {
        fromAccount,
        toAccount,
        amount,
        description
    };
};

// Pre-save middleware
bankAccountSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Ensure balance is not negative
    if (this.balance < 0) {
        return next(new Error('Account balance cannot be negative'));
    }
    
    next();
});

// Ensure virtual fields are serialized
bankAccountSchema.set('toJSON', { virtuals: true });
bankAccountSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('BankAccount', bankAccountSchema);
