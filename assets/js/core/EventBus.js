/**
 * EventBus - система событий для микромодульной архитектуры
 */
class EventBus {
    constructor() {
        this.events = new Map();
        this.maxListeners = 100;
    }

    /**
     * Подписка на событие
     * @param {string} event - название события
     * @param {Function} callback - функция обратного вызова
     * @param {Object} options - опции (once, priority)
     */
    on(event, callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listeners = this.events.get(event);
        
        if (listeners.length >= this.maxListeners) {
            console.warn(`Max listeners (${this.maxListeners}) exceeded for event: ${event}`);
        }

        const listener = {
            callback,
            once: options.once || false,
            priority: options.priority || 0,
            id: Date.now() + Math.random()
        };

        listeners.push(listener);
        listeners.sort((a, b) => b.priority - a.priority);

        return listener.id;
    }

    /**
     * Подписка на событие (только один раз)
     */
    once(event, callback, options = {}) {
        return this.on(event, callback, { ...options, once: true });
    }

    /**
     * Отписка от события
     */
    off(event, listenerId) {
        if (!this.events.has(event)) return false;

        const listeners = this.events.get(event);
        const index = listeners.findIndex(l => l.id === listenerId);
        
        if (index === -1) return false;
        
        listeners.splice(index, 1);
        return true;
    }

    /**
     * Эмиссия события
     */
    emit(event, ...args) {
        if (!this.events.has(event)) return false;

        const listeners = this.events.get(event).slice(); // копия массива
        const toRemove = [];

        for (const listener of listeners) {
            try {
                listener.callback(...args);
                
                if (listener.once) {
                    toRemove.push(listener.id);
                }
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        }

        // Удаляем одноразовые слушатели
        toRemove.forEach(id => this.off(event, id));

        return true;
    }

    /**
     * Удаление всех слушателей события
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * Получение количества слушателей
     */
    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }

    /**
     * Получение списка событий
     */
    eventNames() {
        return Array.from(this.events.keys());
    }
}

// Экспорт в window для глобального доступа
window.EventBus = EventBus;
