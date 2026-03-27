if (window.DreamSelectButton) {
    console.log('⚠️ DreamSelectButton уже загружен, пропускаем повторную загрузку');
} else {

class DreamSelectButton {
    constructor(roomState) {
        this.state = roomState;
        this.button = document.getElementById('dreamSelectBtn');
        this.isProcessing = false;
        
        if (!this.button) {
            console.error('❌ DreamSelectButton: кнопка dreamSelectBtn не найдена');
            return;
        }
        
        this.init();
    }
    
    init() {
        console.log('🎯 DreamSelectButton: инициализация');
        
        this.button.addEventListener('click', () => {
            this.handleClick();
        });
        
        // Слушаем изменения состояния комнаты
        this.state.on('change', () => {
            this.update();
        });
        
        // Первоначальное обновление
        this.update();
    }
    
    handleClick() {
        if (this.isProcessing) {
            console.log('⏳ DreamSelectButton: обработка уже идет, пропускаем клик');
            return;
        }
        
        console.log('🎯 DreamSelectButton: клик по кнопке выбора мечты');
        
        // Прокручиваем к секции выбора мечты
        const dreamSection = document.querySelector('.dream-selection');
        if (dreamSection) {
            dreamSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Подсвечиваем секцию
            dreamSection.style.border = '2px solid #ff6b6b';
            dreamSection.style.boxShadow = '0 0 20px rgba(255, 107, 107, 0.5)';
            
            // Убираем подсветку через 3 секунды
            setTimeout(() => {
                dreamSection.style.border = '';
                dreamSection.style.boxShadow = '';
            }, 3000);
        }
    }
    
    update() {
        if (!this.button) return;
        
        const room = this.state.getSnapshot();
        const player = room?.currentPlayer;
        
        console.log('🎯 DreamSelectButton update:', {
            room: room ? { id: room.id, gameStarted: room.gameStarted, playersCount: room.players?.length } : null,
            player: player ? { name: player.name, userId: player.userId, isHost: player.isHost } : null,
            state: this.state
        });
        
        if (!room || !player) {
            console.log('🎯 DreamSelectButton: комната или игрок не найдены, скрываем кнопку');
            this.button.style.display = 'none';
            return;
        }
        
        // Показываем кнопку всем игрокам, если игра не началась
        if (room.gameStarted) {
            console.log('🎯 DreamSelectButton: игра началась, скрываем кнопку');
            this.button.style.display = 'none';
            return;
        }
        
        const hasDream = Boolean(player.selectedDream);
        const hasToken = Boolean(player.selectedToken);
        
        console.log('🎯 DreamSelectButton: обновление состояния:', {
            hasDream,
            hasToken,
            playerName: player.name
        });
        
        // Показываем кнопку всем игрокам
        this.button.style.display = 'block';
        
        if (hasDream && hasToken) {
            // Если и мечта, и фишка выбраны, кнопка неактивна
            this.button.disabled = true;
            this.button.textContent = '✅ Мечта и фишка выбраны';
            this.button.classList.add('disabled');
        } else if (hasDream) {
            // Если мечта выбрана, но фишка нет
            this.button.disabled = false;
            this.button.textContent = '🎯 Выберите фишку';
            this.button.classList.remove('disabled');
        } else {
            // Если мечта не выбрана
            this.button.disabled = false;
            this.button.textContent = '🎯 Выберите мечту';
            this.button.classList.remove('disabled');
        }
    }
}

// Экспорт
window.DreamSelectButton = DreamSelectButton;
console.log('✅ DreamSelectButton модуль загружен');

}
