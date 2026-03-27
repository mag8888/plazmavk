// Модуль для отображения поп-апов с описанием клеток
// Поддерживает разные стили иконок и детальную информацию о клетках

class CellPopup {
    constructor() {
        this.currentPopup = null;
        this.iconStyle = localStorage.getItem('iconStyle') || 'emoji';
        this.init();
    }

    init() {
        // Создаем контейнер для поп-апов
        this.createPopupContainer();
        // Добавляем обработчики событий
        this.addEventListeners();
    }

    createPopupContainer() {
        // Удаляем существующий контейнер, если есть
        const existing = document.getElementById('cell-popup-container');
        if (existing) {
            existing.remove();
        }

        // Создаем новый контейнер
        const container = document.createElement('div');
        container.id = 'cell-popup-container';
        container.style.display = 'none';
        document.body.appendChild(container);
    }

    addEventListeners() {
        // Закрытие по клику на overlay
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('cell-popup-overlay')) {
                this.close();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentPopup) {
                this.close();
            }
        });
    }

    show(cellData) {
        if (!cellData) return;

        // Закрываем предыдущий поп-ап, если есть
        this.close();

        // Создаем новый поп-ап
        const popup = this.createPopup(cellData);
        
        // Показываем поп-ап
        const container = document.getElementById('cell-popup-container');
        container.innerHTML = '';
        container.appendChild(popup);
        container.style.display = 'block';
        
        this.currentPopup = popup;

        // Анимация появления
        setTimeout(() => {
            popup.style.opacity = '1';
            popup.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);
    }

    createPopup(cellData) {
        const overlay = document.createElement('div');
        overlay.className = 'cell-popup-overlay';

        const popup = document.createElement('div');
        popup.className = `cell-popup ${cellData.type}`;
        popup.style.opacity = '0';
        popup.style.transform = 'translate(-50%, -50%) scale(0.8)';
        popup.style.transition = 'all 0.3s ease';

        // Получаем иконку в текущем стиле
        const icon = this.getIconForType(cellData.type);
        const iconClass = this.getIconStyleClass();

        popup.innerHTML = `
            <div class="cell-popup-header">
                <div class="cell-popup-icon ${iconClass}">${icon}</div>
                <div>
                    <h3 class="cell-popup-title">${cellData.name}</h3>
                    <div class="cell-popup-type">${this.getTypeDisplayName(cellData.type)}</div>
                </div>
            </div>
            
            <div class="cell-popup-description">
                ${cellData.description}
            </div>
            
            ${this.createDetailsSection(cellData)}
            
            <div class="cell-popup-actions">
                <button class="cell-popup-close" onclick="window.cellPopup.close()">
                    Закрыть
                </button>
            </div>
        `;

        overlay.appendChild(popup);
        return overlay;
    }

    createDetailsSection(cellData) {
        const details = [];
        
        if (cellData.minCost && cellData.maxCost) {
            details.push({
                label: 'Стоимость',
                value: `$${cellData.minCost.toLocaleString()} - $${cellData.maxCost.toLocaleString()}`
            });
        } else if (cellData.cost) {
            details.push({
                label: 'Стоимость',
                value: `$${cellData.cost.toLocaleString()}`
            });
        }

        if (cellData.percentage) {
            details.push({
                label: 'Процент',
                value: `${(cellData.percentage * 100).toFixed(1)}%`
            });
        }

        if (cellData.benefit) {
            details.push({
                label: 'Преимущество',
                value: this.getBenefitDisplayName(cellData.benefit)
            });
        }

        if (details.length === 0) {
            return '';
        }

        const detailsHtml = details.map(detail => `
            <div class="cell-popup-detail">
                <span class="cell-popup-detail-label">${detail.label}:</span>
                <span class="cell-popup-detail-value">${detail.value}</span>
            </div>
        `).join('');

        return `
            <div class="cell-popup-details">
                ${detailsHtml}
            </div>
        `;
    }

    getIconForType(type) {
        if (typeof getIconForType === 'function') {
            return getIconForType(type, this.iconStyle);
        }
        // Fallback к эмодзи
        const emojiIcons = {
            'green_opportunity': '💚',
            'pink_expense': '🛒',
            'orange_charity': '❤️',
            'blue_dividend': '💰',
            'purple_business': '🏪',
            'yellow_baby': '👶',
            'red_downsize': '💸'
        };
        return emojiIcons[type] || '⬤';
    }

    getIconStyleClass() {
        if (typeof getIconStyleClass === 'function') {
            return getIconStyleClass(this.iconStyle);
        }
        return '';
    }

    getTypeDisplayName(type) {
        const typeNames = {
            'green_opportunity': 'Зеленая возможность',
            'pink_expense': 'Розовые расходы',
            'orange_charity': 'Благотворительность',
            'blue_dividend': 'Дивиденды',
            'purple_business': 'Бизнес',
            'yellow_baby': 'Семья',
            'red_downsize': 'Сокращение'
        };
        return typeNames[type] || 'Клетка';
    }

    getBenefitDisplayName(benefit) {
        const benefitNames = {
            'double_dice': 'Двойной бросок кубика',
            'extra_turn': 'Дополнительный ход',
            'bonus_money': 'Бонусные деньги'
        };
        return benefitNames[benefit] || benefit;
    }

    close() {
        if (this.currentPopup) {
            // Плавно скрываем
            this.currentPopup.style.opacity = '0';
            this.currentPopup.style.transform = 'translate(-50%, -50%) scale(0.8)';

            setTimeout(() => {
                const container = document.getElementById('cell-popup-container');
                if (container) {
                    // Полностью очищаем контейнер и скрываем его,
                    // чтобы исключить оставшуюся тёмную маску
                    container.innerHTML = '';
                    container.style.display = 'none';
                }

                // На всякий случай удаляем все лишние оверлеи
                document.querySelectorAll('.cell-popup-overlay').forEach(el => {
                    if (el && el.parentElement) {
                        el.parentElement.removeChild(el);
                    }
                });

                this.currentPopup = null;
            }, 300);
        }
    }

    setIconStyle(style) {
        this.iconStyle = style;
        localStorage.setItem('iconStyle', style);
    }

    getAvailableStyles() {
        if (typeof ICON_STYLES !== 'undefined') {
            return Object.keys(ICON_STYLES).map(key => ({
                key,
                ...ICON_STYLES[key]
            }));
        }
        return [
            { key: 'emoji', name: 'Эмодзи', description: 'Цветные эмодзи иконки' }
        ];
    }
}

// Создаем глобальный экземпляр
if (typeof window !== 'undefined') {
    window.cellPopup = new CellPopup();
}

// Экспорт для модульных систем
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CellPopup;
}
