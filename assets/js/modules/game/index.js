// Cache-bust to ensure clients always load the latest GameModule
import GameModule from './GameModule.js?v=2';

function getRoomId() {
    try {
        const stored = localStorage.getItem('currentRoomId');
        if (stored && String(stored).trim()) {
            return String(stored).trim();
        }
    } catch (_) {}

    // Fallbacks: ?roomId=... or #roomId
    try {
        const url = new URL(window.location.href);
        const q = url.searchParams.get('roomId');
        if (q && q.trim()) return q.trim();
    } catch (_) {}

    const hash = (window.location.hash || '').replace(/^#/, '').trim();
    if (hash) return hash;

    return null;
}

(async () => {
    const roomId = getRoomId();
    if (!roomId) {
        console.error('Room ID not found');
        window.location.assign('/');
        return;
    }
    try {
        const module = new GameModule({ roomId });
        await module.init();
    } catch (error) {
        console.error('Failed to initialize GameModule:', error);
    }
})();
