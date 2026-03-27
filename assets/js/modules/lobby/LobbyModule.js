/**
 * LobbyModule — управление логикой лобби, реализованной через микромодули.
 */
console.log('=== Загрузка LobbyModule.js ===');

class LobbyModule {
    constructor({ api = new window.RoomApi(), pollInterval = 10000 } = {}) {
        // Защита от множественной инициализации
        if (window.lobbyModuleInstance) {
            console.warn('LobbyModule already initialized, returning existing instance');
            return window.lobbyModuleInstance;
        }
        
        this.api = api;
        this.roomApi = api; // Дублируем для совместимости
        this.pollInterval = pollInterval;
        this.currentUser = null;
        this.rooms = [];
        this.selectedProfession = 'entrepreneur';
        this.selectedRoomId = null;
        this.timers = [];
        this.dom = {};
        
        // Сохраняем экземпляр глобально
        window.lobbyModuleInstance = this;
    }

    /**
     * Инициализация модуля
     */
    async init() {
        // Защита от множественной инициализации
        if (this.initialized) {
            console.warn('LobbyModule already initialized, skipping');
            return;
        }
        
        console.log('=== Инициализация LobbyModule ===');
        console.log('Current URL:', window.location.href);
        console.log('Current domain:', window.location.hostname);
        
        this.cacheDom();
        this.bindEvents();
        this.exposeLegacyBridges();
        
        // Проверяем user ID
        let userId = localStorage.getItem('userId');
        console.log('🔍 Checking localStorage for user ID...');
        console.log('🔍 All localStorage keys:', Object.keys(localStorage));
        console.log('🔍 userId from localStorage:', userId);
        console.log('🔍 user from localStorage:', localStorage.getItem('user'));
        console.log('🔍 isAuthenticated from localStorage:', localStorage.getItem('isAuthenticated'));
        
        // Fallback: попробуем извлечь user ID из сохраненного объекта user
        if (!userId) {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    if (user && user.id) {
                        console.log('🔍 Fallback: Found user ID in user object:', user.id);
                        localStorage.setItem('userId', user.id);
                        userId = user.id;
                    }
                } catch (error) {
                    console.error('❌ Error parsing user object:', error);
                }
            }
        }
        
        if (!userId) {
            console.log('❌ No user ID found. Trying soft flow: show UI, no stats/rooms until login.');
            this.updateUserDisplay();
            this.showError(null, 'Необходимо войти в систему');
            // Не редиректим сразу — даем возможность нажать "Войти" в UI
        }
        
        try {
            const userInitialized = userId ? await this.initializeUser() : false;
            
            // Проверяем, что пользователь успешно инициализирован
            if (!userInitialized) {
                console.log('⚠️ User not initialized. Showing lobby shell without protected data.');
            }
            
            // Небольшая задержка для стабилизации localStorage
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Проверяем user ID еще раз перед загрузкой данных
            const userId2 = localStorage.getItem('userId');
            if (!userId2) {
                console.log('❌ User ID lost during initialization, redirecting to login');
                this.showError(null, 'Сессия прервана. Необходимо войти в систему');
                setTimeout(() => {
                    window.location.href = '/auth.html';
                }, 2000);
                return;
            }
            
            if (userId) {
                await this.loadUserStats();
                await this.loadRooms();
            }
            this.scheduleRoomRefresh();
            
            this.initialized = true;
            console.log('=== LobbyModule инициализирован ===');
        } catch (error) {
            console.error('❌ Ошибка инициализации LobbyModule:', error);
            this.showError(null, 'Ошибка загрузки лобби. Попробуйте обновить страницу.');
        }
    }

    exposeLegacyBridges() {
        window.enterRoom = () => {
            const roomId = localStorage.getItem('currentRoomId');
            if (!roomId) {
                alert('Комната не найдена. Выберите или создайте комнату.');
                return;
            }
            window.location.assign(`/room/${roomId}`);
        };

        window.leaveRoom = async () => {
            const roomId = localStorage.getItem('currentRoomId');
            if (!roomId) {
                alert('Вы не находитесь в комнате');
                return;
            }
            try {
                await this.api.leaveRoom(roomId, {});
                localStorage.removeItem('currentRoomId');
                localStorage.removeItem('currentRoom');
                await this.loadRooms();
                alert('Вы покинули комнату');
            } catch (error) {
                alert(error.message || 'Не удалось покинуть комнату');
            }
        };
    }

    cacheDom() {
        this.dom.userName = document.getElementById('userName');
        this.dom.userBalance = document.getElementById('userBalance');
        this.dom.totalGames = document.getElementById('totalGames');
        this.dom.totalWins = document.getElementById('totalWins');
        this.dom.userLevel = document.getElementById('userLevel');
        this.dom.onlinePlayers = document.getElementById('onlinePlayers');
        this.dom.roomsList = document.getElementById('roomsList');
        this.dom.createRoomModal = document.getElementById('createRoomModal');
        this.dom.joinRoomModal = document.getElementById('joinRoomModal');
        this.dom.createRoomForm = document.getElementById('createRoomForm');
        this.dom.createRoomError = document.getElementById('createRoomError');
        this.dom.joinRoomError = document.getElementById('joinRoomError');
        this.dom.joinRoomPassword = document.getElementById('joinRoomPassword');
        this.dom.joinRoomLoading = document.getElementById('joinRoomLoading');
        this.dom.roomName = document.getElementById('roomName');
        this.dom.maxPlayers = document.getElementById('maxPlayers');
        this.dom.turnTime = document.getElementById('turnTime');
        this.dom.assignProfessions = document.getElementById('assignProfessions');
        this.dom.roomPassword = document.getElementById('roomPassword');
        this.dom.createRoomLoading = document.getElementById('createRoomLoading');
    }

    bindEvents() {
        const createBtn = document.querySelector('.create-room-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreateRoomModal());
        }

        const quickJoinBtn = document.querySelector('.quick-join-btn');
        if (quickJoinBtn) {
            quickJoinBtn.addEventListener('click', () => this.quickJoin());
        }

        const refreshBtn = document.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (event) => {
                event.preventDefault();
                this.loadRooms();
            });
        }

        const logoutBtn = document.querySelector('.logout-btn');
        logoutBtn?.addEventListener('click', () => this.logout());

        if (this.dom.createRoomModal) {
            const closeBtn = this.dom.createRoomModal.querySelector('.close-btn');
            closeBtn?.addEventListener('click', () => this.hideCreateRoomModal());
            const cancelBtn = this.dom.createRoomModal.querySelector('.modal-actions .btn-secondary');
            cancelBtn?.addEventListener('click', () => this.hideCreateRoomModal());
        }

        if (this.dom.joinRoomModal) {
            const closeBtn = this.dom.joinRoomModal.querySelector('.close-btn');
            closeBtn?.addEventListener('click', () => this.hideJoinRoomModal());
            const cancelBtn = this.dom.joinRoomModal.querySelector('.modal-actions .btn-secondary');
            cancelBtn?.addEventListener('click', () => this.hideJoinRoomModal());
        }

        if (this.dom.createRoomForm) {
            this.dom.createRoomForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.createRoom();
            });
        }

        document.querySelectorAll('.profession-card').forEach(card => {
            card.addEventListener('click', () => this.selectProfession(card));
        });

        const joinConfirmBtn = this.dom.joinRoomModal?.querySelector('.modal-actions .btn-primary');
        if (joinConfirmBtn) {
            joinConfirmBtn.addEventListener('click', () => this.confirmJoinRoom());
        }

        const joinCancelBtn = this.dom.joinRoomModal?.querySelector('.modal-actions .btn-secondary');
        joinCancelBtn?.addEventListener('click', () => this.hideJoinRoomModal());
    }

    scheduleRoomRefresh() {
        this.timers.push(setInterval(() => this.loadRooms(false), this.pollInterval));
    }

    async initializeUser() {
        console.log('=== Инициализация пользователя ===');
        
        // Сначала попробуем загрузить пользователя из localStorage
        const savedUser = localStorage.getItem('user');
        const userId = localStorage.getItem('userId');
        
        console.log('Saved user:', savedUser ? 'Found' : 'Not found');
        console.log('User ID:', userId ? 'Found' : 'Not found');
        console.log('All localStorage keys:', Object.keys(localStorage));
        
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                console.log('Loaded user from localStorage:', this.currentUser);
                this.updateUserDisplay();
            } catch (error) {
                console.error('Failed to parse saved user data:', error);
            }
        }
        
        // Если нет user ID, не пытаемся валидировать
        if (!userId) {
            console.log('No user ID found, skipping validation');
            console.log('This might be the cause of the logout issue');
            return false;
        }
        
        console.log('Validating user with user ID...');
        const userValid = await this.validateAndUpdateUser();
        // Подстраховка: если после валидации не хватает имени/email — дозаполняем
        if (userValid && this.currentUser) {
            let patched = false;
            if (!this.currentUser.email && typeof this.currentUser === 'object') {
                // попробуем взять email из сохраненного пользователя
                const cached = savedUser ? JSON.parse(savedUser) : null;
                if (cached?.email) {
                    this.currentUser.email = cached.email;
                    patched = true;
                }
            }
            if (!this.currentUser.first_name && !this.currentUser.username) {
                this.currentUser.first_name = this.currentUser.email || 'Игрок';
                patched = true;
            }
            if (patched) {
                localStorage.setItem('user', JSON.stringify(this.currentUser));
            }
        }
        if (!userValid) {
            console.log('User validation failed, logging out');
            this.logout();
            return false;
        }
        console.log('User validation successful');
        this.updateUserDisplay();
        return true;
    }

    updateUserDisplay() {
        if (!this.currentUser) {
            console.log('No current user data available');
            return;
        }
        
        console.log('Updating user display with data:', this.currentUser);
        console.log('User name fields:', {
            first_name: this.currentUser.first_name,
            last_name: this.currentUser.last_name,
            username: this.currentUser.username,
            email: this.currentUser.email
        });
        
        if (this.dom.userName) {
            let displayName = 'Игрок';
            
            if (this.currentUser.first_name && this.currentUser.last_name) {
                displayName = `${this.currentUser.first_name} ${this.currentUser.last_name}`.trim();
            } else if (this.currentUser.first_name) {
                displayName = this.currentUser.first_name;
            } else if (this.currentUser.username) {
                displayName = this.currentUser.username;
            } else if (this.currentUser.email) {
                displayName = this.currentUser.email.split('@')[0];
            }
            
            console.log('Setting display name to:', displayName);
            this.dom.userName.textContent = displayName;
        }
        if (this.dom.userBalance && typeof this.currentUser.balance === 'number') {
            this.dom.userBalance.textContent = `$${this.currentUser.balance.toLocaleString()}`;
        }
    }

    async validateAndUpdateUser() {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                console.log('No user ID found');
                return false;
            }
            
            console.log('Validating user with user ID:', userId);
            console.log('RoomApi available:', !!this.roomApi);
            console.log('RoomApi baseUrl:', this.roomApi?.baseUrl);
            
            // Используем RoomApi для консистентности
            console.log('Making request to /api/user/profile...');
            console.log('Current origin:', window.location.origin);
            console.log('API base URL:', this.roomApi.baseUrl);
            
            // Получаем профиль пользователя с user ID
            const response = await fetch('/api/user/profile', {
                headers: { 
                    'X-User-ID': userId,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.log('Profile request failed:', response.status);
                return false;
            }
            
            const data = await response.json();
            console.log('Profile data received:', data);
            console.log('Profile data type:', typeof data);
            console.log('Profile data keys:', data ? Object.keys(data) : 'null/undefined');
            
            if (data) {
                if (!data.id && data._id) {
                    data.id = data._id;
                }
                if (!data.id) {
                    console.log('Invalid user data received');
                    // Мягкий успех: используем уже сохранённого пользователя
                    return true;
                }
                localStorage.setItem('user', JSON.stringify(data));
                this.currentUser = data;
            } else {
                // Мягкий режим: профиль недоступен (404) на минимальном сервере
                console.log('Public profile not available, continue with cached user');
            }
            return true;
        } catch (error) {
            console.error('Failed to validate user', error);
            
            // Безопасная обработка свойств ошибки
            const errorMessage = error?.message || 'Unknown error';
            const errorName = error?.name || 'Unknown';
            const errorStatus = error?.status || 'unknown';
            
            console.log('Error details:', {
                message: errorMessage,
                name: errorName,
                status: errorStatus
            });
            
            // Удаляем user ID только при явных ошибках авторизации (не при 404)
            if (errorMessage.includes('401') || errorMessage.includes('403') || 
                errorMessage.includes('Unauthorized') || errorMessage.includes('Forbidden') ||
                errorMessage.includes('User not found') || errorMessage.includes('Invalid user ID')) {
                console.log('Authentication error, clearing user data');
                localStorage.removeItem('userId');
                localStorage.removeItem('user');
                return false;
            }
            
            // Для других ошибок (сеть, сервер, 404) — не удаляем токен, продолжаем
            if (errorMessage.includes('Load failed') || errorMessage.includes('Network error')) {
                console.log('Network error detected, keeping tokens for retry');
            } else {
                console.log('Server error, keeping tokens for retry');
            }
            return true;
        }
    }

    async loadUserStats() {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                console.log('No user ID found, skipping user stats');
                return;
            }
            
            // Загружаем статистику с user ID
            const response = await fetch('/api/user/stats', {
                headers: {
                    'X-User-ID': userId,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.log('Stats request failed:', response.status);
                return;
            }
            
            const stats = await response.json();
            if (this.dom.totalGames) this.dom.totalGames.textContent = stats.games_played ?? stats.gamesPlayed ?? 0;
            if (this.dom.totalWins) this.dom.totalWins.textContent = stats.wins_count ?? stats.totalWins ?? 0;
            if (this.dom.userLevel) this.dom.userLevel.textContent = stats.level ?? 1;
        } catch (error) {
            console.error('Failed to load user stats', error);
            // Не блокируем загрузку страницы из-за ошибки статистики
            // Но если это ошибка авторизации, то перенаправляем
            if (error.message && (error.message.includes('401') || error.message.includes('Сессия истекла'))) {
                console.log('Authorization error in loadUserStats, redirecting to login');
                this.showError(null, 'Сессия истекла. Необходимо войти в систему');
                setTimeout(() => {
                    window.location.href = '/auth.html';
                }, 2000);
            }
        }
    }

    async loadRooms(showLoading = true) {
        console.log('=== Загрузка комнат ===');
        console.log('User ID present:', !!localStorage.getItem('userId'));
        console.log('API available:', !!this.api);
        console.log('API baseUrl:', this.api?.baseUrl);
        
        // Проверяем user ID, но не блокируем загрузку если его нет
        const userId = localStorage.getItem('userId');
        if (!userId) {
            console.log('⚠️ No user ID found, but continuing with room loading');
        }
        
        try {
            if (showLoading) {
                this.setRoomsLoading(true);
            }
            console.log('Calling api.listRooms()...');
            const result = await this.api.listRooms();
            console.log('Rooms loaded successfully:', result);
            this.rooms = Array.isArray(result) ? result : [];
            this.renderRooms();
        } catch (error) {
            console.error('Failed to load rooms', error);
            console.log('Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
            
            // Проверяем, если это ошибка авторизации, то перенаправляем
            if (error.message && (error.message.includes('401') || error.message.includes('Сессия истекла'))) {
                console.log('Authorization error, redirecting to login');
                this.showError(this.dom.createRoomError, 'Сессия истекла. Необходимо войти в систему');
                setTimeout(() => {
                    window.location.href = '/auth.html';
                }, 2000);
            } else {
                this.showError(this.dom.createRoomError, error.message || 'Не удалось загрузить комнаты');
            }
        } finally {
            if (showLoading) {
                this.setRoomsLoading(false);
            }
        }
    }

    setRoomsLoading(isLoading) {
        const container = document.querySelector('.rooms-list');
        if (!container) return;
        container.classList.toggle('loading', isLoading);
    }

    renderRooms() {
        if (!this.dom.roomsList) return;
        if (!this.rooms.length) {
            this.dom.roomsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🛋️</div>
                    <div class="empty-title">Пока нет активных комнат</div>
                    <div class="empty-text">Создайте свою комнату или подождите, пока другие игроки создадут комнаты.</div>
                </div>`;
            return;
        }

        // Sort: newest rooms first (by updatedAt, last_activity, createdAt)
        const parseTs = (r) => {
            const lastActivity = Number(r.last_activity || r.lastActivity || 0);
            const updated = r.updatedAt || r.updated_at || null;
            const created = r.createdAt || r.created_at || null;
            const updatedTs = updated ? Date.parse(updated) : 0;
            const createdTs = created ? Date.parse(created) : 0;
            return Math.max(lastActivity || 0, updatedTs || 0, createdTs || 0);
        };
        const sorted = [...this.rooms].sort((a, b) => parseTs(b) - parseTs(a));

        this.dom.roomsList.innerHTML = sorted.map(room => this.renderRoomCard(room)).join('');
        this.bindRoomActions();
    }

    renderRoomCard(room) {
        const isInRoom = room.players?.some(player => player.userId === this.currentUser?.id || player.user_id?.toString() === this.currentUser?.id?.toString());
        const players = room.players || [];
        const freeSlots = Math.max(0, (room.maxPlayers || 4) - players.length);
        const statusClass = this.getRoomStatusClass(room);
        const statusText = this.getRoomStatusText(room);
        const createdAt = room.createdAt || room.created_at;
        const canJoin = !room.gameStarted && players.length < (room.maxPlayers || 4);
        const joinLabel = isInRoom ? 'Войти в комнату' : (canJoin ? 'Присоединиться' : 'Комната заполнена');

        return `
            <div class="room-card" data-room-id="${room.id}">
                <div class="room-header">
                    <div>
                        <div class="room-title">${room.name}</div>
                        <div class="room-meta">Создатель: ${room.creatorName || (room.players?.find(p => p.isHost)?.name) || 'Неизвестно'}</div>
                    </div>
                    <div class="room-status ${statusClass}">${statusText}</div>
                </div>
                <div class="room-details">
                    <div class="detail-item">
                        <span>👥 Игроков:</span>
                        <span>${players.length}/${room.maxPlayers || 4}</span>
                    </div>
                    <div class="detail-item">
                        <span>⏱️ Ход:</span>
                        <span>${room.turnTime || 3} мин</span>
                    </div>
                    <div class="detail-item">
                        <span>🕐 Создана:</span>
                        <span>${createdAt ? new Date(createdAt).toLocaleString('ru-RU') : '-'}</span>
                    </div>
                </div>
                <div class="room-players">
                    ${players.map(player => `
                        <div class="player-avatar ${player.userId?.toString() === this.currentUser?.id ? 'current-user' : ''}" title="${player.name || player.user_name || 'Игрок'}">
                            ${(player.name || player.user_name || 'И')[0].toUpperCase()}
                        </div>
                    `).join('')}
                    ${Array(freeSlots).fill('<div class="empty-slot"></div>').join('')}
                </div>
                <div class="room-actions">
                    <button class="join-btn ${isInRoom ? 'in-room' : ''}"
                        data-room-id="${room.id}"
                        ${(!canJoin && !isInRoom) ? 'disabled' : ''}>
                        ${joinLabel}
                    </button>
                </div>
            </div>
        `;
    }

    getRoomStatusClass(room) {
        if (room.players?.length >= (room.maxPlayers || 4)) return 'status-full';
        if (room.gameStarted || room.game_started) return 'status-playing';
        return 'status-waiting';
    }

    getRoomStatusText(room) {
        if (room.players?.length >= (room.maxPlayers || 4)) return 'Заполнена';
        if (room.gameStarted || room.game_started) return 'Игра идет';
        return 'Ожидание';
    }

    bindRoomActions() {
        this.dom.roomsList?.querySelectorAll('.room-card').forEach(card => {
            card.addEventListener('click', (event) => this.handleRoomCardClick(event, card.dataset.roomId));
        });
        this.dom.roomsList?.querySelectorAll('.join-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                this.joinRoom(button.dataset.roomId);
            });
        });
    }

    handleRoomCardClick(event, roomId) {
        this.selectedRoomId = roomId;
        this.dom.roomsList?.querySelectorAll('.room-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.roomId === roomId);
        });
    }

    showCreateRoomModal() {
        if (!this.dom.createRoomModal) return;
        this.dom.createRoomModal.style.display = 'flex';
        this.dom.createRoomForm?.reset();
        this.dom.createRoomError.textContent = '';
        this.dom.createRoomError.style.display = 'none';
        document.querySelectorAll('.profession-card').forEach(card => card.classList.remove('selected'));
        const firstCard = document.querySelector('.profession-card');
        if (firstCard) {
            firstCard.classList.add('selected');
            this.selectedProfession = firstCard.dataset.profession;
        }
        setTimeout(() => this.dom.roomName?.focus(), 100);
    }

    hideCreateRoomModal() {
        if (this.dom.createRoomModal) {
            this.dom.createRoomModal.style.display = 'none';
        }
    }

    showJoinRoomModal(roomId) {
        if (!this.dom.joinRoomModal) return;
        this.selectedRoomId = roomId;
        this.dom.joinRoomError.textContent = '';
        this.dom.joinRoomError.style.display = 'none';
        this.dom.joinRoomPassword.value = '';
        this.dom.joinRoomLoading.style.display = 'none';
        this.dom.joinRoomModal.style.display = 'flex';
    }

    hideJoinRoomModal() {
        if (this.dom.joinRoomModal) {
            this.dom.joinRoomModal.style.display = 'none';
        }
    }

    selectProfession(element) {
        document.querySelectorAll('.profession-card').forEach(card => card.classList.remove('selected'));
        element.classList.add('selected');
        this.selectedProfession = element.dataset.profession;
    }

    async createRoom() {
        if (!this.dom.createRoomForm) return;
        const name = this.dom.roomName?.value?.trim();
        if (!name) {
            return this.showError(this.dom.createRoomError, 'Введите название комнаты');
        }
        const payload = {
            name,
            max_players: Number(this.dom.maxPlayers?.value || 4),
            // Отправляем в секундах, сервер ожидает 30-600 секунд
            turn_time: Number(this.dom.turnTime?.value || 2) * 60,
            assign_professions: Boolean(this.dom.assignProfessions?.checked),
            password: this.dom.roomPassword?.value || null,
            profession: this.selectedProfession
        };

        try {
            this.showLoader(this.dom.createRoomLoading, true);
            const room = await this.api.createRoom(payload);
            if (room?.id) {
                localStorage.setItem('currentRoomId', room.id);
                localStorage.setItem('currentRoom', JSON.stringify(room));
                try {
                    const joinResult = await this.api.joinRoom(room.id, {});
                    if (joinResult?.room) {
                        localStorage.setItem('currentRoom', JSON.stringify(joinResult.room));
                    }
                } catch (joinError) {
                    console.warn('Auto-join after creation failed:', joinError);
                }
                this.hideCreateRoomModal();
                const username = (this.currentUser?.username || this.currentUser?.email?.split('@')[0] || 'player').toString();
                window.location.assign(`/room/u/${encodeURIComponent(username)}`);
                return;
            }
            this.showError(this.dom.createRoomError, 'Комната создана, но отсутствует идентификатор');
        } catch (error) {
            this.showError(this.dom.createRoomError, error.message || 'Не удалось создать комнату');
        } finally {
            this.showLoader(this.dom.createRoomLoading, false);
            await this.loadRooms(false);
        }
    }

    async joinRoom(roomId) {
        if (!roomId) return;
        const room = this.rooms.find(r => r.id === roomId);
        try {
            const result = await this.api.joinRoom(roomId, {});
            localStorage.setItem('currentRoomId', roomId);
            const roomData = result?.room || room || null;
            if (roomData) {
                localStorage.setItem('currentRoom', JSON.stringify(roomData));
            }
            const username = (this.currentUser?.username || this.currentUser?.email?.split('@')[0] || 'player').toString();
            window.location.assign(`/room/u/${encodeURIComponent(username)}`);
        } catch (error) {
            if (room?.requiresPassword) {
                this.showJoinRoomModal(roomId);
                this.showError(this.dom.joinRoomError, error.message || 'Требуется пароль комнаты');
            } else {
                this.showJoinRoomModal(roomId);
                this.showError(this.dom.joinRoomError, error.message || 'Не удалось присоединиться к комнате');
                this.showLoader(this.dom.joinRoomLoading, false);
            }
        }
    }

    async confirmJoinRoom() {
        if (!this.selectedRoomId) return;
        try {
            this.showLoader(this.dom.joinRoomLoading, true);
            const password = this.dom.joinRoomPassword?.value;
            const result = await this.api.joinRoom(this.selectedRoomId, password ? { password } : {});
            localStorage.setItem('currentRoomId', this.selectedRoomId);
            const room = result?.room || this.rooms.find(r => r.id === this.selectedRoomId);
            if (room) {
                localStorage.setItem('currentRoom', JSON.stringify(room));
            }
            const username = (this.currentUser?.username || this.currentUser?.email?.split('@')[0] || 'player').toString();
            window.location.assign(`/room/u/${encodeURIComponent(username)}`);
        } catch (error) {
            this.showError(this.dom.joinRoomError, error.message || 'Не удалось присоединиться к комнате');
        } finally {
            this.showLoader(this.dom.joinRoomLoading, false);
        }
    }

    async quickJoin() {
        const available = this.rooms.find(room => !room.gameStarted && (room.players?.length || 0) < (room.maxPlayers || 4));
        if (!available) {
            return this.showError(this.dom.createRoomError, 'Нет доступных комнат. Создайте свою!');
        }
        try {
            const password = available.requiresPassword ? this.dom.joinRoomPassword?.value : null;
            const result = await this.api.joinRoom(available.id, password ? { password } : {});
            localStorage.setItem('currentRoomId', available.id);
            const room = result?.room || available;
            if (room) {
                localStorage.setItem('currentRoom', JSON.stringify(room));
            }
            const username = (this.currentUser?.username || this.currentUser?.email?.split('@')[0] || 'player').toString();
            window.location.assign(`/room/u/${encodeURIComponent(username)}`);
        } catch (error) {
            this.showError(this.dom.createRoomError, error.message || 'Не удалось присоединиться к комнате');
        }
    }

    showLoader(element, show) {
        if (!element) return;
        element.style.display = show ? 'flex' : 'none';
    }

    showError(target, message) {
        if (!target) {
            // Если target null, показываем alert
            if (message) {
                alert(message);
            }
            return;
        }
        target.textContent = message;
        target.style.display = message ? 'block' : 'none';
    }

    logout() {
        console.log('=== Logout called ===');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('userId');
        this.currentUser = null;
        console.log('Cleared localStorage, redirecting to auth');
        window.location.href = '/auth.html';
    }
}

// Экспортируем в window для глобального доступа
window.LobbyModule = LobbyModule;
console.log('✅ LobbyModule экспортирован в window');
