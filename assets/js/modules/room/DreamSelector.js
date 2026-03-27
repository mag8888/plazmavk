// Проверяем, не загружен ли уже модуль
if (window.DreamSelector) {
    console.log('DreamSelector уже загружен, пропускаем повторную загрузку');
} else {

const DEFAULT_DREAMS = [
    { id: 2, name: 'Построить дом мечты для семьи', cost: 100000, icon: '🏠' },
    { id: 6, name: 'Посетить Антарктиду', cost: 150000, icon: '✈️' },
    { id: 12, name: 'Подняться на все высочайшие вершины мира', cost: 500000, icon: '⛰️' },
    { id: 16, name: 'Жить год на яхте в Средиземном море', cost: 300000, icon: '⛵' },
    { id: 18, name: 'Создать фонд поддержки талантов', cost: 300000, icon: '🎗️' },
    { id: 20, name: 'Организовать мировой фестиваль', cost: 200000, icon: '🎪' },
    { id: 24, name: 'Туристическое эко-ранчо', cost: 1000000, icon: '🏞️' },
    { id: 28, name: 'NFT-платформа', cost: 400000, icon: '💎' },
    { id: 30, name: 'Полет на Марс', cost: 300000, icon: '🚀' },
    { id: 32, name: 'Создать школу будущего для детей', cost: 300000, icon: '🏫' },
    { id: 35, name: 'Кругосветное плавание на паруснике', cost: 200000, icon: '⛵' },
    { id: 37, name: 'Белоснежная Яхта', cost: 300000, icon: '⛵' },
    { id: 42, name: 'Организовать благотворительный фонд', cost: 200000, icon: '🎗️' },
    { id: 46, name: 'Полёт в космос', cost: 250000, icon: '🚀' },
    { id: 48, name: 'Кругосветное путешествие', cost: 300000, icon: '🌍' },
    { id: 50, name: 'Создать собственный остров', cost: 500000, icon: '🏝️' }
];

class DreamSelector {
    constructor({ state, container, searchInput }) {
        this.state = state;
        this.container = container;
        this.currentDreamId = null;
        this.isProcessing = false;
        this.searchInput = searchInput || null;
        this.lastRoom = null;
    }

    init() {
        if (!this.container) {
            return;
        }
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                if (this.lastRoom) {
                    this.render(this.lastRoom, { force: true });
                }
            });
        }
        this.state.on('change', (room) => this.render(room));
    }

    render(room, { force = false } = {}) {
        if (!room) {
            return;
        }
        this.lastRoom = room;
        
        // Мечты теперь можно выбирать нескольким игрокам
        
        const dreams = Array.isArray(room.availableDreams) && room.availableDreams.length
            ? room.availableDreams
            : DEFAULT_DREAMS;
        const player = room.currentPlayer;
        this.currentDreamId = player?.selectedDream ?? null;
        const query = this.searchInput?.value?.trim().toLowerCase() || '';
        const list = query
            ? dreams.filter(dream => dream.name.toLowerCase().includes(query))
            : dreams;

        if (!force) {
            this.container.innerHTML = '';
        } else {
            this.container.textContent = '';
        }

        list.forEach((dream) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'dream-item';
            if (dream.id === this.currentDreamId) {
                item.classList.add('selected');
            }
            item.dataset.dreamId = dream.id;
            item.innerHTML = `
                <span class="dream-icon">${dream.icon || '🌟'}</span>
                <span class="dream-name">${dream.name}</span>
                <span class="dream-cost">$${Number(dream.cost || 0).toLocaleString()}</span>
            `;

            // Мечты теперь можно выбирать нескольким игрокам

            item.addEventListener('click', () => this.handleSelection(dream.id));
            this.container.appendChild(item);
        });
    }

    async handleSelection(dreamId) {
        if (this.isProcessing || dreamId === this.currentDreamId) {
            return;
        }
        this.isProcessing = true;
        try {
            await this.state.selectDream(dreamId);
        } catch (error) {
            console.error('Не удалось выбрать мечту:', error);
        } finally {
            this.isProcessing = false;
        }
    }
}

window.DreamSelector = DreamSelector;

} // Конец блока else для проверки существования модуля
