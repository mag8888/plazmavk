/**
 * Отладочная панель для навигации по всем сценариям
 * Добавляется внизу всех страниц для удобства тестирования
 */

class DebugPanel {
    constructor() {
        this.isVisible = false; // По умолчанию закрыта
        this.panel = null;
        this.init();
    }

    init() {
        this.createPanel();
        this.attachEvents();
        this.addToAllPages();
    }

    createPanel() {
        // Создаем плавающую кнопку для открытия
        this.createFloatingButton();
        
        // Создаем панель
        this.panel = document.createElement('div');
        this.panel.id = 'debug-panel';
        this.panel.innerHTML = `
            <div class="debug-panel-content">
                <div class="debug-panel-header">
                    <h3>🐛 Отладочная панель</h3>
                    <button id="debug-toggle" class="debug-toggle-btn">Развернуть</button>
                </div>
                <div class="debug-panel-body">
                    <div class="debug-section">
                        <h4>🧭 Навигация</h4>
                        <div class="debug-buttons">
                            <button class="debug-btn" onclick="window.location.href='/auth.html'">
                                🔐 Логин
                            </button>
                            <button class="debug-btn" onclick="window.location.href='/lobby.html'">
                                🏠 Лобби
                            </button>
                            <button class="debug-btn" onclick="window.location.href='/room.html'">
                                🚪 Комната
                            </button>
                            <button class="debug-btn" onclick="window.location.href='/index.html'">
                                🎮 Игровая доска
                            </button>
                        </div>
                    </div>
                    
                    <div class="debug-section">
                        <h4>🧪 Тестирование</h4>
                        <div class="debug-buttons">
                            <button class="debug-btn" onclick="window.location.href='/test-all-scenarios.html'">
                                🧪 Все тесты
                            </button>
                            <button class="debug-btn" onclick="window.location.href='/test-cells.html'">
                                🎯 Тест клеток
                            </button>
                            <button class="debug-btn" onclick="window.location.href='/test-game-integration.html'">
                                🔗 Интеграция
                            </button>
                            <button class="debug-btn" onclick="window.location.href='/debug.html'">
                                🐛 Отладка
                            </button>
                        </div>
                    </div>
                    
                    <div class="debug-section">
                        <h4>📊 API Тесты</h4>
                        <div class="debug-buttons">
                            <button class="debug-btn" onclick="testAPI('health')">
                                ❤️ Health
                            </button>
                            <button class="debug-btn" onclick="testAPI('auth')">
                                🔐 Auth
                            </button>
                            <button class="debug-btn" onclick="testAPI('rooms')">
                                🏠 Rooms
                            </button>
                            <button class="debug-btn" onclick="showDebugInfo()">
                                ℹ️ Инфо
                            </button>
                        </div>
                    </div>
                    
                    <div class="debug-section">
                        <h4>🎮 Игровые функции</h4>
                        <div class="debug-buttons">
                            <button class="debug-btn" onclick="testGameCore()">
                                🎯 GameCore
                            </button>
                            <button class="debug-btn" onclick="testDice()">
                                🎲 Кубики
                            </button>
                            <button class="debug-btn" onclick="testMovement()">
                                👤 Движение
                            </button>
                            <button class="debug-btn" onclick="clearStorage()">
                                🗑️ Очистить
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Добавляем стили
        this.addStyles();
    }

    createFloatingButton() {
        // Создаем плавающую кнопку
        this.floatingButton = document.createElement('div');
        this.floatingButton.id = 'debug-floating-btn';
        this.floatingButton.innerHTML = '🐛';
        this.floatingButton.title = 'Открыть отладочную панель';
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Плавающая кнопка */
            #debug-floating-btn {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                cursor: pointer;
                z-index: 10001;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                transition: all 0.3s ease;
                user-select: none;
            }

            #debug-floating-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
            }

            #debug-floating-btn:active {
                transform: scale(0.95);
            }

            /* Скрываем кнопку когда панель открыта */
            #debug-panel:not(.collapsed) ~ #debug-floating-btn {
                display: none;
            }

            #debug-panel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                border-top: 2px solid #00e5ff;
                box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
                z-index: 10000;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                max-height: 60vh;
                overflow-y: auto;
                transition: all 0.3s ease;
            }

            .debug-panel-content {
                padding: 15px;
            }

            .debug-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #333;
            }

            .debug-panel-header h3 {
                color: #00e5ff;
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }

            .debug-toggle-btn {
                background: #ff6b6b;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s;
            }

            .debug-toggle-btn:hover {
                background: #ff5252;
            }

            .debug-panel-body {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
            }

            .debug-section h4 {
                color: #ffffff;
                margin: 0 0 10px 0;
                font-size: 14px;
                font-weight: 500;
            }

            .debug-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .debug-btn {
                background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.2s;
                white-space: nowrap;
            }

            .debug-btn:hover {
                background: linear-gradient(135deg, #43A047 0%, #388E3C 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }

            .debug-btn:active {
                transform: translateY(0);
            }

            /* Свернутое состояние */
            #debug-panel.collapsed .debug-panel-body {
                display: none;
            }

            #debug-panel.collapsed {
                max-height: 50px;
            }

            #debug-panel.collapsed .debug-toggle-btn {
                content: "Развернуть";
            }

            /* Адаптивность */
            @media (max-width: 768px) {
                .debug-panel-body {
                    grid-template-columns: 1fr;
                }
                
                .debug-buttons {
                    justify-content: center;
                }
                
                .debug-btn {
                    flex: 1;
                    min-width: 120px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    attachEvents() {
        // Обработчик кнопки сворачивания
        document.addEventListener('click', (e) => {
            if (e.target.id === 'debug-toggle') {
                this.toggle();
            }
            // Обработчик плавающей кнопки
            if (e.target.id === 'debug-floating-btn') {
                this.toggle();
            }
        });

        // Глобальные функции для кнопок
        window.testAPI = this.testAPI.bind(this);
        window.showDebugInfo = this.showDebugInfo.bind(this);
        window.testGameCore = this.testGameCore.bind(this);
        window.testDice = this.testDice.bind(this);
        window.testMovement = this.testMovement.bind(this);
        window.clearStorage = this.clearStorage.bind(this);
    }

    addToAllPages() {
        // Добавляем плавающую кнопку
        document.body.appendChild(this.floatingButton);
        // Добавляем панель на все страницы
        document.body.appendChild(this.panel);
        // Сразу сворачиваем панель при добавлении
        this.panel.classList.add('collapsed');
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.panel.classList.toggle('collapsed', !this.isVisible);
        
        const toggleBtn = document.getElementById('debug-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = this.isVisible ? 'Свернуть' : 'Развернуть';
        }
    }

    // API тесты
    async testAPI(type) {
        const baseUrl = window.location.origin;
        let url, method = 'GET', body = null;

        switch (type) {
            case 'health':
                url = `${baseUrl}/api/health`;
                break;
            case 'auth':
                url = `${baseUrl}/api/auth/login`;
                method = 'POST';
                body = JSON.stringify({
                    email: 'test@example.com',
                    password: 'test123'
                });
                break;
            case 'rooms':
                url = `${baseUrl}/api/rooms`;
                break;
        }

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body
            });
            
            const data = await response.json();
            console.log(`✅ ${type.toUpperCase()} API:`, data);
            alert(`✅ ${type.toUpperCase()} API: ${response.status} - ${JSON.stringify(data).substring(0, 100)}...`);
        } catch (error) {
            console.error(`❌ ${type.toUpperCase()} API Error:`, error);
            alert(`❌ ${type.toUpperCase()} API Error: ${error.message}`);
        }
    }

    showDebugInfo() {
        const info = {
            url: window.location.href,
            userAgent: navigator.userAgent,
            localStorage: Object.keys(localStorage),
            sessionStorage: Object.keys(sessionStorage),
            gameCore: window.gameCore ? 'Available' : 'Not available',
            timestamp: new Date().toISOString()
        };
        
        console.log('🐛 Debug Info:', info);
        alert(`🐛 Debug Info:\nURL: ${info.url}\nGameCore: ${info.gameCore}\nStorage: ${info.localStorage.length} items`);
    }

    testGameCore() {
        if (window.gameCore) {
            console.log('✅ GameCore available:', window.gameCore);
            alert('✅ GameCore доступен!');
        } else {
            console.log('❌ GameCore not available');
            alert('❌ GameCore недоступен');
        }
    }

    testDice() {
        if (window.gameCore) {
            const diceModule = window.gameCore.getModule('diceModule');
            if (diceModule) {
                diceModule.roll().then(result => {
                    console.log('🎲 Dice result:', result);
                    alert(`🎲 Результат броска: ${result.total}`);
                });
            } else {
                alert('❌ DiceModule недоступен');
            }
        } else {
            alert('❌ GameCore недоступен');
        }
    }

    testMovement() {
        if (window.gameCore) {
            const movementModule = window.gameCore.getModule('movementModule');
            if (movementModule) {
                const result = movementModule.move(0, 5, 44);
                console.log('👤 Movement result:', result);
                alert(`👤 Движение: 0 + 5 = ${result}`);
            } else {
                alert('❌ MovementModule недоступен');
            }
        } else {
            alert('❌ GameCore недоступен');
        }
    }

    clearStorage() {
        if (confirm('🗑️ Очистить все данные хранилища?')) {
            localStorage.clear();
            sessionStorage.clear();
            console.log('🗑️ Storage cleared');
            alert('🗑️ Данные очищены!');
        }
    }
}

// Автоматическая инициализация
document.addEventListener('DOMContentLoaded', () => {
    if (!window.debugPanelInstance) {
        window.debugPanelInstance = new DebugPanel();
    }
});
