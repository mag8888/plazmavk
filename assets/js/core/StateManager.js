/**
 * StateManager - управление состоянием приложения
 */
class StateManager {
    constructor() {
        this.state = new Map();
        this.subscribers = new Map();
        this.history = [];
        this.maxHistorySize = 50;
    }

    /**
     * Установка состояния
     */
    setState(key, value, options = {}) {
        const oldValue = this.state.get(key);
        
        // Сохраняем в историю
        if (options.saveHistory !== false) {
            this.history.push({
                key,
                oldValue,
                newValue: value,
                timestamp: Date.now()
            });

            // Ограничиваем размер истории
            if (this.history.length > this.maxHistorySize) {
                this.history.shift();
            }
        }

        this.state.set(key, value);

        // Уведомляем подписчиков
        this.notifySubscribers(key, value, oldValue);

        return value;
    }

    /**
     * Получение состояния
     */
    getState(key, defaultValue = null) {
        return this.state.has(key) ? this.state.get(key) : defaultValue;
    }

    /**
     * Проверка существования ключа
     */
    hasState(key) {
        return this.state.has(key);
    }

    /**
     * Удаление состояния
     */
    removeState(key) {
        const oldValue = this.state.get(key);
        this.state.delete(key);
        this.notifySubscribers(key, null, oldValue);
        return oldValue;
    }

    /**
     * Получение всего состояния
     */
    getAllState() {
        return Object.fromEntries(this.state);
    }

    /**
     * Подписка на изменения состояния
     */
    subscribe(key, callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }

        const subscriber = {
            callback,
            once: options.once || false,
            id: Date.now() + Math.random()
        };

        this.subscribers.get(key).push(subscriber);
        return subscriber.id;
    }

    /**
     * Отписка от изменений
     */
    unsubscribe(key, subscriberId) {
        if (!this.subscribers.has(key)) return false;

        const subscribers = this.subscribers.get(key);
        const index = subscribers.findIndex(s => s.id === subscriberId);
        
        if (index === -1) return false;
        
        subscribers.splice(index, 1);
        return true;
    }

    /**
     * Уведомление подписчиков
     */
    notifySubscribers(key, newValue, oldValue) {
        if (!this.subscribers.has(key)) return;

        const subscribers = this.subscribers.get(key).slice();
        const toRemove = [];

        for (const subscriber of subscribers) {
            try {
                subscriber.callback(newValue, oldValue, key);
                
                if (subscriber.once) {
                    toRemove.push(subscriber.id);
                }
            } catch (error) {
                console.error(`Error in state subscriber for ${key}:`, error);
            }
        }

        // Удаляем одноразовые подписчики
        toRemove.forEach(id => this.unsubscribe(key, id));
    }

    /**
     * Сброс состояния
     */
    reset() {
        this.state.clear();
        this.subscribers.clear();
        this.history = [];
    }

    /**
     * Получение истории изменений
     */
    getHistory(key = null) {
        if (key) {
            return this.history.filter(entry => entry.key === key);
        }
        return this.history.slice();
    }

    /**
     * Откат к предыдущему состоянию
     */
    undo() {
        if (this.history.length === 0) return false;

        const lastChange = this.history.pop();
        this.setState(lastChange.key, lastChange.oldValue, { saveHistory: false });
        return true;
    }
}

// Экспорт в window для глобального доступа
window.StateManager = StateManager;