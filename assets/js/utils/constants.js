/**
 * Константы для игры "Энергия денег"
 */

/**
 * Типы событий
 */
export const EVENT_TYPES = {
    // Игровые события
    GAME_START: 'game:start',
    GAME_END: 'game:end',
    GAME_PAUSE: 'game:pause',
    GAME_RESUME: 'game:resume',
    
    // События игроков
    PLAYER_ADDED: 'player:added',
    PLAYER_REMOVED: 'player:removed',
    PLAYER_UPDATED: 'player:updated',
    PLAYER_TURN_STARTED: 'player:turnStarted',
    PLAYER_TURN_ENDED: 'player:turnEnded',
    PLAYER_BALANCE_CHANGED: 'player:balanceChanged',
    PLAYER_MOVED: 'player:moved',
    PLAYER_BANKRUPTED: 'player:bankrupted',
    
    // События доски
    BOARD_INITIALIZED: 'board:initialized',
    CELL_CLICKED: 'cell:clicked',
    CELL_ACTIVATED: 'cell:activated',
    
    // События кубиков
    DICE_ROLLED: 'dice:rolled',
    DICE_ROLL_REQUESTED: 'dice:rollRequested',
    
    // События карт
    CARD_DRAWN: 'card:drawn',
    CARD_PROCESSED: 'card:processed',
    CARD_DRAW_REQUESTED: 'card:drawRequested',
    
    // События движения
    PLAYER_MOVEMENT_START: 'player:movementStart',
    PLAYER_MOVED_TO_OUTER_TRACK: 'player:movedToOuterTrack',
    
    // События банка
    BANK_OPENED: 'bank:opened',
    BANK_CLOSED: 'bank:closed',
    CREDIT_REQUESTED: 'credit:requested',
    CREDIT_GRANTED: 'credit:granted',
    CREDIT_PAID: 'credit:paid',
    TRANSFER_MADE: 'transfer:made',
    
    // События событий
    EVENT_PROCESSED: 'event:processed',
    PAYDAY_EVENT: 'event:payday',
    CHARITY_EVENT: 'event:charity',
    BANKRUPTCY_EVENT: 'event:bankruptcy',
    
    // События состояния
    STATE_UPDATED: 'state:updated',
    STATE_SAVED: 'state:saved',
    STATE_LOADED: 'state:loaded',
    
    // События модулей
    MODULE_LOADED: 'module:loaded',
    MODULES_LOADED: 'modules:loaded',
    MODULE_ERROR: 'module:error',
    
    // События уведомлений
    NOTIFICATION_SHOWN: 'notification:shown',
    NOTIFICATION_HIDDEN: 'notification:hidden',
    
    // События API
    API_REQUEST_START: 'api:requestStart',
    API_REQUEST_SUCCESS: 'api:requestSuccess',
    API_REQUEST_ERROR: 'api:requestError',
    
    // События хранилища
    STORAGE_SAVED: 'storage:saved',
    STORAGE_LOADED: 'storage:loaded',
    STORAGE_ERROR: 'storage:error'
};

/**
 * Типы клеток
 */
export const CELL_TYPES = {
    START: 'start',
    PAYDAY: 'payday',
    CHARITY: 'charity',
    OPPORTUNITY: 'opportunity',
    EXPENSE: 'expense',
    NEUTRAL: 'neutral',
    FAST_TRACK: 'fast-track'
};

/**
 * Типы карт
 */
export const CARD_TYPES = {
    OPPORTUNITY: 'opportunity',
    EXPENSE: 'expense',
    CHARITY: 'charity'
};

/**
 * Типы активов
 */
export const ASSET_TYPES = {
    STOCK: 'stock',
    REAL_ESTATE: 'real_estate',
    BUSINESS: 'business',
    BONDS: 'bonds',
    GOLD: 'gold',
    CRYPTO: 'crypto',
    FRANCHISE: 'franchise',
    PATENT: 'patent',
    STARTUP: 'startup',
    INVESTMENT: 'investment'
};

/**
 * Типы расходов
 */
export const EXPENSE_TYPES = {
    TAX: 'tax',
    MEDICAL: 'medical',
    EDUCATION: 'education',
    REPAIR: 'repair',
    INSURANCE: 'insurance',
    FINE: 'fine',
    CELEBRATION: 'celebration',
    TRAVEL: 'travel',
    PURCHASE: 'purchase',
    SERVICES: 'services'
};

/**
 * Статусы игрока
 */
export const PLAYER_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    BANKRUPT: 'bankrupt',
    FINANCIAL_FREEDOM: 'financial_freedom'
};

/**
 * Статусы кредита
 */
export const CREDIT_STATUS = {
    AVAILABLE: 'available',
    ACTIVE: 'active',
    BLOCKED: 'blocked',
    PAID_OFF: 'paid_off'
};

