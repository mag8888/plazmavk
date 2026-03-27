const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, 'game_rooms.db');
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Ошибка подключения к SQLite:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Подключение к SQLite установлено');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const createRoomsTable = `
                CREATE TABLE IF NOT EXISTS rooms (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    creator_id TEXT NOT NULL,
                    creator_name TEXT NOT NULL,
                    max_players INTEGER DEFAULT 4,
                    min_players INTEGER DEFAULT 2,
                    game_started BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_activity INTEGER DEFAULT 0,
                    data TEXT
                )
            `;

            const createPlayersTable = `
                CREATE TABLE IF NOT EXISTS room_players (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    avatar TEXT,
                    selected_dream TEXT,
                    selected_token TEXT,
                    is_ready BOOLEAN DEFAULT 0,
                    is_host BOOLEAN DEFAULT 0,
                    position INTEGER DEFAULT 0,
                    balance INTEGER DEFAULT 1000,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
                    UNIQUE(room_id, user_id)
                )
            `;

            this.db.exec(createRoomsTable, (err) => {
                if (err) {
                    console.error('❌ Ошибка создания таблицы rooms:', err.message);
                    reject(err);
                    return;
                }

                this.db.exec(createPlayersTable, (err) => {
                    if (err) {
                        console.error('❌ Ошибка создания таблицы room_players:', err.message);
                        reject(err);
                        return;
                    }

                    console.log('✅ Таблицы базы данных созданы');
                    resolve();
                });
            });
        });
    }

    async createRoom(roomData) {
        return new Promise((resolve, reject) => {
            const { id, name, creatorId, creatorName, maxPlayers = 4, minPlayers = 2 } = roomData;
            
            const sql = `
                INSERT INTO rooms (id, name, creator_id, creator_name, max_players, min_players, last_activity)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(sql, [id, name, creatorId, creatorName, maxPlayers, minPlayers, Date.now()], function(err) {
                if (err) {
                    console.error('❌ Ошибка создания комнаты:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Комната создана:', id);
                    resolve({ id, name, creatorId, creatorName, maxPlayers, minPlayers });
                }
            });
        });
    }

    async getRoom(roomId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT r.*, 
                       COUNT(rp.user_id) as players_count,
                       COUNT(CASE WHEN rp.is_ready = 1 THEN 1 END) as ready_count
                FROM rooms r
                LEFT JOIN room_players rp ON r.id = rp.room_id
                WHERE r.id = ?
                GROUP BY r.id
            `;
            
            this.db.get(sql, [roomId], (err, row) => {
                if (err) {
                    console.error('❌ Ошибка получения комнаты:', err.message);
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve(this.formatRoom(row));
                }
            });
        });
    }

    async getAllRooms() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT r.*, 
                       COUNT(rp.user_id) as players_count,
                       COUNT(CASE WHEN rp.is_ready = 1 THEN 1 END) as ready_count
                FROM rooms r
                LEFT JOIN room_players rp ON r.id = rp.room_id
                WHERE r.game_started = 0
                GROUP BY r.id
                ORDER BY r.last_activity DESC
            `;
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('❌ Ошибка получения комнат:', err.message);
                    reject(err);
                } else {
                    const rooms = rows.map(row => this.formatRoom(row));
                    resolve(rooms);
                }
            });
        });
    }

    async addPlayerToRoom(roomId, playerData) {
        return new Promise((resolve, reject) => {
            const { userId, name, avatar, isHost = false } = playerData;
            
            const sql = `
                INSERT OR REPLACE INTO room_players 
                (room_id, user_id, name, avatar, is_host, created_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            this.db.run(sql, [roomId, userId, name, avatar, isHost ? 1 : 0], function(err) {
                if (err) {
                    console.error('❌ Ошибка добавления игрока:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Игрок добавлен в комнату:', { roomId, userId, name });
                    resolve();
                }
            });
        });
    }

    async getRoomPlayers(roomId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT user_id, name, avatar, selected_dream, selected_token, 
                       is_ready, is_host, position, balance
                FROM room_players 
                WHERE room_id = ?
                ORDER BY created_at ASC
            `;
            
            this.db.all(sql, [roomId], (err, rows) => {
                if (err) {
                    console.error('❌ Ошибка получения игроков:', err.message);
                    reject(err);
                } else {
                    const players = rows.map(row => ({
                        userId: row.user_id,
                        name: row.name,
                        avatar: row.avatar,
                        selectedDream: row.selected_dream,
                        selectedToken: row.selected_token,
                        isReady: Boolean(row.is_ready),
                        isHost: Boolean(row.is_host),
                        position: row.position,
                        balance: row.balance
                    }));
                    resolve(players);
                }
            });
        });
    }

    async updatePlayerReady(roomId, userId, isReady) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE room_players 
                SET is_ready = ?, updated_at = CURRENT_TIMESTAMP
                WHERE room_id = ? AND user_id = ?
            `;
            
            this.db.run(sql, [isReady ? 1 : 0, roomId, userId], function(err) {
                if (err) {
                    console.error('❌ Ошибка обновления готовности:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Готовность игрока обновлена:', { roomId, userId, isReady });
                    resolve();
                }
            });
        });
    }

    async updateRoomActivity(roomId) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE rooms SET last_activity = ? WHERE id = ?`;
            
            this.db.run(sql, [Date.now(), roomId], function(err) {
                if (err) {
                    console.error('❌ Ошибка обновления активности:', err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async deleteRoom(roomId) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM rooms WHERE id = ?`;
            
            this.db.run(sql, [roomId], function(err) {
                if (err) {
                    console.error('❌ Ошибка удаления комнаты:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Комната удалена:', roomId);
                    resolve();
                }
            });
        });
    }

    formatRoom(row) {
        return {
            id: row.id,
            name: row.name,
            creatorId: row.creator_id,
            creatorName: row.creator_name,
            maxPlayers: row.max_players,
            minPlayers: row.min_players,
            gameStarted: Boolean(row.game_started),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastActivity: row.last_activity,
            playersCount: row.players_count || 0,
            readyCount: row.ready_count || 0,
            canStart: (row.players_count || 0) >= row.min_players && (row.ready_count || 0) >= row.min_players
        };
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Ошибка закрытия БД:', err.message);
                    } else {
                        console.log('✅ Соединение с БД закрыто');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = Database;
