/**
 * Валидаторы для игры "Энергия денег"
 */

/**
 * Базовый валидатор
 */
class Validator {
    constructor() {
        this.errors = [];
    }

    /**
     * Добавление ошибки
     * @param {string} message - Сообщение об ошибке
     */
    addError(message) {
        this.errors.push(message);
    }

    /**
     * Проверка наличия ошибок
     */
    isValid() {
        return this.errors.length === 0;
    }

    /**
     * Получение ошибок
     */
    getErrors() {
        return [...this.errors];
    }

    /**
     * Очистка ошибок
     */
    clearErrors() {
        this.errors = [];
    }
}

/**
 * Валидатор игрока
 */
export class PlayerValidator extends Validator {
    /**
     * Валидация данных игрока
     * @param {Object} player - Данные игрока
     */
    validate(player) {
        this.clearErrors();

        if (!player) {
            this.addError('Игрок не может быть пустым');
            return this.isValid();
        }

        // Валидация ID
        if (!player.id || typeof player.id !== 'string') {
            this.addError('ID игрока должен быть непустой строкой');
        }

        // Валидация имени
        if (!player.name || typeof player.name !== 'string') {
            this.addError('Имя игрока должно быть непустой строкой');
        } else if (player.name.trim().length < 2) {
            this.addError('Имя игрока должно содержать минимум 2 символа');
        } else if (player.name.trim().length > 50) {
            this.addError('Имя игрока не должно превышать 50 символов');
        }

        // Валидация баланса
        if (typeof player.balance !== 'number' || isNaN(player.balance)) {
            this.addError('Баланс должен быть числом');
        } else if (player.balance < 0) {
            this.addError('Баланс не может быть отрицательным');
        }

        // Валидация месячного дохода
        if (typeof player.monthlyIncome !== 'number' || isNaN(player.monthlyIncome)) {
            this.addError('Месячный доход должен быть числом');
        } else if (player.monthlyIncome < 0) {
            this.addError('Месячный доход не может быть отрицательным');
        }

        // Валидация месячных расходов
        if (typeof player.monthlyExpenses !== 'number' || isNaN(player.monthlyExpenses)) {
            this.addError('Месячные расходы должны быть числом');
        } else if (player.monthlyExpenses < 0) {
            this.addError('Месячные расходы не могут быть отрицательными');
        }

        // Валидация кредита
        if (typeof player.creditAmount !== 'number' || isNaN(player.creditAmount)) {
            this.addError('Сумма кредита должна быть числом');
        } else if (player.creditAmount < 0) {
            this.addError('Сумма кредита не может быть отрицательной');
        }

        // Валидация позиции
        if (typeof player.position !== 'number' || isNaN(player.position)) {
            this.addError('Позиция должна быть числом');
        } else if (player.position < 0) {
            this.addError('Позиция не может быть отрицательной');
        }

        // Валидация трека
        if (player.track && !['inner', 'outer'].includes(player.track)) {
            this.addError('Трек должен быть "inner" или "outer"');
        }

        // Валидация банкротства
        if (typeof player.isBankrupt !== 'boolean') {
            this.addError('Статус банкротства должен быть булевым значением');
        }

        return this.isValid();
    }
}

/**
 * Валидатор кредита
 */
export class CreditValidator extends Validator {
    /**
     * Валидация запроса кредита
     * @param {Object} creditRequest - Запрос кредита
     */
    validateCreditRequest(creditRequest) {
        this.clearErrors();

        if (!creditRequest) {
            this.addError('Запрос кредита не может быть пустым');
            return this.isValid();
        }

        // Валидация суммы
        if (typeof creditRequest.amount !== 'number' || isNaN(creditRequest.amount)) {
            this.addError('Сумма кредита должна быть числом');
        } else if (creditRequest.amount <= 0) {
            this.addError('Сумма кредита должна быть положительной');
        } else if (creditRequest.amount < 1000) {
            this.addError('Минимальная сумма кредита: $1,000');
        } else if (creditRequest.amount % 1000 !== 0) {
            this.addError('Сумма кредита должна быть кратна $1,000');
        }

        // Валидация ID игрока
        if (!creditRequest.playerId || typeof creditRequest.playerId !== 'string') {
            this.addError('ID игрока должен быть непустой строкой');
        }

        return this.isValid();
    }

