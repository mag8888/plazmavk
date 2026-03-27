// RoomModule будет доступен глобально

function extractRoomId() {
    // 1) Если на vanity-роуте /room/u/:username — берем из localStorage
    if (window.location.pathname.startsWith('/room/u/')) {
        const stored = localStorage.getItem('currentRoomId');
        if (stored) return stored;
        // Фолбэк: пробуем взять из сохраненного объекта комнаты
        try {
            const room = JSON.parse(localStorage.getItem('currentRoom') || 'null');
            if (room?.id) return room.id;
        } catch(_) {}
    }

    // 2) Попробуем взять из query (?roomId=...)
    try {
        const params = new URLSearchParams(window.location.search);
        const q = params.get('roomId');
        if (q) return q;
    } catch(_) {}

    // 3) Фолбэк: последний сегмент пути как roomId
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts.pop();
}

// Ждем загрузки RoomModule
function waitForRoomModule() {
    return new Promise((resolve) => {
        const checkModule = () => {
            if (window.RoomModule) {
                resolve();
            } else {
                setTimeout(checkModule, 100);
            }
        };
        checkModule();
    });
}

(async () => {
    try {
        console.log('Waiting for RoomModule...');
        await waitForRoomModule();
        console.log('RoomModule loaded, initializing...');
        
        const roomId = extractRoomId();
        const module = new window.RoomModule({ roomId });
        await module.init();
        console.log('Room module initialized successfully');
    } catch (error) {
        console.error('Инициализация комнаты завершилась с ошибкой:', error);
    }
})();