/**
 * Типы транзакций
 */
export const TRANSACTION_TYPES = {
    PAYDAY: 'payday',
    EXPENSE: 'expense',
    CREDIT_REQUEST: 'credit_request',
    CREDIT_PAYOFF: 'credit_payoff',
    TRANSFER: 'transfer',
    CARD_PURCHASE: 'card_purchase',
    CARD_PAYMENT: 'card_payment',
    CHARITY: 'charity',
    ASSET_INCOME: 'asset_income',
    BANKRUPTCY: 'bankruptcy'
};

/**
 * Типы уведомлений
 */
export const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
    MONEY: 'money',
    MOVEMENT: 'movement',
    CARD: 'card',
    BANKRUPTCY: 'bankruptcy'
};

/**
 * Приоритеты событий
 */
export const EVENT_PRIORITIES = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Цвета игроков
 */
export const PLAYER_COLORS = [
    '#FF6B6B', // Красный
    '#4ECDC4', // Бирюзовый
    '#45B7D1', // Голубой
    '#96CEB4', // Зеленый
    '#FFEAA7', // Желтый
    '#DDA0DD', // Сливовый
    '#98D8C8', // Мятный
    '#F7DC6F', // Золотой
    '#BB8FCE', // Лавандовый
    '#85C1E9'  // Светло-синий
];

/**
 * Иконки для типов клеток
 */
export const CELL_ICONS = {
    [CELL_TYPES.START]: '🏁',
    [CELL_TYPES.PAYDAY]: '💰',
    [CELL_TYPES.CHARITY]: '❤️',
    [CELL_TYPES.OPPORTUNITY]: '📈',
    [CELL_TYPES.EXPENSE]: '📉',
    [CELL_TYPES.NEUTRAL]: '📍',
    [CELL_TYPES.FAST_TRACK]: '🚀'
};

/**
 * Иконки для типов карт
 */
export const CARD_ICONS = {
    [CARD_TYPES.OPPORTUNITY]: '📈',
    [CARD_TYPES.EXPENSE]: '📉',
    [CARD_TYPES.CHARITY]: '❤️'
};

/**
 * Иконки для типов активов
 */
export const ASSET_ICONS = {
    [ASSET_TYPES.STOCK]: '📊',
    [ASSET_TYPES.REAL_ESTATE]: '🏠',
    [ASSET_TYPES.BUSINESS]: '🏢',
    [ASSET_TYPES.BONDS]: '📋',
    [ASSET_TYPES.GOLD]: '🥇',
    [ASSET_TYPES.CRYPTO]: '₿',
    [ASSET_TYPES.FRANCHISE]: '🍔',
    [ASSET_TYPES.PATENT]: '📄',
    [ASSET_TYPES.STARTUP]: '🚀',
    [ASSET_TYPES.INVESTMENT]: '💼'
};

/**
 * Иконки для типов расходов
 */
export const EXPENSE_ICONS = {
    [EXPENSE_TYPES.TAX]: '🏛️',
    [EXPENSE_TYPES.MEDICAL]: '🏥',
    [EXPENSE_TYPES.EDUCATION]: '🎓',
    [EXPENSE_TYPES.REPAIR]: '🔧',
    [EXPENSE_TYPES.INSURANCE]: '🛡️',
    [EXPENSE_TYPES.FINE]: '⚖️',
    [EXPENSE_TYPES.CELEBRATION]: '🎉',
    [EXPENSE_TYPES.TRAVEL]: '✈️',
    [EXPENSE_TYPES.PURCHASE]: '🛒',
    [EXPENSE_TYPES.SERVICES]: '⚙️'
};

/**
 * Сообщения об ошибках
 */
export const ERROR_MESSAGES = {
    PLAYER_NOT_FOUND: 'Игрок не найден',
    INSUFFICIENT_FUNDS: 'Недостаточно средств',
    INVALID_AMOUNT: 'Неверная сумма',
    INVALID_PLAYER: 'Неверные данные игрока',
    INVALID_CREDIT_REQUEST: 'Неверный запрос кредита',
    CREDIT_LIMIT_EXCEEDED: 'Превышен лимит кредита',
    BANKRUPTCY_BLOCKED: 'Кредиты заблокированы из-за банкротства',
    INVALID_TRANSFER: 'Неверные данные перевода',
    SELF_TRANSFER: 'Нельзя переводить деньги самому себе',
    INVALID_CARD: 'Неверные данные карты',
    INVALID_MOVEMENT: 'Неверные данные движения',
    INVALID_CONFIG: 'Неверная конфигурация',
    MODULE_NOT_FOUND: 'Модуль не найден',
    MODULE_INIT_ERROR: 'Ошибка инициализации модуля',
    API_ERROR: 'Ошибка API',
    STORAGE_ERROR: 'Ошибка хранилища',
    NETWORK_ERROR: 'Ошибка сети',
    UNKNOWN_ERROR: 'Неизвестная ошибка'
};

