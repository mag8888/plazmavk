/**
 * Push Notification Service
 * Система push-уведомлений для критических изменений в игре
 * VERSION: 1.0
 */

export class PushNotificationService {
    constructor() {
        console.log('🔔 PushNotificationService: Инициализация');
        this.listeners = new Map();
        this.isEnabled = true;
        this.debounceTimers = new Map();
        this.DEBOUNCE_DELAY = 2000; // 2 секунды задержки
    }

    /**
     * Включает/выключает push-уведомления
     * @param {boolean} enabled - Включить уведомления
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`🔔 PushNotificationService: Уведомления ${enabled ? 'включены' : 'выключены'}`);
    }

    /**
     * Подписывается на событие
     * @param {string} event - Название события
     * @param {Function} callback - Функция обратного вызова
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Отписывается от события
     * @param {string} event - Название события
     * @param {Function} callback - Функция обратного вызова
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * Отправляет push-уведомление
     * @param {string} event - Название события
     * @param {Object} data - Данные события
     * @param {boolean} debounced - Использовать debounce
     */
    emit(event, data, debounced = false) {
        if (!this.isEnabled) return;

        if (debounced) {
            this.emitDebounced(event, data);
        } else {
            this.emitImmediate(event, data);
        }
    }

    /**
     * Немедленная отправка события
     * @param {string} event - Название события
     * @param {Object} data - Данные события
     */
    emitImmediate(event, data) {
        console.log(`🔔 PushNotificationService: Событие "${event}"`, data);
        
        if (!this.listeners.has(event)) return;
        
        this.listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`❌ PushNotificationService: Ошибка в callback для события "${event}":`, error);
            }
        });
    }

    /**
     * Debounced отправка события
     * @param {string} event - Название события
     * @param {Object} data - Данные события
     */
    emitDebounced(event, data) {
        const timerKey = event;
        
        // Очищаем предыдущий таймер
        if (this.debounceTimers.has(timerKey)) {
            clearTimeout(this.debounceTimers.get(timerKey));
        }
        
        // Устанавливаем новый таймер
        const timer = setTimeout(() => {
            this.emitImmediate(event, data);
            this.debounceTimers.delete(timerKey);
        }, this.DEBOUNCE_DELAY);
        
        this.debounceTimers.set(timerKey, timer);
    }

    /**
     * Отправляет уведомление о критическом изменении баланса
     * @param {Object} data - Данные о балансе
     */
    emitBalanceChange(data) {
        this.emit('balanceChanged', data, true); // Debounced
    }

    /**
     * Отправляет уведомление о смене хода
     * @param {Object} data - Данные о ходе
     */
    emitTurnChange(data) {
        this.emit('turnChanged', data, false); // Немедленно
    }

    /**
     * Отправляет уведомление о покупке актива
     * @param {Object} data - Данные о покупке
     */
    emitAssetPurchase(data) {
        this.emit('assetPurchased', data, false); // Немедленно
    }

    /**
     * Отправляет уведомление о переводе средств
     * @param {Object} data - Данные о переводе
     */
    emitTransfer(data) {
        this.emit('transferCompleted', data, false); // Немедленно
    }

    /**
     * Отправляет уведомление о банкротстве
     * @param {Object} data - Данные о банкротстве
     */
    emitBankruptcy(data) {
        this.emit('playerBankrupt', data, false); // Немедленно
    }

    /**
     * Отправляет уведомление о завершении игры
     * @param {Object} data - Данные о завершении
     */
    emitGameEnd(data) {
        this.emit('gameEnded', data, false); // Немедленно
    }

    /**
     * Очищает все таймеры
     */
    cleanup() {
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        this.listeners.clear();
        console.log('🔔 PushNotificationService: Очистка завершена');
    }
}

// Создаем глобальный экземпляр
window.pushNotificationService = new PushNotificationService();

// Экспортируем для модулей
export default window.pushNotificationService;
