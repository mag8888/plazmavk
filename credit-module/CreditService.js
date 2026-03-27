/**
 * Credit Service - Новый модуль для работы с кредитами
 */

class CreditService {
    constructor() {
        console.log('💳 CreditService: Инициализация сервиса кредитов');
        this.creditStep = 1000; // Шаг кредита
        this.minAmount = 1000; // Минимальная сумма
        this.maxCredit = 10000; // Максимальный кредит
        this.paymentRate = 100; // Платеж за каждые 1000$
    }

    /**
     * Взять кредит
     */
    async takeCredit(room, playerIndex, amount) {
        console.log('💳 CreditService: Взятие кредита', { playerIndex, amount });

        // Валидация
        if (!amount || amount < this.minAmount || amount % this.creditStep !== 0) {
            throw new Error(`Сумма должна быть кратной ${this.creditStep}$`);
        }

        // Инициализируем кредитные данные если не существуют
        if (!room.game_data.credit_data) {
            room.game_data.credit_data = {
                player_credits: new Array(room.players.length).fill(0),
                credit_history: []
            };
        }

        // Проверяем текущий кредит и максимальный лимит
        const currentCredit = room.game_data.credit_data.player_credits[playerIndex] || 0;
        const newTotalCredit = currentCredit + amount;
        
        if (newTotalCredit > this.maxCredit) {
            const availableAmount = this.maxCredit - currentCredit;
            throw new Error(`Превышен максимальный лимит кредита. Доступно: $${availableAmount.toLocaleString()}`);
        }

        // Рассчитываем ежемесячный платеж для нового кредита
        const newMonthlyPayment = Math.floor(amount / this.creditStep) * this.paymentRate;
        
        // Рассчитываем общий ежемесячный платеж
        const totalMonthlyPayment = Math.floor(newTotalCredit / this.creditStep) * this.paymentRate;

        // Обновляем данные (добавляем к существующему кредиту)
        room.game_data.credit_data.player_credits[playerIndex] = newTotalCredit;
        
        // Добавляем в историю
        room.game_data.credit_data.credit_history.push({
            player_index: playerIndex,
            type: 'take',
            amount: amount,
            monthly_payment: newMonthlyPayment,
            total_credit: newTotalCredit,
            total_monthly_payment: totalMonthlyPayment,
            timestamp: new Date(),
            description: `Взят кредит на $${amount.toLocaleString()} (общий: $${newTotalCredit.toLocaleString()})`
        });

        // Добавляем деньги на баланс
        if (!room.game_data.player_balances) {
            room.game_data.player_balances = new Array(room.players.length).fill(0);
        }
        room.game_data.player_balances[playerIndex] += amount;

        // Добавляем в историю переводов
        if (!room.game_data.transfers_history) {
            room.game_data.transfers_history = [];
        }
        room.game_data.transfers_history.push({
            sender: 'Банк',
            recipient: room.players[playerIndex].name,
            amount: amount,
            timestamp: new Date(),
            sender_index: -1,
            recipient_index: playerIndex,
            type: 'credit',
            description: `Кредит на $${amount.toLocaleString()}`
        });

        console.log('💳 CreditService: Кредит выдан успешно', { 
            new_balance: room.game_data.player_balances[playerIndex],
            new_credit_amount: amount,
            total_credit: newTotalCredit,
            new_monthly_payment: newMonthlyPayment,
            total_monthly_payment: totalMonthlyPayment
        });

        return {
            success: true,
            new_balance: room.game_data.player_balances[playerIndex],
            new_credit_amount: amount,
            total_credit: newTotalCredit,
            new_monthly_payment: newMonthlyPayment,
            total_monthly_payment: totalMonthlyPayment
        };
    }

    /**
     * Погасить кредит
     */
    async payoffCredit(room, playerIndex, amount) {
        console.log('💳 CreditService: Погашение кредита', { playerIndex, amount });

        if (!room.game_data.credit_data) {
            throw new Error('Нет данных о кредитах');
        }

        const currentCredit = room.game_data.credit_data.player_credits[playerIndex] || 0;
        if (currentCredit <= 0) {
            throw new Error('У вас нет активного кредита');
        }

        const payoffAmount = amount || currentCredit;
        if (payoffAmount > currentCredit) {
            throw new Error('Сумма погашения превышает текущий кредит');
        }

        if (payoffAmount > room.game_data.player_balances[playerIndex]) {
            throw new Error('Недостаточно средств для погашения');
        }

        // Обновляем данные
        room.game_data.credit_data.player_credits[playerIndex] -= payoffAmount;
        
        // Добавляем в историю
        room.game_data.credit_data.credit_history.push({
            player_index: playerIndex,
            type: 'payoff',
            amount: payoffAmount,
            timestamp: new Date(),
            description: `Погашен кредит на $${payoffAmount.toLocaleString()}`
        });

        // Списываем деньги с баланса
        room.game_data.player_balances[playerIndex] -= payoffAmount;

        // Добавляем в историю переводов
        room.game_data.transfers_history.push({
            sender: room.players[playerIndex].name,
            recipient: 'Банк',
            amount: payoffAmount,
            timestamp: new Date(),
            sender_index: playerIndex,
            recipient_index: -1,
            type: 'credit_payoff',
            description: `Погашение кредита на $${payoffAmount.toLocaleString()}`
        });

        console.log('💳 CreditService: Кредит погашен успешно', { 
            new_balance: room.game_data.player_balances[playerIndex],
            remaining_credit: room.game_data.credit_data.player_credits[playerIndex]
        });

        return {
            success: true,
            new_balance: room.game_data.player_balances[playerIndex],
            remaining_credit: room.game_data.credit_data.player_credits[playerIndex],
            paid_amount: payoffAmount
        };
    }

    /**
     * Получить информацию о кредите игрока
     */
    getPlayerCredit(room, playerIndex) {
        if (!room.game_data.credit_data) {
            return {
                current_credit: 0,
                monthly_payment: 0,
                max_credit: this.maxCredit,
                available_credit: this.maxCredit,
                can_take_credit: true
            };
        }

        const currentCredit = room.game_data.credit_data.player_credits[playerIndex] || 0;
        const monthlyPayment = Math.floor(currentCredit / this.creditStep) * this.paymentRate;
        const availableCredit = this.maxCredit - currentCredit;

        return {
            current_credit: currentCredit,
            monthly_payment: monthlyPayment,
            max_credit: this.maxCredit,
            available_credit: availableCredit,
            can_take_credit: availableCredit >= this.minAmount
        };
    }
}

module.exports = CreditService;
