// Простая инициализация лобби
function initLobby() {
    console.log('=== Инициализация лобби ===');
    
    // Проверяем доступность модулей
    if (!window.RoomApi) {
        console.error('❌ RoomApi не найден');
        console.log('Доступные глобальные объекты:', Object.keys(window).filter(key => key.includes('Room') || key.includes('Lobby')));
        return;
    }
    
    if (!window.LobbyModule) {
        console.error('❌ LobbyModule не найден');
        console.log('Доступные глобальные объекты:', Object.keys(window).filter(key => key.includes('Room') || key.includes('Lobby')));
        return;
    }
    
    console.log('✅ Модули найдены');
    
    try {
        console.log('Создание экземпляра LobbyModule...');
        const lobby = new window.LobbyModule({ api: new window.RoomApi(), pollInterval: 10000 });
        console.log('Инициализация LobbyModule...');
        lobby.init().then(() => {
            console.log('✅ LobbyModule инициализирован успешно');
        }).catch(error => {
            console.error('❌ Lobby initialisation failed:', error);
        });
    } catch (error) {
        console.error('❌ Lobby creation failed:', error);
    }
}

// Добавляем детальное логирование загрузки
console.log('=== Загрузка lobby/index.js ===');
console.log('Document ready state:', document.readyState);
console.log('Scripts loaded:', document.querySelectorAll('script[src]').length);

// Проверяем загрузку скриптов
let scriptsLoaded = 0;
const totalScripts = 4; // RoomApi, LobbyModule, index.js, DebugPanel

function checkScriptsLoaded() {
    scriptsLoaded++;
    console.log(`Скрипт загружен: ${scriptsLoaded}/${totalScripts}`);
    
    if (scriptsLoaded >= totalScripts) {
        console.log('Все скрипты загружены, инициализируем лобби...');
        setTimeout(initLobby, 100); // Небольшая задержка для гарантии
    }
}

// Инициализируем сразу или ждем загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM загружен, проверяем скрипты...');
        checkScriptsLoaded();
    });
} else {
    console.log('DOM уже загружен, проверяем скрипты...');
    checkScriptsLoaded();
}

// Дополнительная проверка через 2 секунды
setTimeout(() => {
    if (scriptsLoaded < totalScripts) {
        console.log('Не все скрипты загружены, принудительная инициализация...');
        initLobby();
    }
}, 2000);
