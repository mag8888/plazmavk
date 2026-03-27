/**
 * ESM RoomApi — высокоуровневый API-клиент для лобби и игровых комнат.
 * Экспортируется как `export default` и используется через `import RoomApi from '.../RoomApi.esm.js'`.
 */

const SAFARI_UA_PATTERN = /\bVersion\/\d+.*Safari\b/i;
const SAFARI_EXCLUDE_PATTERN = /\b(Chrome|CriOS|Chromium|Edg|OPR|SamsungBrowser)\b/i;
const DEFAULT_REQUEST_TIMEOUT = 15000;

function safeJsonParse(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (_e) { return null; }
}

function detectSafari() {
    if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
    const ua = navigator.userAgent;
    return SAFARI_UA_PATTERN.test(ua) && !SAFARI_EXCLUDE_PATTERN.test(ua);
}

export default class RoomApi {
    constructor(baseUrl = null) {
        if (baseUrl) {
            this.baseUrl = baseUrl.replace(/\/$/, '');
        } else if (typeof window !== 'undefined') {
            const { hostname, origin } = window.location;
            this.baseUrl = (hostname === 'localhost' || hostname === '127.0.0.1')
                ? 'http://localhost:8080'
                : origin.replace(/\/$/, '');
        } else {
            this.baseUrl = '';
        }
        this.defaultHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };
        this._isSafari = null;
    }

    getCurrentUser() {
        try {
            const stored = localStorage.getItem('user');
            if (!stored) return null;
            const parsed = JSON.parse(stored);
            if (parsed && !parsed.id && parsed._id) parsed.id = parsed._id;
            return parsed;
        } catch (_e) { return null; }
    }

    buildHeaders(extra = {}) {
        const headers = { ...this.defaultHeaders, ...extra };
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                headers.Authorization = `Bearer ${token}`;
                console.log('🔍 RoomApi.buildHeaders: token=present');
            } else {
                console.log('🔍 RoomApi.buildHeaders: token=missing');
            }
        } catch (_e) {
            console.log('🔍 RoomApi.buildHeaders: token=error');
        }
        const user = this.getCurrentUser();
        if (user?.id) {
            headers['X-User-ID'] = user.id;
            headers['X-User-Name'] = user.first_name || user.username || user.email || 'Игрок';
            console.log('🔍 RoomApi.buildHeaders: user=', user.id);
        } else {
            console.log('🔍 RoomApi.buildHeaders: user=null');
        }
        console.log('🔍 RoomApi.buildHeaders: final headers=', headers);
        return headers;
    }

    createFetchConfig(method, headers, body) {
        const built = this.buildHeaders(headers);
        if (method === 'GET') {
            delete built['Content-Type'];
            // Для GET не удаляем X-User-ID и X-User-Name - они нужны для авторизации
        }
        const config = { method, headers: built };
        if (method !== 'GET' && body !== undefined) {
            config.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        console.log('🔍 RoomApi.createFetchConfig: method=', method, 'config=', config);
        return config;
    }

    async request(endpoint, { method = 'GET', headers = {}, body } = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = this.createFetchConfig(method, headers, body);
        const response = await this.sendWithFallback(url, config);
        if (!response.ok) {
            if (this.shouldDropAuthToken(response.status)) {
                try {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                } catch (_e) {}
            }
            throw new Error(this.extractErrorMessage(response));
        }
        return response.data;
    }

    async requestPublic(endpoint, { method = 'GET', headers = {}, body } = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const publicHeaders = { Accept: 'application/json', ...(headers || {}) };
        const config = { method, headers: publicHeaders };
        if (method !== 'GET' && body !== undefined) {
            config.headers['Content-Type'] = 'application/json';
            config.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        const response = await this.sendWithFallback(url, config);
        if (!response.ok) throw new Error(this.extractErrorMessage(response));
        return response.data;
    }

    shouldDropAuthToken(status) { return status === 401 || status === 403; }

    extractErrorMessage(response) {
        const data = response.data;
        if (data && typeof data === 'object') return data.message || data.error || data.detail || `HTTP ${response.status}`;
        if (response.bodyText) {
            const text = response.bodyText.trim();
            return text || response.statusText || `HTTP ${response.status}`;
        }
        return response.statusText || `HTTP ${response.status}`;
    }

    async sendWithFallback(url, config) {
        try { return await this.sendViaFetch(url, config); }
        catch (error) {
            if (!this.isSafariBrowser() || !this.isLikelyCorsError(error)) throw error;
            const safariConfig = this.prepareSafariConfig(config);
            try { return await this.sendViaFetch(url, safariConfig); }
            catch (_safariFetchError) {
                try { return await this.sendViaXhr(url, safariConfig); }
                catch (_xhrError) {
                    try { return await this.sendViaFetch(url, this.prepareMinimalConfig(config)); }
                    catch (_minimalError) {
                        const data = await this.sendViaIframe(url, config);
                        return { ok: true, status: 200, statusText: 'OK', headers: null, data, bodyText: JSON.stringify(data) };
                    }
                }
            }
        }
    }

    async sendViaFetch(url, config) {
        if (typeof fetch === 'undefined') throw new Error('Fetch API not supported in this browser');
        const requestConfig = this.cloneRequestConfig(config);
        requestConfig.credentials = 'include';
        requestConfig.mode = 'cors';
        const response = await fetch(url, requestConfig);
        const bodyText = response.status === 204 ? '' : await response.text();
        return { ok: response.ok, status: response.status, statusText: response.statusText, headers: response.headers, data: safeJsonParse(bodyText), bodyText };
    }

    sendViaXhr(url, config) {
        const requestConfig = this.cloneRequestConfig(config);
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            try { xhr.open(requestConfig.method, url, true); } catch (_e) { reject(new Error('Failed to open XMLHttpRequest')); return; }
            xhr.timeout = DEFAULT_REQUEST_TIMEOUT;
            xhr.withCredentials = true;
            Object.entries(requestConfig.headers || {}).forEach(([k, v]) => { try { xhr.setRequestHeader(k, v); } catch (_e) {} });
            xhr.onload = () => {
                const bodyText = xhr.responseText || '';
                resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, statusText: xhr.statusText, headers: null, data: safeJsonParse(bodyText), bodyText });
            };
            xhr.onerror = () => reject(new Error('Network error'));
            xhr.ontimeout = () => reject(new Error('Request timeout'));
            xhr.onabort = () => reject(new Error('Request aborted'));
            try { xhr.send(requestConfig.body); } catch (_e) { reject(new Error('Failed to send XMLHttpRequest')); }
        });
    }

    sendViaIframe(url) {
        return new Promise((resolve, reject) => {
            try {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = url;
                const cleanup = () => { try { document.body.removeChild(iframe); } catch (_e) {} };
                iframe.onload = () => {
                    try {
                        const text = iframe.contentDocument?.body?.innerText || iframe.contentDocument?.body?.textContent || '';
                        const json = safeJsonParse(text);
                        cleanup();
                        if (json) resolve(json); else reject(new Error('Iframe JSON parse failed'));
                    } catch (e) { cleanup(); reject(e); }
                };
                iframe.onerror = () => { cleanup(); reject(new Error('Iframe load error')); };
                document.body.appendChild(iframe);
            } catch (e) { reject(e); }
        });
    }

    cloneRequestConfig(config) {
        const cloned = { method: config.method, headers: { ...(config.headers || {}) } };
        if (config.body !== undefined) cloned.body = config.body;
        return cloned;
    }

    prepareSafariConfig(config) {
        const headers = {};
        if (config.headers?.Authorization) headers.Authorization = config.headers.Authorization;
        headers.Accept = 'application/json';
        if (config.body && config.headers?.['Content-Type']) headers['Content-Type'] = config.headers['Content-Type'];
        return { method: config.method, headers, body: config.body };
    }

    prepareMinimalConfig(config) { const minimal = { method: config.method, headers: {} }; if (config.body !== undefined) minimal.body = config.body; return minimal; }
    isLikelyCorsError(error) { if (!error) return false; const m = String(error.message || error); const n = error.name || ''; return n === 'TypeError' || m.includes('Failed to fetch') || m.includes('Load failed') || m.includes('Network request failed'); }
    isSafariBrowser() { if (this._isSafari === null) this._isSafari = detectSafari(); return this._isSafari; }

    async listRooms() {
        try { const data = await this.request('/api/rooms'); return data?.rooms || []; }
        catch (error) {
            try { const data = await this.requestPublic('/api/rooms/safari'); return data?.rooms || []; }
            catch (_safariError) { throw error; }
        }
    }

    async getPublicProfile() { try { return await this.request('/api/user/profile'); } catch (_e) { return null; } }
    async createRoom(payload) { const data = await this.request('/api/rooms', { method: 'POST', body: payload }); return data.room; }
    async getRoom(roomId, params = {}) { const query = new URLSearchParams({ ...params }).toString(); const url = query ? `/api/rooms/${roomId}?${query}` : `/api/rooms/${roomId}`; const data = await this.request(url); return data.room; }
    async joinRoom(roomId, payload = {}) { return this.request(`/api/rooms/${roomId}/join`, { method: 'POST', body: payload }); }
    async leaveRoom(roomId, payload = {}) { return this.request(`/api/rooms/${roomId}/leave`, { method: 'POST', body: payload }); }
    async selectDream(roomId, dreamId) { const data = await this.request(`/api/rooms/${roomId}/dream`, { method: 'POST', body: { dream_id: dreamId } }); return data.room; }
    async selectToken(roomId, tokenId) { const data = await this.request(`/api/rooms/${roomId}/token`, { method: 'POST', body: { token_id: tokenId } }); return data.room; }
    async toggleReady(roomId) { const data = await this.request(`/api/rooms/${roomId}/ready`, { method: 'POST', body: {} }); return data.room; }
    async startGame(roomId) { const data = await this.request(`/api/rooms/${roomId}/start`, { method: 'POST', body: {} }); return data.room; }
    async getGameState(roomId) { const data = await this.request(`/api/rooms/${roomId}/game-state`); return data.state; }
    async rollDice(roomId) { return this.request(`/api/rooms/${roomId}/roll`, { method: 'POST', body: {} }); }
    async chooseDeal(roomId, size) { return this.request(`/api/rooms/${roomId}/deals/choose`, { method: 'POST', body: { size } }); }
    async resolveDeal(roomId, action) { return this.request(`/api/rooms/${roomId}/deals/resolve`, { method: 'POST', body: { action } }); }
    async transferAsset(roomId, assetId, targetUserId) { return this.request(`/api/rooms/${roomId}/assets/transfer`, { method: 'POST', body: { asset_id: assetId, target_user_id: targetUserId } }); }
    async sellAsset(roomId, assetId) { return this.request(`/api/rooms/${roomId}/assets/sell`, { method: 'POST', body: { asset_id: assetId } }); }
    async endTurn(roomId) { const data = await this.request(`/api/rooms/${roomId}/end-turn`, { method: 'POST', body: {} }); return data.state; }
}


