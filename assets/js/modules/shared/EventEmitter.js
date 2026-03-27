// Проверяем, не загружен ли уже модуль
if (window.EventEmitter) {
    console.log('EventEmitter уже загружен, пропускаем повторную загрузку');
} else {

class EventEmitter {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    once(event, callback) {
        const off = this.on(event, (payload) => {
            off();
            callback(payload);
        });
        return off;
    }

    off(event, callback) {
        if (!this.listeners.has(event)) {
            return;
        }
        const bucket = this.listeners.get(event);
        bucket.delete(callback);
        if (bucket.size === 0) {
            this.listeners.delete(event);
        }
    }

    emit(event, payload) {
        if (!this.listeners.has(event)) {
            return;
        }
        for (const callback of [...this.listeners.get(event)]) {
            try {
                callback(payload);
            } catch (error) {
                console.error(`[EventEmitter] listener error for ${event}:`, error);
            }
        }
    }

    clear() {
        this.listeners.clear();
    }
}

window.EventEmitter = EventEmitter;

} // Конец блока else для проверки существования модуля
