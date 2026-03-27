/**
 * Вспомогательные функции для игры "Энергия денег"
 */

/**
 * Форматирование денежных сумм
 * @param {number} amount - Сумма
 * @param {string} currency - Валюта
 * @param {string} locale - Локаль
 */
export function formatMoney(amount, currency = 'USD', locale = 'ru-RU') {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return '$0';
    }
    
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Форматирование чисел с разделителями
 * @param {number} number - Число
 * @param {string} locale - Локаль
 */
export function formatNumber(number, locale = 'ru-RU') {
    if (typeof number !== 'number' || isNaN(number)) {
        return '0';
    }
    
    return new Intl.NumberFormat(locale).format(number);
}

/**
 * Форматирование времени
 * @param {number|Date} timestamp - Временная метка или дата
 * @param {string} locale - Локаль
 */
export function formatTime(timestamp, locale = 'ru-RU') {
    const date = new Date(timestamp);
    
    return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date);
}

/**
 * Форматирование даты
 * @param {number|Date} timestamp - Временная метка или дата
 * @param {string} locale - Локаль
 */
export function formatDate(timestamp, locale = 'ru-RU') {
    const date = new Date(timestamp);
    
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

/**
 * Форматирование относительного времени
 * @param {number|Date} timestamp - Временная метка или дата
 * @param {string} locale - Локаль
 */
export function formatRelativeTime(timestamp, locale = 'ru-RU') {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) {
        return 'только что';
    } else if (diffMinutes < 60) {
        return `${diffMinutes} мин. назад`;
    } else if (diffHours < 24) {
        return `${diffHours} ч. назад`;
    } else if (diffDays < 7) {
        return `${diffDays} дн. назад`;
    } else {
        return formatDate(timestamp, locale);
    }
}

/**
 * Генерация уникального ID
 * @param {string} prefix - Префикс
 */
export function generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Генерация случайного числа в диапазоне
 * @param {number} min - Минимум
 * @param {number} max - Максимум
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Генерация случайного элемента из массива
 * @param {Array} array - Массив
 */
export function randomChoice(array) {
    if (!Array.isArray(array) || array.length === 0) {
        return null;
    }
    
    return array[randomInt(0, array.length - 1)];
}

/**
 * Перемешивание массива (Fisher-Yates)
 * @param {Array} array - Массив
 */
export function shuffleArray(array) {
    const shuffled = [...array];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomInt(0, i);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
}

/**
 * Глубокое копирование объекта
 * @param {any} obj - Объект для копирования
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    if (typeof obj === 'object') {
        const cloned = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = deepClone(obj[key]);
        });
        return cloned;
    }
    
    return obj;
}

/**
 * Объединение объектов
 * @param {Object} target - Целевой объект
 * @param {...Object} sources - Источники
 */
export function mergeObjects(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();
    
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeObjects(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    
    return mergeObjects(target, ...sources);
}

/**
 * Проверка, является ли значение объектом
 * @param {any} item - Значение
 */
export function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Дебаунс функции
 * @param {Function} func - Функция
 * @param {number} wait - Задержка в миллисекундах
 * @param {boolean} immediate - Выполнить немедленно
 */
export function debounce(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) func.apply(this, args);
    };
}

/**
 * Троттлинг функции
 * @param {Function} func - Функция
 * @param {number} limit - Лимит в миллисекундах
 */
export function throttle(func, limit) {
    let inThrottle;
    
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Задержка выполнения
 * @param {number} ms - Миллисекунды
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Проверка на мобильное устройство
 */
export function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Проверка на сенсорное устройство
 */
export function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Получение размера экрана
 */
export function getScreenSize() {
    return {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: isMobile(),
        isTouch: isTouchDevice()
    };
}

/**
 * Копирование текста в буфер обмена
 * @param {string} text - Текст для копирования
 */
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    } catch (error) {
        console.error('Ошибка копирования в буфер обмена:', error);
        return false;
    }
}

