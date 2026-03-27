// EventEmitter и RoomApi будут доступны глобально

class GameState extends EventEmitter {
    constructor({ roomId, pollInterval = 7000 } = {}) {
        super();
        this.roomId = roomId;
        this.api = new RoomApi();
        this.pollInterval = pollInterval;
        this.user = null;
        this.room = null;
        this.state = null;
        this.timer = null;
        this.isFetching = false;
        this.redirectOnMissingGame = true;
        this._lastStateSignature = null;
    }

    async init() {
        this.user = this.api?.getCurrentUser?.() || null;
        console.log('🔍 GameState: getCurrentUser returned:', this.user);
        
        if (!this.user?.id) {
            console.log('🔍 GameState: No user found, checking localStorage directly');
            try {
                const storedUser = localStorage.getItem('user');
                const storedUserId = localStorage.getItem('userId');
                console.log('🔍 GameState: localStorage user:', storedUser, 'userId:', storedUserId);
                
                if (storedUser) {
                    const parsedUser = JSON.parse(storedUser);
                    if (parsedUser.id || parsedUser._id) {
                        this.user = parsedUser;
                        if (parsedUser._id && !parsedUser.id) {
                            this.user.id = parsedUser._id;
                        }
                        console.log('🔍 GameState: Restored user from localStorage:', this.user);
                    }
                }
            } catch (e) {
                console.warn('🔍 GameState: Failed to parse user from localStorage:', e);
            }
        }
        
        if (!this.user?.id) {
            console.log('Пользователь не найден, перенаправляем на авторизацию');
            window.location.assign('/auth');
            return;
        }
        
        // Продублируем userId в localStorage для RoomApi заголовков
        try { 
            localStorage.setItem('userId', String(this.user.id)); 
            console.log('🔍 GameState: Set userId in localStorage:', this.user.id);
        } catch (_) {}
        
        // Проверяем пользователя с мягким фоллбэком (как в лобби)
        try {
            await this.api.getPublicProfile();
        } catch (error) {
            // Не разлогиниваем на 404/отсутствии данных, продолжаем с кэшем
            console.log('Профиль недоступен, продолжаем с локальными данными:', error?.message || error);
        }
        
        await this.ensureJoined();
        await this.refresh();
        this.startPolling();
    }

    destroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    getSnapshot() {
        return this.state ? JSON.parse(JSON.stringify(this.state)) : null;
    }

    getCurrentPlayer() {
        if (!this.state) return null;
        const myId = this.user?.id != null ? String(this.user.id) : null;
        return this.state.players?.find(player => String(player.userId) === myId) || null;
    }

    getUserId() {
        return this.user?.id || null;
    }

    getTurnTimeSec(defaultTime = 120) {
        if (!this.state) return defaultTime;
        return this.state.turnTime || defaultTime;
    }

    isMyTurn() {
        if (!this.state) return false;
        const myId = this.user?.id != null ? String(this.user.id) : null;
        const activeId = this.state.activePlayerId != null ? String(this.state.activePlayerId) : null;
        if (!myId || !activeId) return false;
        return activeId === myId;
    }

    async ensureJoined() {
        try {
            const room = await this.api.getRoom(this.roomId, { user_id: this.user.id });
            
            // Проверяем, что пользователь находится в комнате
            if (!room?.currentPlayer) {
                throw new Error('Вы не находитесь в этой комнате. Пожалуйста, присоединитесь к комнате сначала.');
            }
            
            // Проверяем, что игра началась
            if (!room.gameStarted && this.redirectOnMissingGame) {
                window.location.assign(`/room/u/${this.user.username || 'user'}`);
                return;
            }
            
            this.room = room;
            localStorage.setItem('currentRoom', JSON.stringify(room));
            localStorage.setItem('currentRoomId', this.roomId);
        } catch (error) {
            console.error('Ошибка при проверке принадлежности к комнате:', error);
            if (error.message.includes('не находитесь в этой комнате')) {
                window.location.assign(`/room/${this.roomId}`);
                return;
            }
            throw error;
        }
    }

