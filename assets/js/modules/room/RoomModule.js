// Проверяем, не загружен ли уже модуль
if (window.RoomModule) {
    console.log('RoomModule уже загружен, пропускаем повторную загрузку');
} else {

// Все модули будут доступны глобально

class RoomModule {
    constructor({ roomId, pollInterval = 4000 } = {}) {
        this.roomId = roomId;
        this.api = new RoomApi();
        this.state = new RoomState({ roomId, api: this.api, pollInterval });
        this.errorDisplay = new ErrorDisplay(document.getElementById('errorMessage'));
        this.modules = [];
        this.redirecting = false;
    }

    async init() {
        console.log(`🔍 RoomModule.init: инициализация комнаты ${this.roomId}`);
        if (!this.roomId) {
            throw new Error('roomId отсутствует в URL');
        }
        this.setupModules();
        this.setupListeners();
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'flex';
        }
        try {
            console.log(`🔍 RoomModule.init: вызываем state.init()...`);
            await this.state.init();
            console.log(`🔍 RoomModule.init: state.init() завершен успешно`);
            if (loading) {
                loading.style.display = 'none';
            }
            const content = document.getElementById('roomContent');
            if (content) {
                content.style.display = 'grid';
            }
        } catch (error) {
            if (loading) {
                loading.style.display = 'none';
            }
            this.handleError(error);
        }
    }

    setupModules() {
        const dreamSelector = new DreamSelector({
            state: this.state,
            container: document.getElementById('dreamList'),
            searchInput: document.getElementById('dreamSearch')
        });
        dreamSelector.init();
        this.modules.push(dreamSelector);

        const tokenSelector = new TokenSelector({
            state: this.state,
            container: document.getElementById('tokenList'),
            searchInput: document.getElementById('tokenSearch')
        });
        tokenSelector.init();
        this.modules.push(tokenSelector);

        const playersList = new PlayersList({
            state: this.state,
            container: document.getElementById('playersList'),
            slotsContainer: document.getElementById('playerSlots')
        });
        playersList.init();
        this.modules.push(playersList);

        const readyButton = new ReadyButton({
            state: this.state,
            button: document.getElementById('readyBtn')
        });
        readyButton.init();
        this.modules.push(readyButton);

        const dreamSelectButton = new DreamSelectButton(this.state);
        this.modules.push(dreamSelectButton);

        const startButton = new StartButton({
            state: this.state,
            button: document.getElementById('startBtn')
        });
        startButton.init();
        this.modules.push(startButton);

        const statusPanel = new StatusPanel({
            state: this.state,
            elements: {
                roomName: document.getElementById('roomName'),
                roomStatus: document.getElementById('roomStatus'),
                waitingTitle: document.getElementById('waitingTitle'),
                waitingText: document.getElementById('waitingText'),
                playersCount: document.getElementById('playersCount'),
                maxPlayers: document.getElementById('maxPlayers'),
                turnTime: document.getElementById('turnTime'),
                professionMode: document.getElementById('professionMode'),
                creatorName: document.getElementById('creatorName')
            }
        });
        statusPanel.init();
        this.modules.push(statusPanel);

        const updateIndicator = new UpdateIndicator({
            state: this.state,
            element: document.getElementById('updateIndicator')
        });
        updateIndicator.init();
        this.modules.push(updateIndicator);

        const refreshBtn = document.querySelector('.refresh-btn');
        refreshBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            this.state.refresh();
        });

        const backBtn = document.querySelector('.back-btn');
        backBtn?.addEventListener('click', () => {
            window.location.assign('/lobby');
        });
    }

    setupListeners() {
        this.state.on('change', (room) => this.handleRoomChange(room));
        this.state.on('error', (error) => this.handleError(error));
    }

    handleRoomChange(room) {
        if (room?.gameStarted && !this.redirecting) {
            this.redirecting = true;
            const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user')||'null'); } catch(_) { return null; } })();
            const username = (storedUser?.username || storedUser?.email?.split('@')[0] || 'player').toString();
            // Даем интерфейсу время показать сообщение
            setTimeout(() => {
                window.location.assign(`/game/u/${encodeURIComponent(username)}`);
            }, 800);
        }
    }

    handleError(error) {
        const message = error?.message || 'Неизвестная ошибка';
        this.errorDisplay.show(message);
        console.error('[RoomModule] error:', error);
    }
}

// Экспортируем в window для совместимости
window.RoomModule = RoomModule;

} // Конец блока else для проверки существования модуля
