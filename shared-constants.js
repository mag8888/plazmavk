/**
 * Общие константы для всего приложения
 * Централизованное хранение всех магических чисел и строковых констант
 */

// Финансовые константы
const FINANCIAL_CONSTANTS = {
    STARTING_BALANCE: 10000,
    DEFAULT_SALARY: 10000,
    DEFAULT_EXPENSES: 6200,
    DEFAULT_CASH_FLOW: 3800,
    CREDIT_STEP: 1000,
    MAX_CREDIT: 50000,
    MIN_TRANSFER_AMOUNT: 1,
    MAX_TRANSFER_AMOUNT: 1000000
};

// Строковые константы
const STRING_CONSTANTS = {
    STARTING_SAVINGS: "Стартовые сбережения",
    TRANSFER_TO_PLAYER: "Перевод игроку",
    TRANSFER_FROM_PLAYER: "Перевод от игрока",
    TRANSFER_SUCCESS: "Перевод выполнен успешно!",
    INSUFFICIENT_FUNDS: "Недостаточно средств для перевода",
    INVALID_AMOUNT: "Неверная сумма перевода",
    PLAYER_NOT_FOUND: "Игрок не найден",
    ROOM_NOT_FOUND: "Комната не найдена"
};

// Игровые константы
const GAME_CONSTANTS = {
    MAX_PLAYERS: 6,
    TURN_DURATION: 120, // секунды
    DICE_SIDES: 6,
    TRACK_CELLS: 24,
    BIG_CIRCLE_CELLS: 12
};

// API константы
const API_CONSTANTS = {
    BASE_URL: "/api",
    ROOMS_ENDPOINT: "/api/rooms",
    AUTH_ENDPOINT: "/api/auth",
    TRANSFER_ENDPOINT: "/api/rooms/:id/transfer",
    CREDIT_ENDPOINT: "/api/rooms/:id/credit"
};

// UI константы
const UI_CONSTANTS = {
    ANIMATION_DURATION: 1000,
    NOTIFICATION_DURATION: 3000,
    LOADING_TIMEOUT: 10000,
    DEBOUNCE_DELAY: 300
};

// Экспорт для использования в браузере
if (typeof window !== 'undefined') {
    window.FINANCIAL_CONSTANTS = FINANCIAL_CONSTANTS;
    window.STRING_CONSTANTS = STRING_CONSTANTS;
    window.GAME_CONSTANTS = GAME_CONSTANTS;
    window.API_CONSTANTS = API_CONSTANTS;
    window.UI_CONSTANTS = UI_CONSTANTS;
}

// Экспорт для Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FINANCIAL_CONSTANTS,
        STRING_CONSTANTS,
        GAME_CONSTANTS,
        API_CONSTANTS,
        UI_CONSTANTS
    };
}