    /**
     * Валидация погашения кредита
     * @param {Object} payoffRequest - Запрос погашения
     */
    validateCreditPayoff(payoffRequest) {
        this.clearErrors();

        if (!payoffRequest) {
            this.addError('Запрос погашения не может быть пустым');
            return this.isValid();
        }

        // Валидация суммы
        if (typeof payoffRequest.amount !== 'number' || isNaN(payoffRequest.amount)) {
            this.addError('Сумма погашения должна быть числом');
        } else if (payoffRequest.amount <= 0) {
            this.addError('Сумма погашения должна быть положительной');
        } else if (payoffRequest.amount < 1000) {
            this.addError('Минимальная сумма погашения: $1,000');
        } else if (payoffRequest.amount % 1000 !== 0) {
            this.addError('Сумма погашения должна быть кратна $1,000');
        }

        // Валидация ID игрока
        if (!payoffRequest.playerId || typeof payoffRequest.playerId !== 'string') {
            this.addError('ID игрока должен быть непустой строкой');
        }

        return this.isValid();
    }
}

/**
 * Валидатор перевода
 */
export class TransferValidator extends Validator {
    /**
     * Валидация перевода
     * @param {Object} transfer - Данные перевода
     */
    validate(transfer) {
        this.clearErrors();

        if (!transfer) {
            this.addError('Данные перевода не могут быть пустыми');
            return this.isValid();
        }

        // Валидация суммы
        if (typeof transfer.amount !== 'number' || isNaN(transfer.amount)) {
            this.addError('Сумма перевода должна быть числом');
        } else if (transfer.amount <= 0) {
            this.addError('Сумма перевода должна быть положительной');
        }

        // Валидация отправителя
        if (!transfer.fromUserId || typeof transfer.fromUserId !== 'string') {
            this.addError('ID отправителя должен быть непустой строкой');
        }

        // Валидация получателя
        if (!transfer.toUserId || typeof transfer.toUserId !== 'string') {
            this.addError('ID получателя должен быть непустой строкой');
        }

        // Проверка на самоперевод
        if (transfer.fromUserId === transfer.toUserId) {
            this.addError('Нельзя переводить деньги самому себе');
        }

        // Валидация описания
        if (!transfer.description || typeof transfer.description !== 'string') {
            this.addError('Описание перевода должно быть непустой строкой');
        } else if (transfer.description.trim().length < 3) {
            this.addError('Описание перевода должно содержать минимум 3 символа');
        } else if (transfer.description.trim().length > 100) {
            this.addError('Описание перевода не должно превышать 100 символов');
        }

        return this.isValid();
    }
}

/**
 * Валидатор карты
 */
export class CardValidator extends Validator {
    /**
     * Валидация карты
     * @param {Object} card - Данные карты
     */
    validate(card) {
        this.clearErrors();

        if (!card) {
            this.addError('Карта не может быть пустой');
            return this.isValid();
        }

        // Валидация ID
        if (!card.id || typeof card.id !== 'string') {
            this.addError('ID карты должен быть непустой строкой');
        }

        // Валидация имени
        if (!card.name || typeof card.name !== 'string') {
            this.addError('Имя карты должно быть непустой строкой');
        }

        // Валидация суммы
        if (typeof card.amount !== 'number' || isNaN(card.amount)) {
            this.addError('Сумма карты должна быть числом');
        } else if (card.amount < 0) {
            this.addError('Сумма карты не может быть отрицательной');
        }

        // Валидация типа
        if (!card.type || typeof card.type !== 'string') {
            this.addError('Тип карты должен быть непустой строкой');
        }

        return this.isValid();
    }
}

/**
 * Валидатор движения
 */
export class MovementValidator extends Validator {
    /**
     * Валидация движения
     * @param {Object} movement - Данные движения
     */
    validate(movement) {
        this.clearErrors();

        if (!movement) {
            this.addError('Данные движения не могут быть пустыми');
            return this.isValid();
        }

        // Валидация ID игрока
        if (!movement.playerId || typeof movement.playerId !== 'string') {
            this.addError('ID игрока должен быть непустой строкой');
        }

        // Валидация количества шагов
        if (typeof movement.steps !== 'number' || isNaN(movement.steps)) {
            this.addError('Количество шагов должно быть числом');
        } else if (movement.steps <= 0) {
            this.addError('Количество шагов должно быть положительным');
        } else if (movement.steps > 12) {
            this.addError('Количество шагов не может превышать 12');
        }

        // Валидация трека
        if (movement.track && !['inner', 'outer'].includes(movement.track)) {
            this.addError('Трек должен быть "inner" или "outer"');
        }

        return this.isValid();
    }
}