    async refresh() {
        if (this.isFetching) {
            return;
        }
        this.isFetching = true;
        try {
            const state = await this.api.getGameState(this.roomId);
            this.applyState(state);
        } catch (error) {
            this.emit('error', error);
        } finally {
            this.isFetching = false;
        }
    }

    startPolling() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.timer = setInterval(() => this.refresh(), this.pollInterval);
    }

    applyState(state) {
        if (!state) return;
        // Avoid redundant updates by comparing a compact signature of important fields
        try {
            const signatureObj = {
                activePlayerId: state?.activePlayerId != null ? String(state.activePlayerId) : null,
                activeIndex: state?.activeIndex ?? null,
                turnTimeLeft: state?.turnTimeLeft ?? null,
                players: Array.isArray(state?.players)
                    ? state.players.map(p => ({
                        userId: p?.userId != null ? String(p.userId) : null,
                        position: Number(p?.position ?? 0)
                    }))
                    : []
            };
            const signature = JSON.stringify(signatureObj);
            if (this._lastStateSignature === signature) {
                return;
            }
            this._lastStateSignature = signature;
        } catch (_) {}
        this.state = state;
        try {
            const debugPlayers = Array.isArray(state.players)
                ? state.players.map(p => ({ userId: String(p.userId), name: p.name }))
                : [];
            const debugPayload = {
                activePlayerId: state?.activePlayerId != null ? String(state.activePlayerId) : null,
                activeIndex: state?.activeIndex ?? null,
                me: this.user?.id != null ? String(this.user.id) : null,
                isMyTurn: String(state?.activePlayerId) === String(this.user?.id),
                players: debugPlayers
            };
            if (typeof window !== 'undefined' && (window.DEBUG || window.DEBUG_GAME)) {
                console.log('🔍 GameState.applyState:', JSON.stringify(debugPayload));
            }
        } catch (e) {
            if (typeof window !== 'undefined' && (window.DEBUG || window.DEBUG_GAME)) {
                console.log('🔍 GameState.applyState (fallback logs):',
                    'activePlayerId=', state?.activePlayerId,
                    'activeIndex=', state?.activeIndex,
                    'me=', this.user?.id,
                    'players=', Array.isArray(state?.players) ? state.players.length : 'n/a'
                );
            }
        }
        this.emit('change', this.getSnapshot());
        
        // Обновляем позиции фишек на доске
        if (window.renderPlayerTokensFromState && window._innerPositionsCache) {
            window.renderPlayerTokensFromState(window._innerPositionsCache);
        }
    }

    async rollDice() {
        try {
            const result = await this.api.rollDice(this.roomId);
            if (result?.state) {
                this.applyState(result.state);
            }
            this.emit('rolled', result);
            return result;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async chooseDeal(size) {
        try {
            const result = await this.api.chooseDeal(this.roomId, size);
            if (result?.state) {
                this.applyState(result.state);
            }
            return result;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async resolveDeal(action) {
        try {
            const result = await this.api.resolveDeal(this.roomId, action);
            if (result?.state) {
                this.applyState(result.state);
            }
            return result;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async transferAsset(assetId, targetUserId) {
        try {
            const result = await this.api.transferAsset(this.roomId, assetId, targetUserId);
            if (result?.state) {
                this.applyState(result.state);
            }
            return result;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async sellAsset(assetId) {
        try {
            const result = await this.api.sellAsset(this.roomId, assetId);
            if (result?.state) {
                this.applyState(result.state);
            }
            return result;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async endTurn() {
        try {
            const state = await this.api.endTurn(this.roomId);
            if (state) {
                this.applyState(state);
            }
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
}

// Экспортируем в window для совместимости
window.GameState = GameState;
export default GameState;
