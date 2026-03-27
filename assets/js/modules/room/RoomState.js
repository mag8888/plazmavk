// Проверяем, не загружен ли уже модуль
if (window.RoomState) {
    console.log('RoomState уже загружен, пропускаем повторную загрузку');
} else {

// EventEmitter будет доступен глобально

class RoomState extends EventEmitter {
    constructor({ roomId, api, pollInterval = 8000 } = {}) {
        super();
        this.api = api;
        this.roomId = roomId;
        this.pollInterval = pollInterval;
        this.user = null;
        this.room = null;
        this.timer = null;
        this.isFetching = false;
    }

    async init() {
        console.log(`🔍 RoomState.init: инициализация для комнаты ${this.roomId}`);
        this.user = this.api?.getCurrentUser?.() || null;
        console.log(`🔍 RoomState.init: пользователь:`, {
            id: this.user?.id,
            name: this.user?.first_name || this.user?.username || this.user?.email,
            hasApi: !!this.api
        });
        if (!this.user?.id) {
            throw new Error('Пользователь не найден. Авторизуйтесь заново.');
        }
        console.log(`🔍 RoomState.init: вызываем ensureJoined()...`);
        await this.ensureJoined();
        console.log(`🔍 RoomState.init: вызываем refresh()...`);
        await this.refresh();
        console.log(`🔍 RoomState.init: запускаем polling...`);
        this.startPolling();
        console.log(`🔍 RoomState.init: инициализация завершена`);
    }

    destroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    getSnapshot() {
        return this.room ? JSON.parse(JSON.stringify(this.room)) : null;
    }

    async ensureJoined() {
        try {
            console.log(`🔍 RoomState.ensureJoined: проверяем комнату ${this.roomId} для пользователя ${this.user.id}`);
            const room = await this.api.getRoom(this.roomId);
            console.log(`🔍 RoomState.ensureJoined: получена комната:`, {
                roomId: room?.id,
                hasCurrentPlayer: !!room?.currentPlayer,
                playersCount: room?.players?.length,
                gameStarted: room?.gameStarted
            });
            
            if (!room?.currentPlayer) {
                console.log(`🔍 RoomState.ensureJoined: пользователь не в комнате, присоединяемся...`);
                const joinResult = await this.api.joinRoom(this.roomId, {
                    name: this.user.first_name || this.user.username || this.user.email || 'Игрок',
                    avatar: this.user.avatar || this.user.photo || null,
                    user_id: this.user.id
                });
                console.log(`🔍 RoomState.ensureJoined: результат присоединения:`, {
                    success: !!joinResult?.room,
                    hasRoom: !!joinResult?.room,
                    playersCount: joinResult?.room?.players?.length
                });
                if (joinResult?.room) {
                    this.handleUpdate(joinResult.room);
                }
            } else {
                console.log(`🔍 RoomState.ensureJoined: пользователь уже в комнате`);
            }
        } catch (error) {
            console.error(`❌ RoomState.ensureJoined: ошибка:`, error);
            this.emit('error', error);
            throw error;
        }
    }

    async refresh({ silent = false } = {}) {
        if (this.isFetching) {
            return;
        }
        this.isFetching = true;
        try {
            if (!silent) {
                this.emit('loading', true);
            }
            const room = await this.api.getRoom(this.roomId);
            this.handleUpdate(room);
        } catch (error) {
            this.emit('error', error);
        } finally {
            if (!silent) {
                this.emit('loading', false);
            }
            this.isFetching = false;
        }
    }

    startPolling() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.timer = setInterval(() => this.refresh({ silent: true }), this.pollInterval);
    }

    async selectDream(dreamId) {
        try {
            const room = await this.api.selectDream(this.roomId, dreamId);
            this.handleUpdate(room);
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async selectToken(tokenId) {
        try {
            const room = await this.api.selectToken(this.roomId, tokenId);
            this.handleUpdate(room);
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async toggleReady() {
        try {
            console.log('🔄 RoomState.toggleReady: отправка запроса...');
            const room = await this.api.toggleReady(this.roomId);
            console.log('✅ RoomState.toggleReady: получен ответ:', {
                roomId: room?.id,
                players: room?.players?.map(p => ({
                    name: p.name,
                    isReady: p.isReady,
                    userId: p.userId
                }))
            });
            this.handleUpdate(room);
        } catch (error) {
            console.error('❌ RoomState.toggleReady: ошибка:', error);
            this.emit('error', error);
            throw error;
        }
    }

    async startGame() {
        try {
            const room = await this.api.startGame(this.roomId);
            this.handleUpdate(room);
            return room;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    handleUpdate(room) {
        if (!room) {
            console.log('⚠️ RoomState.handleUpdate: пустая комната');
            return;
        }
        
        // Находим текущего игрока
        const currentPlayer = room.players?.find(p => p.userId === this.user?.id?.toString());
        room.currentPlayer = currentPlayer;
        
        console.log('🔄 RoomState.handleUpdate: обновление состояния комнаты:', {
            roomId: room.id,
            currentUserId: this.user?.id,
            currentPlayer: currentPlayer ? {
                name: currentPlayer.name,
                userId: currentPlayer.userId,
                isHost: currentPlayer.isHost,
                isReady: currentPlayer.isReady
            } : null,
            players: room.players?.map(p => ({
                name: p.name,
                isReady: p.isReady,
                isHost: p.isHost,
                userId: p.userId
            }))
        });
        
        this.room = room;
        localStorage.setItem('currentRoomId', this.roomId);
        localStorage.setItem('currentRoom', JSON.stringify(room));
        this.emit('change', this.getSnapshot());
        console.log('✅ RoomState.handleUpdate: событие change отправлено');
        
        // Отправляем событие для обновления доски
        window.dispatchEvent(new CustomEvent('roomUpdated', {
            detail: { room }
        }));
    }
}

// Экспортируем в window для совместимости
window.RoomState = RoomState;

} // Конец блока else для проверки существования модуля
