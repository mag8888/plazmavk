// Менеджер профессий для игры
// Управляет картами профессий и их данными

class ProfessionManager {
    constructor() {
        this.professions = [];
        this.initializeProfessions();
    }
    
    // Инициализация профессий
    initializeProfessions() {
        console.log('💼 ProfessionManager: Initializing professions...');
        
        // Используем данные из существующего файла professions-data.js
        // Если данные уже загружены из window.PROFESSIONS, используем их
        if (typeof window !== 'undefined' && window.PROFESSIONS && window.PROFESSIONS.length > 0) {
            console.log('💼 ProfessionManager: Using window.PROFESSIONS data');
            this.professions = window.PROFESSIONS.map(prof => ({
                id: prof.id,
                name: prof.name,
                description: prof.description,
                icon: prof.icon,
                salary: prof.salary,
                expenses: prof.expenses,
                cashFlow: prof.cashFlow,
                taxes: { amount: Math.round(prof.salary * 0.13), percentage: 13 },
                otherExpenses: Math.round(prof.expenses * 0.3),
                debts: this.generateDebts(prof.cashFlow),
                totalDebt: this.calculateTotalDebt(prof.cashFlow),
                difficulty: this.getDifficulty(prof.cashFlow),
                category: this.getCategory(prof.name)
            }));
        } else {
            console.log('💼 ProfessionManager: Using fallback data');
            // Fallback данные
            this.professions = [
            {
                id: 'entrepreneur',
                name: 'Предприниматель',
                description: 'Владелец бизнеса',
                icon: '🚀',
                salary: 10000,
                expenses: 6200,
                cashFlow: 3800,
                taxes: { amount: 1300, percentage: 13 },
                otherExpenses: 1500,
                debts: [
                    { name: 'Кредит на авто', monthly: 700, principal: 14000 },
                    { name: 'Образовательный кредит', monthly: 500, principal: 10000 },
                    { name: 'Ипотека', monthly: 1200, principal: 240000 },
                    { name: 'Кредитные карты', monthly: 1000, principal: 20000 }
                ],
                totalDebt: 284000,
                difficulty: 'Сложный',
                category: 'Business'
            },
            {
                id: 'engineer',
                name: 'Инженер',
                description: 'Высокооплачиваемый специалист',
                icon: '⚙️',
                salary: 8000,
                expenses: 4500,
                cashFlow: 3500,
                taxes: { amount: 1040, percentage: 13 },
                otherExpenses: 1200,
                debts: [
                    { name: 'Ипотека', monthly: 800, principal: 160000 },
                    { name: 'Кредит на авто', monthly: 400, principal: 8000 },
                    { name: 'Кредитные карты', monthly: 300, principal: 6000 }
                ],
                totalDebt: 174000,
                difficulty: 'Средний',
                category: 'Technical'
            },
            {
                id: 'teacher',
                name: 'Учитель',
                description: 'Преподаватель в школе',
                icon: '📚',
                salary: 4000,
                expenses: 3200,
                cashFlow: 800,
                taxes: { amount: 520, percentage: 13 },
                otherExpenses: 800,
                debts: [
                    { name: 'Ипотека', monthly: 600, principal: 120000 },
                    { name: 'Кредитные карты', monthly: 200, principal: 4000 }
                ],
                totalDebt: 124000,
                difficulty: 'Легкий',
                category: 'Education'
            },
            {
                id: 'doctor',
                name: 'Врач',
                description: 'Медицинский специалист',
                icon: '👨‍⚕️',
                salary: 12000,
                expenses: 7500,
                cashFlow: 4500,
                taxes: { amount: 1560, percentage: 13 },
                otherExpenses: 2000,
                debts: [
                    { name: 'Ипотека', monthly: 1000, principal: 200000 },
                    { name: 'Образовательный кредит', monthly: 800, principal: 16000 },
                    { name: 'Кредит на авто', monthly: 500, principal: 10000 },
                    { name: 'Кредитные карты', monthly: 400, principal: 8000 }
                ],
                totalDebt: 234000,
                difficulty: 'Сложный',
                category: 'Medical'
            },
            {
                id: 'nurse',
                name: 'Медсестра',
                description: 'Медицинский работник',
                icon: '👩‍⚕️',
                salary: 3500,
                expenses: 2800,
                cashFlow: 700,
                taxes: { amount: 455, percentage: 13 },
                otherExpenses: 600,
                debts: [
                    { name: 'Ипотека', monthly: 500, principal: 100000 },
                    { name: 'Кредитные карты', monthly: 150, principal: 3000 }
                ],
                totalDebt: 103000,
                difficulty: 'Легкий',
                category: 'Medical'
            },
            {
                id: 'lawyer',
                name: 'Юрист',
                description: 'Юридический консультант',
                icon: '⚖️',
                salary: 9000,
                expenses: 5500,
                cashFlow: 3500,
                taxes: { amount: 1170, percentage: 13 },
                otherExpenses: 1500,
                debts: [
                    { name: 'Ипотека', monthly: 900, principal: 180000 },
                    { name: 'Образовательный кредит', monthly: 600, principal: 12000 },
                    { name: 'Кредит на авто', monthly: 450, principal: 9000 },
                    { name: 'Кредитные карты', monthly: 350, principal: 7000 }
                ],
                totalDebt: 208000,
                difficulty: 'Сложный',
                category: 'Legal'
            }
        ];
        
        console.log('✅ ProfessionManager: Professions initialized', this.professions.length);
    }
    
    // Получение всех профессий
    getAllProfessions() {
        return this.professions;
    }
    
    // Получение профессии по ID
    getProfessionById(id) {
        return this.professions.find(prof => prof.id === id);
    }
    
    // Получение случайной профессии
    getRandomProfession() {
        const randomIndex = Math.floor(Math.random() * this.professions.length);
        return this.professions[randomIndex];
    }
    
    // Получение профессий по сложности
    getProfessionsByDifficulty(difficulty) {
        return this.professions.filter(prof => prof.difficulty === difficulty);
    }
    
    // Получение профессий по категории
    getProfessionsByCategory(category) {
        return this.professions.filter(prof => prof.category === category);
    }

    // Генерация долгов на основе денежного потока
    generateDebts(cashFlow) {
        const debts = [];
        
        // Ипотека (если денежный поток позволяет)
        if (cashFlow > 2000) {
            debts.push({
                name: 'Ипотека',
                monthly: Math.round(cashFlow * 0.3),
                principal: Math.round(cashFlow * 0.3 * 240)
            });
        }
        
        // Кредит на авто
        if (cashFlow > 1000) {
            debts.push({
                name: 'Кредит на авто',
                monthly: Math.round(cashFlow * 0.2),
                principal: Math.round(cashFlow * 0.2 * 60)
            });
        }
        
        // Образовательный кредит
        if (cashFlow > 500) {
            debts.push({
                name: 'Образовательный кредит',
                monthly: Math.round(cashFlow * 0.15),
                principal: Math.round(cashFlow * 0.15 * 60)
            });
        }
        
        // Кредитные карты
        debts.push({
            name: 'Кредитные карты',
            monthly: Math.round(cashFlow * 0.1),
            principal: Math.round(cashFlow * 0.1 * 24)
        });
        
        return debts;
    }

    // Расчет общего долга
    calculateTotalDebt(cashFlow) {
        const debts = this.generateDebts(cashFlow);
        return debts.reduce((total, debt) => total + debt.principal, 0);
    }

    // Определение сложности профессии
    getDifficulty(cashFlow) {
        if (cashFlow > 3000) return 'Легкий';
        if (cashFlow > 2000) return 'Средний';
        return 'Сложный';
    }

    // Определение категории профессии
    getCategory(name) {
        const categories = {
            'Предприниматель': 'Business',
            'Врач': 'Medical',
            'Инженер': 'Technical',
            'Учитель': 'Education',
            'Юрист': 'Legal',
            'Художник': 'Creative'
        };
        return categories[name] || 'General';
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfessionManager;
} else if (typeof window !== 'undefined') {
    window.ProfessionManager = ProfessionManager;
}
