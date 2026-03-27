/**
 * Компонент уведомлений для игры "Энергия денег"
 * Управляет отображением уведомлений пользователю
 */

export class Notifications {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.container = null;
        this.notifications = new Map();
        this.maxNotifications = 5;
        this.isDestroyed = false;
    }

    /**
     * Инициализация компонента уведомлений
     */
    async init() {
        console.log('🔔 Notifications компонент инициализирован');
        
        // Создание контейнера уведомлений
        this.createContainer();
        
        // Подписка на события
        this.gameCore.eventBus.on('playerBalanceChanged', this.onPlayerBalanceChanged.bind(this));
        this.gameCore.eventBus.on('playerMoved', this.onPlayerMoved.bind(this));
        this.gameCore.eventBus.on('cardDrawn', this.onCardDrawn.bind(this));
        this.gameCore.eventBus.on('playerBankrupted', this.onPlayerBankrupted.bind(this));
        this.gameCore.eventBus.on('eventProcessed', this.onEventProcessed.bind(this));
    }

    /**
     * Создание контейнера уведомлений
     */
    createContainer() {
        // Проверка существования контейнера
        this.container = document.getElementById('notifications');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notifications';
            this.container.className = 'notifications';
            document.body.appendChild(this.container);
        }
    }

    /**
     * Показ уведомления
     * @param {string} message - Сообщение
     * @param {string} type - Тип уведомления
     * @param {Object} options - Опции
     */
    show(message, type = 'info', options = {}) {
        if (this.isDestroyed) {
            console.warn('Notifications уничтожены, показ невозможен');
            return null;
        }

        const notificationId = this.generateNotificationId();
        const duration = options.duration || this.getDefaultDuration(type);
        
        // Создание элемента уведомления
        const notification = this.createNotificationElement(notificationId, message, type, options);
        
        // Добавление в контейнер
        this.container.appendChild(notification);
        this.notifications.set(notificationId, notification);
        
        // Анимация появления
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Автоматическое скрытие
        if (duration > 0) {
            setTimeout(() => {
                this.hide(notificationId);
            }, duration);
        }
        
        // Удаление старых уведомлений
        this.cleanupOldNotifications();
        
        console.log(`🔔 Уведомление показано: ${message} (${type})`);
        
        return notificationId;
    }

    /**
     * Создание элемента уведомления
     * @param {string} id - ID уведомления
     * @param {string} message - Сообщение
     * @param {string} type - Тип уведомления
     * @param {Object} options - Опции
     */
    createNotificationElement(id, message, type, options) {
        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `notification notification-${type}`;
        
        // Иконка для типа уведомления
        const icon = this.getNotificationIcon(type);
        
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                <div class="notification-message">${message}</div>
                ${options.showClose ? '<button class="notification-close">&times;</button>' : ''}
            </div>
        `;
        
        // Привязка событий
        if (options.showClose) {
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => {
                this.hide(id);
            });
        }
        
        // Клик для закрытия
        if (options.clickToClose !== false) {
            notification.addEventListener('click', () => {
                this.hide(id);
            });
        }
        
        return notification;
    }

    /**
     * Получение иконки для типа уведомления
     * @param {string} type - Тип уведомления
     */
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            money: '💰',
            movement: '🚶',
            card: '🃏',
            bankruptcy: '💸'
        };
        
        return icons[type] || 'ℹ️';
    }

    /**
     * Получение длительности по умолчанию
     * @param {string} type - Тип уведомления
     */
    getDefaultDuration(type) {
        const durations = {
            success: 3000,
            error: 5000,
            warning: 4000,
            info: 3000,
            money: 2000,
            movement: 1500,
            card: 2500,
            bankruptcy: 6000
        };
        
        return durations[type] || 3000;
    }

    /**
     * Скрытие уведомления
     * @param {string} notificationId - ID уведомления
     */
    hide(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (!notification) {
            return;
        }
        
        // Анимация скрытия
        notification.classList.remove('show');
        notification.classList.add('hide');
        
        // Удаление после анимации
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.notifications.delete(notificationId);
        }, 300);
    }

    /**
     * Скрытие всех уведомлений
     */
    hideAll() {
        this.notifications.forEach((notification, id) => {
            this.hide(id);
        });
    }

    /**
     * Очистка старых уведомлений
     */
    cleanupOldNotifications() {
        if (this.notifications.size > this.maxNotifications) {
            const notificationsToRemove = Array.from(this.notifications.keys())
                .slice(0, this.notifications.size - this.maxNotifications);
            
            notificationsToRemove.forEach(id => {
                this.hide(id);
            });
        }
    }

    /**
     * Генерация ID уведомления
     */
    generateNotificationId() {
        return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Показ уведомления об успехе
     * @param {string} message - Сообщение
     * @param {Object} options - Опции
     */
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    /**
     * Показ уведомления об ошибке
     * @param {string} message - Сообщение
     * @param {Object} options - Опции
     */
    error(message, options = {}) {
        return this.show(message, 'error', options);
    }

    /**
     * Показ предупреждения
     * @param {string} message - Сообщение
     * @param {Object} options - Опции
     */
    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }

    /**
     * Показ информационного уведомления
     * @param {string} message - Сообщение
     * @param {Object} options - Опции
     */
    info(message, options = {}) {
        return this.show(message, 'info', options);
    }

    /**
     * Показ уведомления о деньгах
     * @param {string} message - Сообщение
     * @param {Object} options - Опции
     */
    money(message, options = {}) {
        return this.show(message, 'money', options);
    }

    /**
     * Показ уведомления о движении
     * @param {string} message - Сообщение
     * @param {Object} options - Опции
     */
    movement(message, options = {}) {
        return this.show(message, 'movement', options);
    }

    /**
     * Показ уведомления о карте
     * @param {string} message - Сообщение
     * @param {Object} options - Опции
     */
    card(message, options = {}) {
        return this.show(message, 'card', options);
    }

    /**
     * Показ уведомления о банкротстве
     * @param {string} message - Сообщение
     * @param {Object} options - Опции
     */
    bankruptcy(message, options = {}) {
        return this.show(message, 'bankruptcy', options);
    }

    /**
     * Обработчики событий
     */
    onPlayerBalanceChanged(data) {
        const amount = data.amount;
        const type = amount > 0 ? 'success' : 'error';
        const sign = amount > 0 ? '+' : '';
        const message = `${sign}$${amount.toLocaleString()} - ${data.description}`;
        
        this.money(message, { duration: 2000 });
    }

    onPlayerMoved(data) {
        const message = `Перемещение на позицию ${data.to.position}`;
        this.movement(message, { duration: 1500 });
    }

    onCardDrawn(data) {
        const message = `Взята карта: ${data.card.name}`;
        this.card(message, { duration: 2500 });
    }

    onPlayerBankrupted(data) {
        const message = `Игрок ${data.player.name} обанкротился`;
        this.bankruptcy(message, { duration: 6000 });
    }

    onEventProcessed(data) {
        if (data.result.success) {
            this.success(data.result.message, { duration: 3000 });
        } else {
            this.error(data.result.message, { duration: 5000 });
        }
    }

    /**
     * Получение статистики
     */
    getStats() {
        return {
            activeNotifications: this.notifications.size,
            maxNotifications: this.maxNotifications,
            containerExists: !!this.container
        };
    }

    /**
     * Уничтожение компонента уведомлений
     */
    destroy() {
        this.hideAll();
        this.notifications.clear();
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.container = null;
        this.isDestroyed = true;
        console.log('🗑️ Notifications компонент уничтожен');
    }
}

export default Notifications;