/**
 * Скачивание файла
 * @param {string} content - Содержимое файла
 * @param {string} filename - Имя файла
 * @param {string} mimeType - MIME тип
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    try {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        return true;
    } catch (error) {
        console.error('Ошибка скачивания файла:', error);
        return false;
    }
}

/**
 * Получение параметров URL
 * @param {string} url - URL (по умолчанию текущий)
 */
export function getUrlParams(url = window.location.href) {
    const params = new URLSearchParams(new URL(url).search);
    const result = {};
    
    for (const [key, value] of params) {
        result[key] = value;
    }
    
    return result;
}

/**
 * Установка параметров URL
 * @param {Object} params - Параметры
 * @param {boolean} replace - Заменить историю
 */
export function setUrlParams(params, replace = true) {
    const url = new URL(window.location);
    
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.set(key, params[key]);
        } else {
            url.searchParams.delete(key);
        }
    });
    
    if (replace) {
        window.history.replaceState({}, '', url);
    } else {
        window.history.pushState({}, '', url);
    }
}

/**
 * Валидация email
 * @param {string} email - Email
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Валидация URL
 * @param {string} url - URL
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Обрезка текста
 * @param {string} text - Текст
 * @param {number} maxLength - Максимальная длина
 * @param {string} suffix - Суффикс
 */
export function truncateText(text, maxLength, suffix = '...') {
    if (!text || text.length <= maxLength) {
        return text;
    }
    
    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Капитализация первой буквы
 * @param {string} text - Текст
 */
export function capitalize(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Преобразование в camelCase
 * @param {string} text - Текст
 */
export function toCamelCase(text) {
    return text.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
}

/**
 * Преобразование в kebab-case
 * @param {string} text - Текст
 */
export function toKebabCase(text) {
    return text
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}

/**
 * Преобразование в snake_case
 * @param {string} text - Текст
 */
export function toSnakeCase(text) {
    return text
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}

/**
 * Получение случайного цвета
 * @param {string} type - Тип цвета (hex, rgb, hsl)
 */
export function getRandomColor(type = 'hex') {
    const hue = Math.random() * 360;
    
    switch (type) {
        case 'rgb':
            return `rgb(${randomInt(0, 255)}, ${randomInt(0, 255)}, ${randomInt(0, 255)})`;
        case 'hsl':
            return `hsl(${hue}, 70%, 50%)`;
        case 'hex':
        default:
            return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    }
}

/**
 * Получение контрастного цвета
 * @param {string} hexColor - HEX цвет
 */
export function getContrastColor(hexColor) {
    // Удаление # если есть
    const hex = hexColor.replace('#', '');
    
    // Конвертация в RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Расчет яркости
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    return brightness > 128 ? '#000000' : '#FFFFFF';
}

/**
 * Логирование с временной меткой
 * @param {string} level - Уровень логирования
 * @param {any} message - Сообщение
 * @param {...any} args - Дополнительные аргументы
 */
export function log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    switch (level.toLowerCase()) {
        case 'error':
            console.error(prefix, message, ...args);
            break;
        case 'warn':
            console.warn(prefix, message, ...args);
            break;
        case 'info':
            console.info(prefix, message, ...args);
            break;
        case 'debug':
            console.debug(prefix, message, ...args);
            break;
        default:
            console.log(prefix, message, ...args);
    }
}

/**
 * Создание обработчика ошибок
 * @param {string} context - Контекст
 */
export function createErrorHandler(context) {
    return (error, additionalInfo = {}) => {
        log('error', `${context}: ${error.message}`, {
            error,
            context,
            additionalInfo,
            stack: error.stack
        });
    };
}

export default {
    formatMoney,
    formatNumber,
    formatTime,
    formatDate,
    formatRelativeTime,
    generateId,
    randomInt,
    randomChoice,
    shuffleArray,
    deepClone,
    mergeObjects,
    isObject,
    debounce,
    throttle,
    delay,
    isMobile,
    isTouchDevice,
    getScreenSize,
    copyToClipboard,
    downloadFile,
    getUrlParams,
    setUrlParams,
    isValidEmail,
    isValidUrl,
    truncateText,
    capitalize,
    toCamelCase,
    toKebabCase,
    toSnakeCase,
    getRandomColor,
    getContrastColor,
    log,
    createErrorHandler
};
