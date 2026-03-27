/**
 * RoomApi — высокоуровневый API-клиент для лобби и игровых комнат.
 * Содержит унифицированную обработку ошибок и резервные варианты для Safari.
 */

// Проверяем, не загружен ли уже модуль
if (window.RoomApi) {
    if (window.DEBUG_API || window.DEBUG) {
        console.log('RoomApi уже загружен, пропускаем повторную загрузку');
    }
} else {

const SAFARI_UA_PATTERN = /\bVersion\/\d+.*Safari\b/i;
const SAFARI_EXCLUDE_PATTERN = /\b(Chrome|CriOS|Chromium|Edg|OPR|SamsungBrowser)\b/i;
const DEFAULT_REQUEST_TIMEOUT = 15000;

function safeJsonParse(text) {
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

function detectSafari() {
    if (typeof navigator === 'undefined' || !navigator.userAgent) {
        return false;
    }
    const ua = navigator.userAgent;
    return SAFARI_UA_PATTERN.test(ua) && !SAFARI_EXCLUDE_PATTERN.test(ua);
}

class RoomApi {
    constructor(baseUrl = null) {
        if (baseUrl) {
            this.baseUrl = baseUrl.replace(/\/$/, '');
        } else if (typeof window !== 'undefined') {
            // По умолчанию используем тот же origin, где открыт фронтенд,
            // чтобы исключить 404 из-за несоответствия окружений.
            const { origin } = window.location;
            this.baseUrl = origin ? origin.replace(/\/$/, '') : '';
        } else {
            this.baseUrl = '';
        }

        this.defaultHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        };

        this._isSafari = null;
    }

    getCurrentUser() {
        try {
            const stored = localStorage.getItem('user');
            if (!stored) return null;
            const parsed = JSON.parse(stored);
            if (parsed && !parsed.id && parsed._id) {
                parsed.id = parsed._id;
            }
            return parsed;
        } catch (error) {
            console.warn('RoomApi: failed to parse user from storage', error);
            return null;
        }
    }

    buildHeaders(extra = {}) {
        const headers = {
            ...this.defaultHeaders,
            ...extra
        };

        try {
            const userId = localStorage.getItem('userId');
            if (window.DEBUG_API || window.DEBUG) {
                console.log('🔍 RoomApi: localStorage userId:', userId);
            }
            if (userId) {
                headers['X-User-ID'] = userId;
            }
        } catch (error) {
            console.warn('RoomApi: unable to read userId', error);
        }

        const user = this.getCurrentUser();
        if (window.DEBUG_API || window.DEBUG) {
            console.log('🔍 RoomApi: getCurrentUser returned:', user);
        }
        if (user?.id && !headers['X-User-ID']) {
            headers['X-User-ID'] = user.id;
            if (window.DEBUG_API || window.DEBUG) {
                console.log('🔍 RoomApi: Set X-User-ID from user.id:', user.id);
            }
        }
        if (user?.first_name || user?.username || user?.email) {
            headers['X-User-Name'] = user.first_name || user.username || user.email || 'Игрок';
        }
        if (window.DEBUG_API || window.DEBUG) {
            console.log('🔍 RoomApi: Final headers:', headers);
        }
        return headers;
    }

    createFetchConfig(method, headers, body) {
        const built = this.buildHeaders(headers);
        // Для GET не указываем Content-Type чтобы не вызывать preflight
        if (method === 'GET') {
            delete built['Content-Type'];
        }
        const config = { method, headers: built };
        if (method !== 'GET' && body !== undefined) {
            config.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        return config;
    }

    async request(endpoint, { method = 'GET', headers = {}, body } = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = this.createFetchConfig(method, headers, body);
        const response = await this.sendWithFallback(url, config);

        if (!response.ok) {
            if (this.shouldDropUserData(response.status)) {
                try {
                    localStorage.removeItem('userId');
                    localStorage.removeItem('user');
                } catch (error) {
                    console.warn('RoomApi: failed to clear user storage', error);
                }
            }
            throw new Error(this.extractErrorMessage(response));
        }

        return response.data;
    }

    // Публичный запрос без Authorization/X-User-* заголовков, чтобы избежать CORS preflight
    async requestPublic(endpoint, { method = 'GET', headers = {}, body } = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const publicHeaders = {
            Accept: 'application/json',
            ...(headers || {})
        };
        // Не добавляем Content-Type для GET, чтобы не вызывать preflight
        const config = {
            method,
            headers: publicHeaders
        };
        if (method !== 'GET' && body !== undefined) {
            // Для публичных POST можно добавить content-type при необходимости
            config.headers['Content-Type'] = 'application/json';
            config.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        const response = await this.sendWithFallback(url, config);
        if (!response.ok) {
            throw new Error(this.extractErrorMessage(response));
        }
        return response.data;
    }

    shouldDropUserData(status) {
        return status === 401; // Only clear on 401 (unauthorized), not on 403 (forbidden)
    }

    extractErrorMessage(response) {
        const data = response.data;
        if (data && typeof data === 'object') {
            return data.message || data.error || data.detail || `HTTP ${response.status}`;
        }
        if (response.bodyText) {
            const text = response.bodyText.trim();
            return text || response.statusText || `HTTP ${response.status}`;
        }
        return response.statusText || `HTTP ${response.status}`;
    }

    async sendWithFallback(url, config) {
        try {
            return await this.sendViaFetch(url, config);
        } catch (error) {
            if (!this.isSafariBrowser() || !this.isLikelyCorsError(error)) {
                throw error;
            }

            const safariConfig = this.prepareSafariConfig(config);
            try {
                return await this.sendViaFetch(url, safariConfig);
            } catch (safariFetchError) {
                try {
                    return await this.sendViaXhr(url, safariConfig);
                } catch (xhrError) {
                    try {
                        return await this.sendViaFetch(url, this.prepareMinimalConfig(config));
                    } catch (minimalError) {
                        // Последний шанс: загрузка через скрытый iframe (same-origin)
                        try {
                            const data = await this.sendViaIframe(url, config);
                            return { ok: true, status: 200, statusText: 'OK', headers: null, data, bodyText: JSON.stringify(data) };
                        } catch (iframeError) {
                            const fallbackError = new Error('CORS error in Safari - please try refreshing the page');
                            fallbackError.cause = iframeError;
                            throw fallbackError;
                        }
                    }
                }
            }
        }
    }

    async sendViaFetch(url, config) {
        if (typeof fetch === 'undefined') {
            throw new Error('Fetch API not supported in this browser');
        }

        const requestConfig = this.cloneRequestConfig(config);
        // Do not send cookies with wildcard CORS; tokens go via Authorization header
        requestConfig.credentials = 'omit';
        requestConfig.mode = 'cors';
        const response = await fetch(url, requestConfig);
        const bodyText = response.status === 204 ? '' : await response.text();

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: safeJsonParse(bodyText),
            bodyText
        };
    }

    sendViaXhr(url, config) {
        const requestConfig = this.cloneRequestConfig(config);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            try {
                xhr.open(requestConfig.method, url, true);
            } catch (error) {
                reject(new Error('Failed to open XMLHttpRequest'));
                return;
            }

            xhr.timeout = DEFAULT_REQUEST_TIMEOUT;
            // Do not send cookies with wildcard CORS
            xhr.withCredentials = false;

            Object.entries(requestConfig.headers || {}).forEach(([key, value]) => {
                try {
                    xhr.setRequestHeader(key, value);
                } catch (error) {
                    // Игнорируем невозможность установки заголовка
                }
            });

            xhr.onload = () => {
                const bodyText = xhr.responseText || '';
                resolve({
                    ok: xhr.status >= 200 && xhr.status < 300,
                    status: xhr.status,
                    statusText: xhr.statusText,
                    headers: null,
                    data: safeJsonParse(bodyText),
                    bodyText
                });
            };

            xhr.onerror = () => reject(new Error('Network error'));
            xhr.ontimeout = () => reject(new Error('Request timeout'));
            xhr.onabort = () => reject(new Error('Request aborted'));

            try {
                xhr.send(requestConfig.body);
            } catch (error) {
                reject(new Error('Failed to send XMLHttpRequest'));
            }
        });
    }

    // Фолбэк для Safari: загрузка JSON через скрытый iframe (работает на same-origin)
    sendViaIframe(url) {
        return new Promise((resolve, reject) => {
            try {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = url;
                const cleanup = () => {
                    try { document.body.removeChild(iframe); } catch (_) {}
                };
                iframe.onload = () => {
                    try {
                        const text = iframe.contentDocument?.body?.innerText || iframe.contentDocument?.body?.textContent || '';
                        const json = safeJsonParse(text);
                        cleanup();
                        if (json) resolve(json); else reject(new Error('Iframe JSON parse failed'));
                    } catch (e) {
                        cleanup();
                        reject(e);
                    }
                };
                iframe.onerror = () => { cleanup(); reject(new Error('Iframe load error')); };
                document.body.appendChild(iframe);
            } catch (e) {
                reject(e);
            }
        });
    }

    cloneRequestConfig(config) {
        const cloned = {
            method: config.method,
            headers: { ...(config.headers || {}) }
        };

        if (config.body !== undefined) {
            cloned.body = config.body;
        }

        return cloned;
    }

    prepareSafariConfig(config) {
        const headers = {};

        if (config.headers?.Authorization) {
            headers.Authorization = config.headers.Authorization;
        }

        headers.Accept = 'application/json';

        if (config.body && config.headers?.['Content-Type']) {
            headers['Content-Type'] = config.headers['Content-Type'];
        }

        return {
            method: config.method,
            headers,
            body: config.body
        };
    }

    prepareMinimalConfig(config) {
        const minimal = {
            method: config.method,
            headers: {}
        };

        if (config.body !== undefined) {
            minimal.body = config.body;
        }

        return minimal;
    }

    isLikelyCorsError(error) {
        if (!error) {
            return false;
        }
        const message = String(error.message || error);
        const name = error.name || '';
        return name === 'TypeError' ||
            message.includes('Failed to fetch') ||
            message.includes('Load failed') ||
            message.includes('Network request failed');
    }

    isSafariBrowser() {
        if (this._isSafari === null) {
            this._isSafari = detectSafari();
        }
        return this._isSafari;
    }

    async listRooms() {
        try {
            const data = await this.request('/api/rooms');
            return data?.rooms || [];
        } catch (error) {
            console.log('Regular rooms endpoint failed, trying Safari/public endpoint:', error.message);
            try {
                const data = await this.requestPublic('/api/rooms/safari');
                return data?.rooms || [];
            } catch (safariError) {
                console.log('Safari endpoint also failed, trying last-resort fetch without headers');
                try {
                    const res = await fetch(`${this.baseUrl}/api/rooms/safari`);
                    if (res.ok) {
                        const data = await res.json();
                        return data?.rooms || [];
                    }
                } catch (_) {}
                throw error;
            }
        }
    }

    // Дополнительно: публичный профиль для проверки токена (минимальные данные)
    async getPublicProfile() {
        try {
            // Полноценный сервер: защищённый эндпоинт
            return await this.request('/api/user/profile');
        } catch (e) {
            // Фолбэк для минимального сервера (нет /api/user/profile, есть /api/user/profile/:username)
            try {
                const user = this.getCurrentUser();
                const username = user?.username || (user?.email ? user.email.split('@')[0] : null);
                if (!username) return null;
                // Публичный GET без лишних заголовков, чтобы избежать preflight
                return await this.requestPublic(`/api/user/profile/${encodeURIComponent(username)}`);
            } catch (_) {
                return null;
            }
        }
    }

    async createRoom(payload) {
        const data = await this.request('/api/rooms', {
            method: 'POST',
            body: payload
        });
        return data.room;
    }

    async getRoom(roomId, params = {}) {
        // Используем обычный request с X-User-ID для проверки принадлежности к комнате
        const url = `/api/rooms/${roomId}`;
        const data = await this.request(url);
        return data.room;
    }

    async joinRoom(roomId, payload = {}) {
        console.log(`🔍 RoomApi.joinRoom: присоединяемся к комнате ${roomId}`, payload);
        try {
            const result = await this.request(`/api/rooms/${roomId}/join`, {
                method: 'POST',
                body: payload
            });
            console.log(`🔍 RoomApi.joinRoom: результат присоединения:`, result);
            return result;
        } catch (error) {
            console.error(`❌ RoomApi.joinRoom: ошибка присоединения:`, error);
            throw error;
        }
    }

    async leaveRoom(roomId, payload = {}) {
        return this.request(`/api/rooms/${roomId}/leave`, {
            method: 'POST',
            body: payload
        });
    }

    async selectDream(roomId, dreamId) {
        const data = await this.request(`/api/rooms/${roomId}/dream`, {
            method: 'POST',
            body: { dream_id: dreamId }
        });
        return data.room;
    }

    async selectToken(roomId, tokenId) {
        const data = await this.request(`/api/rooms/${roomId}/token`, {
            method: 'POST',
            body: { token_id: tokenId }
        });
        return data.room;
    }

    async toggleReady(roomId) {
        const data = await this.request(`/api/rooms/${roomId}/ready`, {
            method: 'POST',
            body: {}
        });
        return data.room;
    }

    async startGame(roomId) {
        const data = await this.request(`/api/rooms/${roomId}/start`, {
            method: 'POST',
            body: {}
        });
        return data.room;
    }

    async getGameState(roomId) {
        const data = await this.request(`/api/rooms/${roomId}/game-state`);
        return data.state || data.gameState;
    }

    async rollDice(roomId) {
        // передаём X-User-ID в заголовках через this.request
        return this.request(`/api/rooms/${roomId}/roll`, { method: 'POST', body: {} });
    }

    async chooseDeal(roomId, size) {
        return this.request(`/api/rooms/${roomId}/deals/choose`, {
            method: 'POST',
            body: { size }
        });
    }

    async resolveDeal(roomId, action) {
        return this.request(`/api/rooms/${roomId}/deals/resolve`, {
            method: 'POST',
            body: { action }
        });
    }

    async transferAsset(roomId, assetId, targetUserId) {
        return this.request(`/api/rooms/${roomId}/assets/transfer`, {
            method: 'POST',
            body: { asset_id: assetId, target_user_id: targetUserId }
        });
    }

    async sellAsset(roomId, assetId) {
        return this.request(`/api/rooms/${roomId}/assets/sell`, {
            method: 'POST',
            body: { asset_id: assetId }
        });
    }

    async endTurn(roomId) {
        const data = await this.request(`/api/rooms/${roomId}/end-turn`, {
            method: 'POST',
            body: {}
        });
        return data.state;
    }
}

window.RoomApi = RoomApi;

} // Конец блока else для проверки существования модуля
