const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SQLiteDatabase {
    constructor() {
        this.db = null;
        // На Railway используем /app для постоянного хранения
        this.dbPath = process.env.RAILWAY_ENVIRONMENT 
            ? '/app/game_data.sqlite' 
            : path.join(__dirname, 'game_data.sqlite');
        this.initialized = false;
    }

    async init() {
        return new Promise((resolve, reject) => {
            console.log('🔍 Подключение к SQLite по пути:', this.dbPath);
            console.log('🔍 Railway environment:', process.env.RAILWAY_ENVIRONMENT);
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Ошибка подключения к SQLite:', err.message);
                    reject(err);
                    return;
                }
                console.log('✅ Подключено к SQLite базе данных');
                this.initialized = true;
                this.createTables().then(resolve).catch(reject);
            });
        });
    }

    async createTables() {
        // Migration: Add missing columns to existing tables
        try {
            // Check if active_index column exists
            const tableInfo = await this.all(`PRAGMA table_info(rooms)`);
            const hasActiveIndex = tableInfo.some(col => col.name === 'active_index');
            
            if (!hasActiveIndex) {
                console.log('🔄 Adding active_index column to rooms table...');
                await this.run(`ALTER TABLE rooms ADD COLUMN active_index INTEGER DEFAULT 0`);
                console.log('✅ Added active_index column to rooms table');
            }
        } catch (error) {
            console.warn('⚠️ Migration failed (non-critical):', error.message);
        }

        // Migration: Update existing rooms to have creator_name from host player
        try {
            const roomsWithoutCreator = await this.all(`SELECT id FROM rooms WHERE creator_name IS NULL OR creator_name = ''`);
            for (const room of roomsWithoutCreator) {
                const hostPlayer = await this.get(`SELECT name FROM room_players WHERE room_id = ? AND is_host = 1 LIMIT 1`, [room.id]);
                if (hostPlayer?.name) {
                    await this.run(`UPDATE rooms SET creator_name = ? WHERE id = ?`, [hostPlayer.name, room.id]);
                    console.log(`✅ Updated creator_name for room ${room.id}: ${hostPlayer.name}`);
                }
            }
        } catch (error) {
            console.warn('⚠️ Migration failed (non-critical):', error.message);
        }

        const tables = [
            // Таблица пользователей
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                first_name TEXT DEFAULT '',
                last_name TEXT DEFAULT '',
                username TEXT DEFAULT '',
                telegram_id TEXT DEFAULT NULL,
                balance INTEGER DEFAULT 10000,
                level INTEGER DEFAULT 1,
                experience INTEGER DEFAULT 0,
                games_played INTEGER DEFAULT 0,
                wins_count INTEGER DEFAULT 0,
                referrals_count INTEGER DEFAULT 0,
                referral_code TEXT DEFAULT NULL,
                referral_earnings INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Таблица комнат
            `CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                creator_id TEXT NOT NULL,
                creator_name TEXT NOT NULL,
                creator_avatar TEXT DEFAULT NULL,
                max_players INTEGER DEFAULT 4,
                min_players INTEGER DEFAULT 2,
                turn_time INTEGER DEFAULT 3,
                assign_professions BOOLEAN DEFAULT 0,
                game_started BOOLEAN DEFAULT 0,
                status TEXT DEFAULT 'waiting',
                active_index INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_activity INTEGER DEFAULT 0,
                FOREIGN KEY (creator_id) REFERENCES users (id)
            )`,

            // Таблица игроков в комнатах
            `CREATE TABLE IF NOT EXISTS room_players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                avatar TEXT DEFAULT NULL,
                is_host BOOLEAN DEFAULT 0,
                is_ready BOOLEAN DEFAULT 0,
                selected_dream INTEGER DEFAULT NULL,
                selected_token TEXT DEFAULT NULL,
                dream_achieved BOOLEAN DEFAULT 0,
                position INTEGER DEFAULT 0,
                track TEXT DEFAULT 'inner',
                cash INTEGER DEFAULT 10000,
                passive_income INTEGER DEFAULT 0,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(room_id, user_id)
            )`,

            // Таблица активов игроков
            `CREATE TABLE IF NOT EXISTS player_assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                asset_id TEXT NOT NULL,
                card_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                size TEXT NOT NULL,
                purchase_price INTEGER NOT NULL,
                monthly_income INTEGER NOT NULL,
                acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,

            // Таблица игровых состояний
            `CREATE TABLE IF NOT EXISTS game_states (
                room_id TEXT PRIMARY KEY,
                started_at INTEGER DEFAULT NULL,
                active_player_index INTEGER DEFAULT 0,
                turn_order TEXT DEFAULT '[]',
                phase TEXT DEFAULT 'awaiting_roll',
                last_roll TEXT DEFAULT NULL,
                pending_deal TEXT DEFAULT NULL,
                small_deck TEXT DEFAULT '[]',
                big_deck TEXT DEFAULT '[]',
                expense_deck TEXT DEFAULT '[]',
                history TEXT DEFAULT '[]',
                FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }

        // Индекс уникальности для username (кроме пустых значений)
        await this.run(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username) WHERE username <> ''`);

        console.log('✅ Таблицы SQLite созданы/обновлены');
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌ SQLite error:', err.message);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('❌ SQLite error:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('❌ SQLite error:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // User management methods
    async createUser(userData) {
        const { email, password, first_name, last_name, username, telegram_id, balance = 10000, level = 1, experience = 0, games_played = 0, wins_count = 0, referrals_count = 0, referral_earnings = 0, is_active = true } = userData;
        
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        
        const sql = `INSERT INTO users (id, email, password, first_name, last_name, username, telegram_id, balance, level, experience, games_played, wins_count, referrals_count, referral_earnings, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const params = [userId, email.toLowerCase().trim(), password, first_name || '', last_name || '', username || '', telegram_id || null, balance, level, experience, games_played, wins_count, referrals_count, referral_earnings, is_active];
        
        await this.run(sql, params);
        
        console.log('✅ Пользователь создан в SQLite:', { userId, email });
        return await this.getUserById(userId);
    }

    async getUserByEmail(email) {
        const sql = `SELECT * FROM users WHERE email = ?`;
        return await this.get(sql, [email.toLowerCase().trim()]);
    }

    async getUserByUsername(username) {
        const sql = `SELECT * FROM users WHERE LOWER(username) = LOWER(?)`;
        return await this.get(sql, [String(username || '').trim()]);
    }

    async getUserById(userId) {
        const sql = `SELECT * FROM users WHERE id = ?`;
        return await this.get(sql, [userId]);
    }

    async updateUser(userId, updateData) {
        const fields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updateData)) {
            if (key !== 'id') {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (fields.length === 0) return null;
        
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(userId);
        
        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        await this.run(sql, values);
        
        console.log('✅ Пользователь обновлен в SQLite:', { userId });
        return await this.getUserById(userId);
    }

    async deleteUser(userId) {
        const sql = `DELETE FROM users WHERE id = ?`;
        const result = await this.run(sql, [userId]);
        console.log('✅ Пользователь удален из SQLite:', { userId });
        return result.changes > 0;
    }

    async getAllUsers() {
        const sql = `SELECT * FROM users ORDER BY created_at DESC`;
        return await this.all(sql);
    }

    // Room management methods
    async createRoom(roomData) {
        const { id, name, creatorId, creatorName, creatorAvatar, maxPlayers = 4, minPlayers = 2, turnTime = 3, assignProfessions = false } = roomData;
        
        const sql = `INSERT INTO rooms (id, name, creator_id, creator_name, creator_avatar, max_players, min_players, turn_time, assign_professions) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const params = [id, name, creatorId, creatorName, creatorAvatar || null, maxPlayers, minPlayers, turnTime, assignProfessions ? 1 : 0];
        
        await this.run(sql, params);
        
        console.log('✅ Комната создана в SQLite:', { id, name });
        return await this.getRoom(id);
    }

    async getRoom(roomId) {
        const sql = `SELECT r.*, 
                            COUNT(rp.user_id) as players_count,
                            COUNT(CASE WHEN rp.is_ready = 1 THEN 1 END) as ready_count
                     FROM rooms r 
                     LEFT JOIN room_players rp ON r.id = rp.room_id 
                     WHERE r.id = ? 
                     GROUP BY r.id`;
        
        const room = await this.get(sql, [roomId]);
        if (!room) return null;
        
        room.canStart = room.players_count >= room.min_players && room.ready_count >= room.min_players;
        return room;
    }

    async getAllRooms() {
        const sql = `SELECT r.*, 
                            COUNT(rp.user_id) as players_count,
                            COUNT(CASE WHEN rp.is_ready = 1 THEN 1 END) as ready_count
                     FROM rooms r 
                     LEFT JOIN room_players rp ON r.id = rp.room_id 
                     GROUP BY r.id 
                     ORDER BY r.last_activity DESC`;
        
        const rooms = await this.all(sql);
        return rooms.map(room => ({
            ...room,
            canStart: room.players_count >= room.min_players && room.ready_count >= room.min_players
        }));
    }

    async addPlayerToRoom(roomId, playerData) {
        const { userId, name, avatar, isHost = false, selectedDream = null, selectedToken = null, isReady = false, position = 0, track = 'small', cash = 10000, passiveIncome = 0 } = playerData;

        const sql = `INSERT OR REPLACE INTO room_players (room_id, user_id, name, avatar, is_host, is_ready, selected_dream, selected_token, position, track, cash, passive_income)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            roomId,
            userId,
            name,
            avatar || null,
            isHost ? 1 : 0,
            isReady ? 1 : 0,
            selectedDream ?? null,
            selectedToken ?? null,
            Math.max(0, Number(position) || 0),
            String(track || 'small'),
            Math.floor(Number(cash) || 10000),
            Math.floor(Number(passiveIncome) || 0)
        ];

        await this.run(sql, params);
        await this.updateRoomActivity(roomId);

        console.log('✅ Игрок добавлен в комнату SQLite:', { roomId, userId, name });
    }

    async getRoomPlayers(roomId) {
        const sql = `SELECT * FROM room_players WHERE room_id = ? ORDER BY joined_at ASC`;
        return await this.all(sql, [roomId]);
    }

    async updatePlayerReady(roomId, userId, isReady) {
        const sql = `UPDATE room_players SET is_ready = ? WHERE room_id = ? AND user_id = ?`;
        await this.run(sql, [isReady ? 1 : 0, roomId, userId]);
        await this.updateRoomActivity(roomId);
        console.log('✅ Готовность игрока обновлена в SQLite:', { roomId, userId, isReady });
    }

    async updatePlayerState(roomId, userId, { position, track, cash, passiveIncome }) {
        const fields = [];
        const values = [];
        if (position !== undefined) { fields.push('position = ?'); values.push(Math.max(0, Number(position) || 0)); }
        if (track !== undefined) { fields.push('track = ?'); values.push(String(track)); }
        if (cash !== undefined) { fields.push('cash = ?'); values.push(Math.floor(Number(cash) || 0)); }
        if (passiveIncome !== undefined) { fields.push('passive_income = ?'); values.push(Math.floor(Number(passiveIncome) || 0)); }
        if (!fields.length) return;
        const sql = `UPDATE room_players SET ${fields.join(', ')} WHERE room_id = ? AND user_id = ?`;
        values.push(roomId, userId);
        await this.run(sql, values);
        await this.updateRoomActivity(roomId);
        console.log('✅ Состояние игрока сохранено в SQLite:', { roomId, userId, position, track, cash, passiveIncome });
    }

    async updatePlayerSelection(roomId, userId, { dreamId = null, tokenId = null }) {
        const sql = `UPDATE room_players SET selected_dream = ?, selected_token = ? WHERE room_id = ? AND user_id = ?`;
        await this.run(sql, [dreamId, tokenId, roomId, userId]);
        await this.updateRoomActivity(roomId);
        console.log('✅ Выбор игрока обновлен в SQLite:', { roomId, userId, dreamId, tokenId });
    }

    async removePlayerFromRoom(roomId, userId) {
        const sql = `DELETE FROM room_players WHERE room_id = ? AND user_id = ?`;
        await this.run(sql, [roomId, userId]);
        await this.updateRoomActivity(roomId);
        console.log('✅ Игрок удален из комнаты SQLite:', { roomId, userId });
    }

    async markRoomStatus(roomId, { status, gameStarted }) {
        const sql = `UPDATE rooms SET status = ?, game_started = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        await this.run(sql, [status, gameStarted ? 1 : 0, roomId]);
    }

    async updateRoom(roomId, data) {
        const fields = [];
        const values = [];
        
        if (data.name !== undefined) {
            fields.push('name = ?');
            values.push(data.name);
        }
        if (data.status !== undefined) {
            fields.push('status = ?');
            values.push(data.status);
        }
        if (data.gameStarted !== undefined) {
            fields.push('game_started = ?');
            values.push(data.gameStarted ? 1 : 0);
        }
        if (data.updated_at !== undefined) {
            fields.push('updated_at = ?');
            values.push(data.updated_at);
        }
        
        if (fields.length === 0) return;
        
        values.push(roomId);
        const sql = `UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`;
        await this.run(sql, values);
        console.log('✅ Комната обновлена в SQLite:', { roomId, data });
    }

    async setRoomHost(roomId, userId) {
        const sql = `UPDATE room_players SET is_host = CASE WHEN user_id = ? THEN 1 ELSE 0 END WHERE room_id = ?`;
        await this.run(sql, [userId, roomId]);
    }

    async getRoomWithPlayers(roomId) {
        const room = await this.getRoom(roomId);
        if (!room) return null;
        const players = await this.getRoomPlayers(roomId);
        return { room, players };
    }

    async updateRoomActivity(roomId) {
        const sql = `UPDATE rooms SET last_activity = ? WHERE id = ?`;
        await this.run(sql, [Date.now(), roomId]);
    }

    async deleteRoom(roomId) {
        const sql = `DELETE FROM rooms WHERE id = ?`;
        const result = await this.run(sql, [roomId]);
        console.log('✅ Комната удалена из SQLite:', { roomId });
        return result.changes > 0;
    }

    // Сохранение состояния комнаты
    async saveRoomState(room) {
        try {
            // Обновляем основную информацию о комнате
            const roomSql = `UPDATE rooms SET 
                status = ?, 
                game_started = ?, 
                active_index = ?,
                creator_name = ?,
                updated_at = CURRENT_TIMESTAMP,
                last_activity = ?
                WHERE id = ?`;
            
            const gameStarted = room.status === 'playing' ? 1 : 0;
            const lastActivity = room.lastActivity || Date.now();
            await this.run(roomSql, [room.status, gameStarted, room.activeIndex || 0, room.creatorName || 'Игрок', lastActivity, room.id]);

            // Обновляем игроков
            if (room.players && room.players.length > 0) {
                for (const player of room.players) {
                    const playerSql = `UPDATE room_players SET 
                        position = ?, 
                        track = ?, 
                        cash = ?, 
                        passive_income = ?,
                        is_ready = ?
                        WHERE room_id = ? AND user_id = ?`;
                    
                    await this.run(playerSql, [
                        player.position || 0,
                        player.track || 'inner',
                        player.cash || 10000,
                        player.passiveIncome || 0,
                        player.isReady ? 1 : 0,
                        room.id,
                        player.userId
                    ]);
                }
            }

            console.log('✅ Состояние комнаты сохранено:', room.id);
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения состояния комнаты:', error);
            return false;
        }
    }

    // Загрузка состояния комнаты
    async loadRoomState(roomId) {
        try {
            const room = await this.getRoom(roomId);
            if (!room) return null;

            const players = await this.getRoomPlayers(roomId);
            
            // Преобразуем данные в формат, ожидаемый сервером
            const roomState = {
                id: room.id,
                name: room.name,
                status: room.status,
                maxPlayers: room.max_players,
                minPlayers: room.min_players,
                turnTime: room.turn_time,
                assignProfessions: room.assign_professions ? true : false,
                gameStarted: room.game_started ? true : false,
                createdAt: room.created_at,
                updatedAt: room.updated_at,
                activeIndex: room.active_index || 0,
                creatorName: room.creator_name || (players.find(p => p.is_host)?.name) || 'Игрок',
                lastActivity: room.last_activity || Date.now(),
                players: players.map(p => ({
                    userId: p.user_id,
                    name: p.name,
                    avatar: p.avatar,
                    isHost: p.is_host ? true : false,
                    isReady: p.is_ready ? true : false,
                    selectedDream: p.selected_dream,
                    selectedToken: p.selected_token,
                    dreamAchieved: p.dream_achieved ? true : false,
                    position: p.position || 0,
                    track: p.track || 'inner',
                    cash: p.cash || 10000,
                    passiveIncome: p.passive_income || 0,
                    tokenOffset: 0 // Будет установлен при загрузке
                }))
            };

            console.log('✅ Состояние комнаты загружено:', roomId);
            return roomState;
        } catch (error) {
            console.error('❌ Ошибка загрузки состояния комнаты:', error);
            return null;
        }
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Ошибка закрытия SQLite:', err.message);
                    } else {
                        console.log('✅ SQLite база данных закрыта');
                    }
                    resolve();
                });
            });
        }
    }
}

module.exports = SQLiteDatabase;
