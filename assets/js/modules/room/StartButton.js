// Проверяем, не загружен ли уже модуль
if (window.StartButton) {
    console.log('StartButton уже загружен, пропускаем повторную загрузку');
} else {

class StartButton {
    constructor({ state, button }) {
        this.state = state;
        this.button = button;
        this.isProcessing = false;
    }

    init() {
        if (!this.button) {
            return;
        }
        this.button.addEventListener('click', () => this.handleClick());
        this.state.on('change', (room) => this.update(room));
    }

    update(room) {
        const player = room?.currentPlayer;
        const isHost = Boolean(player?.isHost);
        
        console.log('🔍 StartButton update:', {
            roomId: room?.id,
            playerId: player?.userId,
            playerName: player?.name,
            isHost: isHost,
            canStart: room?.canStart,
            playersCount: room?.players?.length,
            readyCount: room?.players?.filter(p => p.isReady)?.length
        });
        
        if (!isHost) {
            console.log('❌ StartButton: игрок не является хостом, скрываем кнопку');
            this.button.style.display = 'none';
            return;
        }

        console.log('✅ StartButton: игрок является хостом, показываем кнопку');
        this.button.style.display = 'block';
        const canStart = Boolean(room?.canStart);
        this.button.disabled = !canStart;
        this.button.textContent = canStart ? 'Старт' : 'Ожидание игроков';
        this.button.classList.toggle('disabled', !canStart);
        
        console.log('🎮 StartButton: кнопка обновлена:', {
            display: this.button.style.display,
            disabled: this.button.disabled,
            text: this.button.textContent,
            canStart: canStart
        });
    }

    async handleClick() {
        if (this.isProcessing || this.button.disabled) {
            return;
        }
        this.isProcessing = true;
        this.button.dataset.loading = 'true';
        try {
            const room = await this.state.startGame();
            if (room?.gameStarted) {
                // redirect handled by orchestrator
            }
        } catch (error) {
            console.error('Не удалось запустить игру:', error);
        } finally {
            this.button.dataset.loading = 'false';
            this.isProcessing = false;
        }
    }
}

window.StartButton = StartButton;

} // Конец блока else для проверки существования модуля