/**
 * Сообщения об успехе
 */
export const SUCCESS_MESSAGES = {
    PLAYER_CREATED: 'Игрок создан',
    PLAYER_UPDATED: 'Игрок обновлен',
    CREDIT_GRANTED: 'Кредит выдан',
    CREDIT_PAID: 'Кредит погашен',
    TRANSFER_COMPLETED: 'Перевод выполнен',
    CARD_PURCHASED: 'Карта приобретена',
    CARD_PAID: 'Карта оплачена',
    MOVEMENT_COMPLETED: 'Движение завершено',
    STATE_SAVED: 'Состояние сохранено',
    STATE_LOADED: 'Состояние загружено',
    MODULE_LOADED: 'Модуль загружен',
    OPERATION_COMPLETED: 'Операция завершена'
};

/**
 * Лимиты игры
 */
export const GAME_LIMITS = {
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 8,
    MIN_BALANCE: 0,
    MAX_BALANCE: 999999999,
    MIN_INCOME: 0,
    MAX_INCOME: 100000,
    MIN_EXPENSES: 0,
    MAX_EXPENSES: 50000,
    MIN_CREDIT: 1000,
    MAX_CREDIT: 1000000,
    MIN_TRANSFER: 1,
    MAX_TRANSFER: 100000,
    MIN_PLAYER_NAME_LENGTH: 2,
    MAX_PLAYER_NAME_LENGTH: 50,
    MAX_TRANSACTION_HISTORY: 1000,
    MAX_NOTIFICATION_HISTORY: 100,
    MAX_MOVEMENT_HISTORY: 500
};

/**
 * Временные интервалы (в миллисекундах)
 */
export const TIME_INTERVALS = {
    SECOND: 1000,
    MINUTE: 60000,
    HOUR: 3600000,
    DAY: 86400000,
    WEEK: 604800000,
    MONTH: 2592000000, // 30 дней
    YEAR: 31536000000  // 365 дней
};

/**
 * Анимации
 */
export const ANIMATION_DURATIONS = {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
    VERY_SLOW: 1000
};

/**
 * Z-индексы
 */
export const Z_INDEXES = {
    MODAL: 10000,
    NOTIFICATION: 9999,
    TOOLTIP: 9998,
    DROPDOWN: 9997,
    OVERLAY: 9996,
    CONTENT: 1,
    BACKGROUND: 0
};

/**
 * Размеры экрана
 */
export const BREAKPOINTS = {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1280,
    LARGE_DESKTOP: 1920
};

/**
 * Ключи localStorage
 */
export const STORAGE_KEYS = {
    GAME_STATE: 'game_state',
    USER_SETTINGS: 'user_settings',
    GAME_HISTORY: 'game_history',
    PLAYER_STATS: 'player_stats',
    ACHIEVEMENTS: 'achievements',
    TEMP_DATA: 'temp_data'
};

/**
 * API эндпоинты
 */
export const API_ENDPOINTS = {
    ROOMS: '/api/rooms',
    USERS: '/api/users',
    CREDITS: '/api/credits',
    TRANSFERS: '/api/transfers',
    TRANSACTIONS: '/api/transactions',
    MESSAGES: '/api/messages',
    HEALTH: '/api/health'
};

/**
 * HTTP статусы
 */
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

/**
 * Типы контента
 */
export const CONTENT_TYPES = {
    JSON: 'application/json',
    FORM_DATA: 'multipart/form-data',
    URL_ENCODED: 'application/x-www-form-urlencoded',
    TEXT: 'text/plain',
    HTML: 'text/html',
    CSS: 'text/css',
    JAVASCRIPT: 'application/javascript'
};

export default {
    EVENT_TYPES,
    CELL_TYPES,
    CARD_TYPES,
    ASSET_TYPES,
    EXPENSE_TYPES,
    PLAYER_STATUS,
    CREDIT_STATUS,
    TRANSACTION_TYPES,
    NOTIFICATION_TYPES,
    EVENT_PRIORITIES,
    PLAYER_COLORS,
    CELL_ICONS,
    CARD_ICONS,
    ASSET_ICONS,
    EXPENSE_ICONS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    GAME_LIMITS,
    TIME_INTERVALS,
    ANIMATION_DURATIONS,
    Z_INDEXES,
    BREAKPOINTS,
    STORAGE_KEYS,
    API_ENDPOINTS,
    HTTP_STATUS,
    CONTENT_TYPES
};
