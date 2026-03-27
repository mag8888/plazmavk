export default class NotificationCenter {
    constructor(element) {
        this.element = element;
        this.timer = null;
    }

    show(message, { type = 'info', timeout = 4000 } = {}) {
        if (!this.element) {
            console.log('[Notification]', message);
            return;
        }
        this.element.textContent = message;
        this.element.dataset.type = type;
        this.element.classList.add('visible');
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => this.hide(), timeout);
    }

    hide() {
        if (!this.element) {
            return;
        }
        this.element.classList.remove('visible');
        this.element.textContent = '';
    }
}
