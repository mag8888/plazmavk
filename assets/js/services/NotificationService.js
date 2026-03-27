/**
 * Сервис для работы с push-уведомлениями
 * Обрабатывает уведомления об изменениях баланса и других событиях
 */

export class NotificationService {
    constructor() {
        this.notifications = [];
        this.maxNotifications = 10;
        this.container = null;
        this.init();
    }

    /**
     * Инициализация сервиса уведомлений
     */
    init() {
        this.createContainer();
        this.loadStyles();
        console.log('🔔 NotificationService инициализирован');
    }

    /**
     * Создание контейнера для уведомлений
     */
    createContainer() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }
    }

    /**
     * Загрузка стилей для уведомлений
     */
    loadStyles() {
        if (document.getElementById('notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                pointer-events: none;
            }
            
            .notification {
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                margin-bottom: 10px;
                padding: 16px;
                pointer-events: auto;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                border-left: 4px solid #4CAF50;
                position: relative;
                overflow: hidden;
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification.hide {
                transform: translateX(100%);
                opacity: 0;
            }
            
            .notification.success {
                border-left-color: #4CAF50;
            }
            
            .notification.error {
                border-left-color: #f44336;
            }
            
            .notification.warning {
                border-left-color: #ff9800;
            }
            
            .notification.info {
                border-left-color: #2196F3;
            }
            
            .notification-money {
                border-left-color: #FFD700;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .notification-icon {
                font-size: 24px;
                flex-shrink: 0;
            }
            
            .notification-message {
                flex: 1;
                font-size: 14px;
                line-height: 1.4;
                color: #333;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #999;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s;
            }
            
            .notification-close:hover {
                background-color: #f5f5f5;
                color: #666;
            }
            
            .notification-reason {
                font-size: 12px;
                color: #666;
                margin-top: 4px;
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Отправка push-уведомления
     * @param {string} message - Сообщение
     * @param {string} type - Тип уведомления
     * @param {Object} options - Дополнительные опции
     */
    show(message, type = 'info', options = {}) {
        const notification = {
            id: this.generateId(),
            message,
            type,
            timestamp: Date.now(),
            duration: options.duration || this.getDefaultDuration(type),
            reason: options.reason || '',
            showClose: options.showClose !== false
        };

        this.notifications.push(notification);
        this.render(notification);
        this.cleanup();

        // Автоматическое скрытие
        if (notification.duration > 0) {
            setTimeout(() => {
                this.hide(notification.id);
            }, notification.duration);
        }

        console.log(`🔔 Показано уведомление: ${message} (${type})`);
        return notification.id;
    }

    /**
     * Отображение уведомления
     * @param {Object} notification - Объект уведомления
     */
    render(notification) {
        const element = document.createElement('div');
        element.id = `notification-${notification.id}`;
        element.className = `notification ${notification.type}`;
        
        const icon = this.getIcon(notification.type);
        
        element.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                <div class="notification-message">
                    ${notification.message}
                    ${notification.reason ? `<div class="notification-reason">${notification.reason}</div>` : ''}
                </div>
                ${notification.showClose ? '<button class="notification-close">&times;</button>' : ''}
            </div>
        `;

        // Обработчики событий
        if (notification.showClose) {
            const closeBtn = element.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => {
                this.hide(notification.id);
            });
        }

        // Клик для закрытия
        element.addEventListener('click', () => {
            this.hide(notification.id);
        });

        this.container.appendChild(element);

        // Анимация появления
        setTimeout(() => {
            element.classList.add('show');
        }, 10);
    }

    /**
     * Скрытие уведомления
     * @param {string} id - ID уведомления
     */
    hide(id) {
        const element = document.getElementById(`notification-${id}`);
        if (!element) return;

        element.classList.remove('show');
        element.classList.add('hide');

        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.notifications = this.notifications.filter(n => n.id !== id);
        }, 300);
    }

    /**
     * Скрытие всех уведомлений
     */
    hideAll() {
        this.notifications.forEach(notification => {
            this.hide(notification.id);
        });
    }

    /**
     * Получение иконки для типа уведомления
     * @param {string} type - Тип уведомления
     */
    getIcon(type) {
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
            money: 4000,
            movement: 2000,
            card: 3000,
            bankruptcy: 6000
        };
        return durations[type] || 3000;
    }

    /**
     * Очистка старых уведомлений
     */
    cleanup() {
        if (this.notifications.length > this.maxNotifications) {
            const toRemove = this.notifications.slice(0, this.notifications.length - this.maxNotifications);
            toRemove.forEach(notification => {
                this.hide(notification.id);
            });
        }
    }

    /**
     * Генерация уникального ID
     */
    generateId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Методы для разных типов уведомлений
     */
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    error(message, options = {}) {
        return this.show(message, 'error', options);
    }

    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }

    info(message, options = {}) {
        return this.show(message, 'info', options);
    }

    money(message, options = {}) {
        return this.show(message, 'money', options);
    }

    movement(message, options = {}) {
        return this.show(message, 'movement', options);
    }

    card(message, options = {}) {
        return this.show(message, 'card', options);
    }

    bankruptcy(message, options = {}) {
        return this.show(message, 'bankruptcy', options);
    }

    /**
     * Отправка уведомления об изменении баланса
     * @param {string} username - Имя пользователя
     * @param {number} amount - Сумма изменения
     * @param {string} reason - Причина изменения
     */
    async notifyBalanceChange(username, amount, reason = 'пополнение баланса') {
        try {
            const roomId = window.gameState?.state?.roomId || window.roomId;
            if (!roomId) {
                console.warn('🔔 Нет roomId для отправки уведомления');
                return;
            }

            // Отправляем на сервер
            const response = await fetch('/api/bank/notify/balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Name': username
                },
                body: JSON.stringify({
                    username,
                    roomId,
                    amount,
                    reason
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.money(data.message, { 
                    reason: data.reason,
                    duration: 4000 
                });
            } else {
                console.error('🔔 Ошибка отправки уведомления на сервер');
                // Показываем локально в любом случае
                if (amount >= 0) {
                    this.money(`Ваш счет пополнен на сумму $${amount}`, { 
                        reason,
                        duration: 4000 
                    });
                } else {
                    this.money(`С вашего счета списано $${Math.abs(amount)}`, { 
                        reason,
                        duration: 4000 
                    });
                }
            }
        } catch (error) {
            console.error('🔔 Ошибка отправки уведомления:', error);
            // Показываем локально в любом случае
            if (amount >= 0) {
                this.money(`Ваш счет пополнен на сумму $${amount}`, { 
                    reason,
                    duration: 4000 
                });
            } else {
                this.money(`С вашего счета списано $${Math.abs(amount)}`, { 
                    reason,
                    duration: 4000 
                });
            }
        }
    }

    /**
     * Получение статистики
     */
    getStats() {
        return {
            activeNotifications: this.notifications.length,
            maxNotifications: this.maxNotifications,
            containerExists: !!this.container
        };
    }

    /**
     * Уничтожение сервиса
     */
    destroy() {
        this.hideAll();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        console.log('🗑️ NotificationService уничтожен');
    }
}

// Создаем глобальный экземпляр
window.notificationService = new NotificationService();

export default NotificationService;
