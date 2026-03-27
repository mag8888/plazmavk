// Проверяем, не загружен ли уже модуль
if (window.UpdateIndicator) {
    console.log('UpdateIndicator уже загружен, пропускаем повторную загрузку');
} else {

class UpdateIndicator {
    constructor({ state, element }) {
        this.state = state;
        this.element = element;
    }

    init() {
        if (!this.element) {
            return;
        }
        this.state.on('loading', (isLoading) => this.toggle(isLoading));
        this.state.on('change', () => this.toggle(false));
    }

    toggle(isLoading) {
        if (!this.element) {
            return;
        }
        const label = this.element.querySelector('.update-label');

        if (isLoading) {
            this.element.className = 'update-indicator updating';
            if (label) {
                label.textContent = 'Обновление...';
            }
        } else {
            this.element.className = 'update-indicator ready';
            if (label) {
                label.textContent = 'Готово';
            }
        }
    }
}

window.UpdateIndicator = UpdateIndicator;

} // Конец блока else для проверки существования модуля
