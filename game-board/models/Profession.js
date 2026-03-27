// Game Board v2.0 - Profession Model
const mongoose = require('mongoose');

const liabilitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['tax', 'expense', 'loan', 'mortgage', 'credit_card'],
        required: true
    },
    payment: {
        type: Number,
        required: true,
        min: 0
    },
    principal: {
        type: Number,
        default: 0,
        min: 0
    },
    interestRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    termMonths: {
        type: Number,
        default: 0,
        min: 0
    },
    remainingMonths: {
        type: Number,
        default: 0,
        min: 0
    }
});

const professionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        maxlength: 500
    },
    category: {
        type: String,
        enum: ['business', 'professional', 'employee', 'entrepreneur'],
        required: true
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard', 'expert'],
        required: true
    },
    startingFinancials: {
        income: {
            type: Number,
            required: true,
            min: 0
        },
        expenses: {
            type: Number,
            required: true,
            min: 0
        },
        cashflow: {
            type: Number,
            required: true
        },
        startingBalance: {
            type: Number,
            required: true,
            default: 1000
        }
    },
    liabilities: [liabilitySchema],
    totalLiabilities: {
        type: Number,
        default: 0,
        min: 0
    },
    paths: [{
        name: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        difficulty: {
            type: String,
            enum: ['business', 'hard'],
            required: true
        },
        requirements: {
            minIncome: {
                type: Number,
                default: 0
            },
            minCashflow: {
                type: Number,
                default: 0
            },
            maxLiabilities: {
                type: Number,
                default: Infinity
            }
        },
        benefits: {
            incomeMultiplier: {
                type: Number,
                default: 1.0
            },
            expenseReduction: {
                type: Number,
                default: 0
            },
            specialAbilities: [String]
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'professions'
});

// Indexes
professionSchema.index({ category: 1 });
professionSchema.index({ difficulty: 1 });
professionSchema.index({ isActive: 1 });

// Virtual for total monthly expenses
professionSchema.virtual('totalMonthlyExpenses').get(function() {
    const baseExpenses = this.startingFinancials.expenses;
    const liabilityPayments = this.liabilities.reduce((sum, liability) => sum + liability.payment, 0);
    return baseExpenses + liabilityPayments;
});

// Virtual for net cashflow
professionSchema.virtual('netCashflow').get(function() {
    return this.startingFinancials.income - this.totalMonthlyExpenses;
});

// Methods
professionSchema.methods.calculateTotalLiabilities = function() {
    this.totalLiabilities = this.liabilities.reduce((sum, liability) => sum + liability.principal, 0);
    return this.totalLiabilities;
};

professionSchema.methods.addLiability = function(liabilityData) {
    const liability = {
        name: liabilityData.name,
        type: liabilityData.type,
        payment: liabilityData.payment,
        principal: liabilityData.principal || 0,
        interestRate: liabilityData.interestRate || 0,
        termMonths: liabilityData.termMonths || 0,
        remainingMonths: liabilityData.remainingMonths || liabilityData.termMonths || 0
    };
    
    this.liabilities.push(liability);
    this.calculateTotalLiabilities();
    return this.save();
};

professionSchema.methods.removeLiability = function(liabilityName) {
    const index = this.liabilities.findIndex(l => l.name === liabilityName);
    if (index !== -1) {
        this.liabilities.splice(index, 1);
        this.calculateTotalLiabilities();
        return this.save();
    }
    return false;
};

professionSchema.methods.updateFinancials = function(newIncome, newExpenses) {
    this.startingFinancials.income = newIncome;
    this.startingFinancials.expenses = newExpenses;
    this.startingFinancials.cashflow = newIncome - newExpenses;
    
    return this.save();
};

professionSchema.methods.getPathByDifficulty = function(difficulty) {
    return this.paths.find(path => path.difficulty === difficulty);
};

professionSchema.methods.canChoosePath = function(difficulty, currentIncome, currentCashflow, currentLiabilities) {
    const path = this.getPathByDifficulty(difficulty);
    if (!path) return false;
    
    const requirements = path.requirements;
    return currentIncome >= requirements.minIncome &&
           currentCashflow >= requirements.minCashflow &&
           currentLiabilities <= requirements.maxLiabilities;
};

// Static methods
professionSchema.statics.findByCategory = function(category) {
    return this.find({ category, isActive: true });
};

professionSchema.statics.findByDifficulty = function(difficulty) {
    return this.find({ difficulty, isActive: true });
};

professionSchema.statics.findActiveProfessions = function() {
    return this.find({ isActive: true }).sort({ name: 1 });
};

professionSchema.statics.getDefaultProfession = function() {
    return this.findOne({ name: 'Предприниматель', isActive: true });
};

// Pre-save middleware
professionSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Auto-calculate total liabilities
    this.calculateTotalLiabilities();
    
    // Auto-calculate cashflow if not set
    if (this.startingFinancials.cashflow === undefined) {
        this.startingFinancials.cashflow = this.startingFinancials.income - this.startingFinancials.expenses;
    }
    
    next();
});

// Ensure virtual fields are serialized
professionSchema.set('toJSON', { virtuals: true });
professionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Profession', professionSchema);
