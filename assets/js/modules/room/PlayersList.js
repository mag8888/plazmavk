// Проверяем, не загружен ли уже модуль
if (window.PlayersList) {
    console.log('PlayersList уже загружен, пропускаем повторную загрузку');
} else {

class PlayersList {
    constructor({ container, state, slotsContainer }) {
        this.container = container;
        this.slotsContainer = slotsContainer;
        this.state = state;
    }

    init() {
        if (!this.container) {
            return;
        }
        this.state.on('change', (room) => {
            this.render(room);
            this.renderSlots(room);
        });
    }

    render(room) {
        if (!room || !Array.isArray(room.players)) {
            console.log('🔍 PlayersList: No room or players data, showing fallback');
            this.showFallbackData();
            return;
        }
        const dreamsById = new Map((room.availableDreams || []).map((dream) => [dream.id, dream]));
        const tokensById = new Map((room.availableTokens || []).map((token) => [token.id, token]));
        const currentUserId = room.currentPlayer?.userId;

        this.container.innerHTML = '';
        room.players.forEach((player) => {
            const item = document.createElement('div');
            item.className = 'player-item';
            if (player.userId === currentUserId) {
                item.classList.add('current-user');
            }

            const avatar = document.createElement('div');
            avatar.className = 'player-avatar';
            avatar.textContent = (player.name || 'Игрок').slice(0, 1).toUpperCase();

            const info = document.createElement('div');
            info.className = 'player-info';

            const name = document.createElement('div');
            name.className = 'player-name';
            name.textContent = player.name + (player.userId === currentUserId ? ' (Вы)' : '');
            info.appendChild(name);

            if (player.selectedToken) {
                const token = tokensById.get(player.selectedToken);
                if (token) {
                    const tokenRow = document.createElement('div');
                    tokenRow.className = 'player-token';
                    tokenRow.innerHTML = `<span>${token.icon || '🎯'}</span><span>${token.name || token.id}</span>`;
                    info.appendChild(tokenRow);
                }
            }

            if (player.selectedDream) {
                const dream = dreamsById.get(player.selectedDream) || null;
                if (dream) {
                    const dreamRow = document.createElement('div');
                    dreamRow.className = 'player-dream';
                    dreamRow.innerHTML = `<span class="dream-icon">${dream.icon || '🌟'}</span><span class="dream-name">${dream.name}</span>`;
                    info.appendChild(dreamRow);
                }
            }

            const status = document.createElement('div');
            status.className = 'player-status';
            // Добавляем инлайн стили для тестирования
            status.style.padding = '4px 8px';
            status.style.borderRadius = '4px';
            status.style.fontSize = '12px';
            status.style.fontWeight = '600';
            
            console.log('🔍 PlayersList render:', {
                playerName: player.name,
                isReady: player.isReady,
                gameStarted: room.gameStarted,
                currentUserId,
                playerUserId: player.userId
            });
            
            if (room.gameStarted) {
                status.textContent = 'В игре';
                status.classList.add('status-ready');
                console.log('🎮 PlayersList: игрок в игре, статус установлен');
            } else if (player.isReady) {
                status.textContent = 'Готов';
                status.classList.add('status-ready');
                status.classList.remove('status-waiting');
                // Добавляем инлайн стили для статуса "готов"
                status.style.background = 'rgba(16, 185, 129, 0.2)';
                status.style.color = '#10b981';
                status.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                console.log('✅ PlayersList: игрок готов, статус установлен:', {
                    playerName: player.name,
                    statusText: status.textContent,
                    hasStatusReady: status.classList.contains('status-ready'),
                    hasStatusWaiting: status.classList.contains('status-waiting')
                });
            } else {
                status.textContent = player.userId === currentUserId ? 'Выберите мечту и фишку' : 'Ожидает';
                status.classList.add('status-waiting');
                status.classList.remove('status-ready');
                console.log('⏳ PlayersList: игрок не готов, статус установлен:', {
                    playerName: player.name,
                    statusText: status.textContent,
                    hasStatusReady: status.classList.contains('status-ready'),
                    hasStatusWaiting: status.classList.contains('status-waiting')
                });
            }

            item.appendChild(avatar);
            item.appendChild(info);
            item.appendChild(status);
            this.container.appendChild(item);
        });
    }

    renderSlots(room) {
        if (!this.slotsContainer || !room) {
            return;
        }

        const maxPlayers = room.maxPlayers || 4;
        const players = room.players || [];
        const currentUserId = room.currentPlayer?.userId;

        console.log('🎯 PlayersList.renderSlots:', {
            maxPlayers: maxPlayers,
            playersCount: players.length,
            roomName: room.name
        });

        // Устанавливаем атрибут для адаптивного CSS
        this.slotsContainer.setAttribute('data-max-players', maxPlayers);
        this.slotsContainer.innerHTML = '';

        for (let i = 0; i < maxPlayers; i++) {
            const slot = document.createElement('div');
            slot.className = 'player-slot';

            const player = players[i];
            
            if (player) {
                // Слот занят игроком
                slot.classList.add('occupied');
                
                if (player.isReady) {
                    slot.classList.add('ready');
                }

                const avatar = document.createElement('div');
                avatar.className = 'player-avatar';
                avatar.textContent = (player.name || 'Игрок').slice(0, 1).toUpperCase();
                slot.appendChild(avatar);

                const statusIndicator = document.createElement('div');
                statusIndicator.className = 'status-indicator';
                slot.appendChild(statusIndicator);

                // Добавляем подсказку при наведении
                slot.title = `${player.name}${player.isReady ? ' (Готов)' : ' (Ожидает)'}`;
            } else {
                // Пустой слот
                const emptySlot = document.createElement('div');
                emptySlot.className = 'empty-slot';
                slot.appendChild(emptySlot);

                slot.title = 'Свободное место';
            }

            this.slotsContainer.appendChild(slot);
        }
        
        console.log(`✅ PlayersList.renderSlots: создано ${maxPlayers} слотов для комнаты "${room.name}"`);
    }
}

window.PlayersList = PlayersList;

} // Конец блока else для проверки существования модуля
