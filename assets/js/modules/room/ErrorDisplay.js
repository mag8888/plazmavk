// Проверяем, не загружен ли уже модуль
if (window.ErrorDisplay) {
    console.log('ErrorDisplay уже загружен, пропускаем повторную загрузку');
} else {

class ErrorDisplay {
    constructor(element) {
        this.element = element;
        this.timer = null;
    }

    show(message, { timeout = 4000 } = {}) {
        if (!this.element) {
            alert(message);
            return;
        }
        this.element.textContent = message;
        this.element.classList.add('visible');
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => this.clear(), timeout);
    }

    clear() {
        if (!this.element) {
            return;
        }
        this.element.textContent = '';
        this.element.classList.remove('visible');
    }
}

window.ErrorDisplay = ErrorDisplay;

} // Конец блока else для проверки существования модуля