/**
 * Валидатор конфигурации игры
 */
export class ConfigValidator extends Validator {
    /**
     * Валидация конфигурации
     * @param {Object} config - Конфигурация
     */
    validate(config) {
        this.clearErrors();

        if (!config) {
            this.addError('Конфигурация не может быть пустой');
            return this.isValid();
        }

        // Валидация начального баланса
        if (typeof config.initialBalance !== 'number' || isNaN(config.initialBalance)) {
            this.addError('Начальный баланс должен быть числом');
        } else if (config.initialBalance < 0) {
            this.addError('Начальный баланс не может быть отрицательным');
        }

        // Валидация дохода PAYDAY
        if (typeof config.paydayIncome !== 'number' || isNaN(config.paydayIncome)) {
            this.addError('Доход PAYDAY должен быть числом');
        } else if (config.paydayIncome < 0) {
            this.addError('Доход PAYDAY не может быть отрицательным');
        }

        // Валидация процентной ставки
        if (typeof config.creditInterestRate !== 'number' || isNaN(config.creditInterestRate)) {
            this.addError('Процентная ставка должна быть числом');
        } else if (config.creditInterestRate < 0 || config.creditInterestRate > 1) {
            this.addError('Процентная ставка должна быть между 0 и 1');
        }

        // Валидация множителя кредита
        if (typeof config.creditLimitMultiplier !== 'number' || isNaN(config.creditLimitMultiplier)) {
            this.addError('Множитель кредита должен быть числом');
        } else if (config.creditLimitMultiplier <= 0) {
            this.addError('Множитель кредита должен быть положительным');
        }

        return this.isValid();
    }
}

/**
 * Универсальный валидатор
 */
export class UniversalValidator {
    /**
     * Валидация email
     * @param {string} email - Email
     */
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Валидация URL
     * @param {string} url - URL
     */
    static validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Валидация числа
     * @param {any} value - Значение
     * @param {Object} options - Опции
     */
    static validateNumber(value, options = {}) {
        const { min, max, integer = false, positive = false } = options;
        
        if (typeof value !== 'number' || isNaN(value)) {
            return false;
        }
        
        if (integer && !Number.isInteger(value)) {
            return false;
        }
        
        if (positive && value <= 0) {
            return false;
        }
        
        if (min !== undefined && value < min) {
            return false;
        }
        
        if (max !== undefined && value > max) {
            return false;
        }
        
        return true;
    }

    /**
     * Валидация строки
     * @param {any} value - Значение
     * @param {Object} options - Опции
     */
    static validateString(value, options = {}) {
        const { minLength, maxLength, required = true } = options;
        
        if (typeof value !== 'string') {
            return false;
        }
        
        if (required && value.trim().length === 0) {
            return false;
        }
        
        if (minLength !== undefined && value.length < minLength) {
            return false;
        }
        
        if (maxLength !== undefined && value.length > maxLength) {
            return false;
        }
        
        return true;
    }

    /**
     * Валидация массива
     * @param {any} value - Значение
     * @param {Object} options - Опции
     */
    static validateArray(value, options = {}) {
        const { minLength, maxLength, required = true } = options;
        
        if (!Array.isArray(value)) {
            return false;
        }
        
        if (required && value.length === 0) {
            return false;
        }
        
        if (minLength !== undefined && value.length < minLength) {
            return false;
        }
        
        if (maxLength !== undefined && value.length > maxLength) {
            return false;
        }
        
        return true;
    }

    /**
     * Валидация объекта
     * @param {any} value - Значение
     * @param {Object} options - Опции
     */
    static validateObject(value, options = {}) {
        const { required = true, requiredKeys = [] } = options;
        
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return false;
        }
        
        if (required && Object.keys(value).length === 0) {
            return false;
        }
        
        for (const key of requiredKeys) {
            if (!(key in value)) {
                return false;
            }
        }
        
        return true;
    }
}

// Создание экземпляров валидаторов
export const playerValidator = new PlayerValidator();
export const creditValidator = new CreditValidator();
export const transferValidator = new TransferValidator();
export const cardValidator = new CardValidator();
export const movementValidator = new MovementValidator();
export const configValidator = new ConfigValidator();

export default {
    Validator,
    PlayerValidator,
    CreditValidator,
    TransferValidator,
    CardValidator,
    MovementValidator,
    ConfigValidator,
    UniversalValidator,
    playerValidator,
    creditValidator,
    transferValidator,
    cardValidator,
    movementValidator,
    configValidator
};
