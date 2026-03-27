// Проверяем, не загружен ли уже модуль
if (window.StatusPanel) {
    console.log('StatusPanel уже загружен, пропускаем повторную загрузку');
} else {

class StatusPanel {
    constructor({ state, elements }) {
        this.state = state;
        this.elements = elements || {};
    }

    init() {
        this.state.on('change', (room) => this.update(room));
    }

    update(room) {
        if (!room) {
            return;
        }
        const {
            roomName,
            roomStatus,
            waitingTitle,
            waitingText,
            playersCount,
            maxPlayers,
            turnTime,
            professionMode,
            creatorName
        } = this.elements;

        const readyPlayers = room.readyCount || 0;
        const totalPlayers = room.playersCount || 0;
        const readyText = `${readyPlayers}/${totalPlayers}`;

        if (roomName) {
            roomName.textContent = room.name || 'Комната';
        }
        if (playersCount) {
            playersCount.textContent = totalPlayers;
        }
        if (maxPlayers) {
            maxPlayers.textContent = room.maxPlayers || 4;
        }
        if (turnTime) {
            turnTime.textContent = `${room.turnTime || 3} мин`;
        }
        if (professionMode) {
            professionMode.textContent = room.assignProfessions ? 'Назначены' : 'Свободный выбор';
        }
        if (creatorName) {
            creatorName.textContent = room.creatorName || 'Создатель';
        }

        if (room.gameStarted) {
            roomStatus && (roomStatus.textContent = 'Игра запущена');
            waitingTitle && (waitingTitle.textContent = 'Игра началась');
            waitingText && (waitingText.textContent = 'Переходим на игровое поле...');
            return;
        }

        if (roomStatus) {
            if (room.gameStarted) {
                roomStatus.textContent = 'Игра в процессе';
            } else if (room.canStart) {
                roomStatus.textContent = 'Все готовы! Создатель может начинать игру';
            } else if (readyPlayers >= 2 && totalPlayers >= 2) {
                roomStatus.textContent = `Почти готовы (${readyText})`;
            } else {
                const neededPlayers = (room.minPlayers || 2) - totalPlayers;
                if (neededPlayers > 0) {
                    roomStatus.textContent = `Ожидание игроков (нужно еще ${neededPlayers})`;
                } else {
                    roomStatus.textContent = `Ожидание готовности (${readyText} готовы)`;
                }
            }
        }

        if (waitingTitle && waitingText) {
            if (room.canStart) {
                waitingTitle.textContent = 'Готово к запуску!';
                waitingText.textContent = 'Создатель комнаты может нажать «Старт», чтобы перейти к игровому полю.';
            } else {
                waitingTitle.textContent = 'Ожидание игроков';
                waitingText.textContent = `Игра начнется, когда минимум два игрока будут готовы (${readyText}).`;
            }
        }
    }
}

window.StatusPanel = StatusPanel;

} // Конец блока else для проверки существования модуля
