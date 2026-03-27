/**
 * Центральная система событий для игры "Энергия денег"
 * Обеспечивает связь между модулями через события
 */

export class EventBus {
    constructor() {
        this.events = new Map();
        this.isDestroyed = false;
    }

    /**
     * Инициализация EventBus
     */
    init() {
        console.log('🔌 EventBus инициализирован');
    }

    /**
     * Подписка на событие
     * @param {string} event - Название события
     * @param {Function} callback - Функция обратного вызова
     * @param {Object} options - Опции подписки
     */
    on(event, callback, options = {}) {
        if (this.isDestroyed) {
            console.warn('EventBus уничтожен, подписка невозможна');
            return;
        }

        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const subscription = {
            callback,
            once: options.once || false,
            priority: options.priority || 0,
            context: options.context || null,
            id: this.generateSubscriptionId()
        };

        this.events.get(event).push(subscription);
        
        // Сортировка по приоритету (высокий приоритет = низкий номер)
        this.events.get(event).sort((a, b) => a.priority - b.priority);
    }

    /**
     * Подписка на событие (одноразовая)
     * @param {string} event - Название события
     * @param {Function} callback - Функция обратного вызова
     */
    once(event, callback) {
        this.on(event, callback, { once: true });
    }

    /**
     * Отписка от события
     * @param {string} event - Название события
     * @param {Function} callback - Функция обратного вызова
     */
    off(event, callback) {
        if (!this.events.has(event)) {
            return;
        }

        const subscriptions = this.events.get(event);
        const index = subscriptions.findIndex(sub => sub.callback === callback);
        
        if (index > -1) {
            subscriptions.splice(index, 1);
        }

        // Удаление события, если нет подписчиков
        if (subscriptions.length === 0) {
            this.events.delete(event);
        }
    }

    /**
     * Эмиссия события
     * @param {string} event - Название события
     * @param {*} data - Данные события
     * @param {Object} options - Опции эмиссии
     */
    emit(event, data, options = {}) {
        if (this.isDestroyed) {
            console.warn('EventBus уничтожен, эмиссия невозможна');
            return;
        }

        if (!this.events.has(event)) {
            return;
        }

        const subscriptions = [...this.events.get(event)]; // Копия массива
        const eventData = {
            event,
            data,
            timestamp: Date.now(),
            preventDefault: false,
            stopPropagation: false
        };

        // Вызов всех подписчиков
        for (const subscription of subscriptions) {
            try {
                // Проверка одноразовой подписки
                if (subscription.once) {
                    this.off(event, subscription.callback);
                }

                // Вызов callback с контекстом
                if (subscription.context) {
                    subscription.callback.call(subscription.context, eventData);
                } else {
                    subscription.callback(eventData);
                }

                // Проверка остановки распространения
                if (eventData.stopPropagation) {
                    break;
                }

            } catch (error) {
                console.error(`Ошибка в обработчике события ${event}:`, error);
                
                // Эмиссия события ошибки
                this.emit('error', {
                    event,
                    error,
                    subscription
                });
            }
        }

        // Логирование события (в режиме разработки)
        if (this.config?.debug) {
            console.log(`📡 Событие: ${event}`, data);
        }
    }

    /**
     * Асинхронная эмиссия события
     * @param {string} event - Название события
     * @param {*} data - Данные события
     * @param {Object} options - Опции эмиссии
     */
    async emitAsync(event, data, options = {}) {
        if (this.isDestroyed) {
            console.warn('EventBus уничтожен, эмиссия невозможна');
            return;
        }

        if (!this.events.has(event)) {
            return;
        }

        const subscriptions = [...this.events.get(event)];
        const eventData = {
            event,
            data,
            timestamp: Date.now(),
            preventDefault: false,
            stopPropagation: false
        };

        // Асинхронный вызов всех подписчиков
        for (const subscription of subscriptions) {
            try {
                if (subscription.once) {
                    this.off(event, subscription.callback);
                }

                // Асинхронный вызов
                let result;
                if (subscription.context) {
                    result = await subscription.callback.call(subscription.context, eventData);
                } else {
                    result = await subscription.callback(eventData);
                }

                if (eventData.stopPropagation) {
                    break;
                }

                return result;

            } catch (error) {
                console.error(`Ошибка в асинхронном обработчике события ${event}:`, error);
                
                this.emit('error', {
                    event,
                    error,
                    subscription
                });
            }
        }
    }

    /**
     * Проверка наличия подписчиков на событие
     * @param {string} event - Название события
     */
    hasListeners(event) {
        return this.events.has(event) && this.events.get(event).length > 0;
    }

    /**
     * Получение количества подписчиков на событие
     * @param {string} event - Название события
     */
    getListenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }

    /**
     * Получение списка всех событий
     */
    getEvents() {
        return Array.from(this.events.keys());
    }

    /**
     * Очистка всех подписчиков на событие
     * @param {string} event - Название события
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * Генерация уникального ID для подписки
     */
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Установка конфигурации
     * @param {Object} config - Конфигурация
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }

    /**
     * Уничтожение EventBus
     */
    destroy() {
        this.events.clear();
        this.isDestroyed = true;
        console.log('🗑️ EventBus уничтожен');
    }
}

export default EventBus;
