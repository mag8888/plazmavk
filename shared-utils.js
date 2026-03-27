/**
 * Общие утилиты для всего приложения
 * Централизованные функции, используемые в разных модулях
 */

/**
 * Получает ID комнаты из URL
 * @returns {string|null} ID комнаты или null
 */
function getRoomIdFromURL() {
    try {
        const href = window.location.href;
        const urlParams = new URLSearchParams(window.location.search);
        // Поддерживаем оба имени параметра: room и room_id
        let roomId = urlParams.get('room') || urlParams.get('room_id');
        let source = 'query';
        
        // Если нет в query, пробуем путь /room/<24hex> или /table/<24hex>
        if (!roomId) {
            const pathMatch = window.location.pathname.match(/\/(?:room|table)\/([0-9a-fA-F]{24})/);
            if (pathMatch && pathMatch[1]) {
                roomId = pathMatch[1];
                source = 'path';
            }
        }
        
        // Если всё ещё нет, пробуем найти любую 24-hex строку в href
        if (!roomId) {
            const anyHex = href.match(/[0-9a-fA-F]{24}/);
            if (anyHex) {
                roomId = anyHex[0];
                source = 'href-hex';
            }
        }
        
        // Fallback: localStorage
        if (!roomId) {
            const saved = localStorage.getItem('lastRoomId');
            if (saved) {
                roomId = saved;
                source = 'localStorage';
                // Поддерживаем единый параметр room в URL
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('room', roomId);
                window.history.replaceState({}, '', newUrl.toString());
            }
        }
        
        if (roomId === 'undefined' || roomId === 'null' || roomId === '') {
            roomId = null;
        }
        
        console.log('Room ID detection (utils):', { source, value: roomId });
        return roomId;
    } catch (error) {
        console.error('Error getting room ID from URL:', error);
        return null;
    }
}

/**
 * Получает индекс текущего игрока
 * @returns {number} Индекс текущего игрока
 */
function getCurrentPlayerIndex() {
    try {
        const user = localStorage.getItem('user');
        if (!user) return 0;
        
        const userData = JSON.parse(user);
        return userData.player_index || 0;
    } catch (error) {
        console.error('Error getting current player index:', error);
        return 0;
    }
}

/**
 * Показывает уведомление пользователю
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип уведомления (success, error, info, warning)
 * @param {number} duration - Длительность показа в миллисекундах
 */
function showNotification(message, type = 'info', duration = 3000) {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Стили для уведомления
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 300px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease-in-out;
    `;
    
    // Цвета в зависимости от типа
    const colors = {
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Добавляем в DOM
    document.body.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Удаляем через указанное время
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

/**
 * Показывает индикатор загрузки
 * @param {string} message - Сообщение загрузки
 */
function showLoadingIndicator(message = 'Загрузка...') {
    let indicator = document.getElementById('loadingIndicator');
    
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'loadingIndicator';
        indicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            color: white;
            font-size: 18px;
        `;
        document.body.appendChild(indicator);
    }
    
    indicator.innerHTML = `
        <div style="text-align: center;">
            <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <div>${message}</div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    indicator.style.display = 'flex';
}

/**
 * Скрывает индикатор загрузки
 */
function hideLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

/**
 * Показывает сообщение об ошибке
 * @param {string} message - Текст ошибки
 */
function showError(message) {
    showNotification(message, 'error');
}

/**
 * Показывает сообщение об успехе
 * @param {string} message - Текст сообщения
 */
function showSuccess(message) {
    showNotification(message, 'success');
}

/**
 * Показывает предупреждение
 * @param {string} message - Текст предупреждения
 */
function showWarning(message) {
    showNotification(message, 'warning');
}

/**
 * Форматирует число как валюту
 * @param {number} amount - Сумма
 * @param {string} currency - Валюта (по умолчанию $)
 * @returns {string} Отформатированная строка
 */
function formatCurrency(amount, currency = '$') {
    return `${currency}${amount.toLocaleString()}`;
}

/**
 * Форматирует время в минуты и секунды
 * @param {number} seconds - Количество секунд
 * @returns {string} Отформатированное время (MM:SS)
 */
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Дебаунс функция для ограничения частоты вызовов
 * @param {Function} func - Функция для дебаунса
 * @param {number} delay - Задержка в миллисекундах
 * @returns {Function} Дебаунсированная функция
 */
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Проверяет, является ли строка валидным ID
 * @param {string} id - ID для проверки
 * @returns {boolean} true если ID валиден
 */
function isValidId(id) {
    return id && typeof id === 'string' && id.length > 0;
}

/**
 * Безопасно парсит JSON
 * @param {string} jsonString - JSON строка
 * @param {*} defaultValue - Значение по умолчанию
 * @returns {*} Распарсенный объект или значение по умолчанию
 */
function safeJsonParse(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        return defaultValue;
    }
}

// Экспорт для использования в браузере
if (typeof window !== 'undefined') {
    window.getRoomIdFromURL = getRoomIdFromURL;
    window.getCurrentPlayerIndex = getCurrentPlayerIndex;
    window.showNotification = showNotification;
    window.showLoadingIndicator = showLoadingIndicator;
    window.hideLoadingIndicator = hideLoadingIndicator;
    window.showError = showError;
    window.showSuccess = showSuccess;
    window.showWarning = showWarning;
    window.formatCurrency = formatCurrency;
    window.formatTime = formatTime;
    window.debounce = debounce;
    window.isValidId = isValidId;
    window.safeJsonParse = safeJsonParse;
}
