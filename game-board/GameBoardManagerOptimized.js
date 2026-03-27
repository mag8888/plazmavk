/**
 * Game Board Manager v2.1 - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ
 * 
 * ОСНОВНЫЕ ОПТИМИЗАЦИИ:
 * - Object pooling для объектов
 * - Lazy loading компонентов
 * - Memory leak prevention
 * - Efficient state management
 * - Reduced API calls
 */

class GameBoardManagerOptimized {
    constructor(containerId = 'game-board-container') {
        console.log('🎮 GameBoardManagerOptimized v2.1: Инициализация');
        
        this.containerId = containerId;
        this.service = null;
        this.ui = null;
        this.isInitialized = false;
        
        // OBJECT POOLING для переиспользования объектов
        this.objectPool = {
            notifications: [],
            animations: [],
            domElements: []
        };
        
        // LAZY LOADING флаги
        this.lazyLoaded = {
            service: false,
            ui: false,
            eventHandlers: false
        };
        
        // Состояние менеджера
        this.managerState = {
            gameActive: false,
            currentPhase: 'waiting',
            lastUpdate: null,
            errorCount: 0,
            performanceMetrics: {
                frameRate: 0,
                memoryUsage: 0,
                domOperations: 0
            }
        };
        
        // Конфигурация
        this.config = {
            autoSave: true,
            autoSaveInterval: 30000,
            maxErrors: 10,
            debugMode: false,
            performanceMonitoring: true,
            lazyLoadDelay: 100 // Задержка для lazy loading
        };
        
        // DEBOUNCED FUNCTIONS
        this.debouncedSave = this.debounce(this.saveGameState.bind(this), 1000);
        this.debouncedUpdate = this.debounce(this.updateManager.bind(this), 16);
        
        // PERFORMANCE MONITORING
        this.performanceObserver = null;
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        
        this.initializeManager();
    }

    /**
     * DEBOUNCE HELPER
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * THROTTLE HELPER
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * OBJECT POOLING - переиспользование объектов
     */
    getPooledObject(type) {
        if (this.objectPool[type] && this.objectPool[type].length > 0) {
            return this.objectPool[type].pop();
        }
        
        // Создаем новый объект если пул пуст
        return this.createPooledObject(type);
    }

    returnToPool(type, obj) {
        if (this.objectPool[type]) {
            // Очищаем объект перед возвратом в пул
            this.resetPooledObject(type, obj);
            this.objectPool[type].push(obj);
        }
    }

    createPooledObject(type) {
        switch (type) {
            case 'notifications':
                return {
                    id: null,
                    message: '',
                    type: 'info',
                    duration: 3000,
                    timestamp: 0
                };
            case 'animations':
                return {
                    id: null,
                    element: null,
                    startTime: 0,
                    duration: 0,
                    easing: 'ease'
                };
            case 'domElements':
                return document.createElement('div');
            default:
                return {};
        }
    }

    resetPooledObject(type, obj) {
        switch (type) {
            case 'notifications':
                obj.id = null;
                obj.message = '';
                obj.type = 'info';
                obj.duration = 3000;
                obj.timestamp = 0;
                break;
            case 'animations':
                obj.id = null;
                obj.element = null;
                obj.startTime = 0;
                obj.duration = 0;
                obj.easing = 'ease';
                break;
            case 'domElements':
                obj.innerHTML = '';
                obj.className = '';
                obj.style.cssText = '';
                break;
        }
    }

    /**
     * LAZY LOADING - загрузка компонентов по требованию
     */
    async lazyLoadService() {
        if (this.lazyLoaded.service) return this.service;
        
        console.log('🎮 GameBoardManagerOptimized: Lazy loading service...');
        
        // Имитация асинхронной загрузки
        await new Promise(resolve => setTimeout(resolve, this.config.lazyLoadDelay));
        
        this.service = new GameBoardService();
        this.lazyLoaded.service = true;
        
        return this.service;
    }

    async lazyLoadUI() {
        if (this.lazyLoaded.ui) return this.ui;
        
        console.log('🎮 GameBoardManagerOptimized: Lazy loading UI...');
        
        await new Promise(resolve => setTimeout(resolve, this.config.lazyLoadDelay));
        
        this.ui = new GameBoardUIOptimized(this.containerId);
        this.lazyLoaded.ui = true;
        
        return this.ui;
    }

    async lazyLoadEventHandlers() {
        if (this.lazyLoaded.eventHandlers) return;
        
        console.log('🎮 GameBoardManagerOptimized: Lazy loading event handlers...');
        
        await new Promise(resolve => setTimeout(resolve, this.config.lazyLoadDelay));
        
        this.addOptimizedEventHandlers();
        this.lazyLoaded.eventHandlers = true;
    }

    /**
     * ОПТИМИЗИРОВАННАЯ ИНИЦИАЛИЗАЦИЯ
     */
    async initializeManager() {
        try {
            console.log('🎮 GameBoardManagerOptimized: Инициализация компонентов');
            
            // Lazy loading основных компонентов
            await Promise.all([
                this.lazyLoadService(),
                this.lazyLoadUI(),
                this.lazyLoadEventHandlers()
            ]);
            
            // Инициализация performance monitoring
            if (this.config.performanceMonitoring) {
                this.initializePerformanceMonitoring();
            }
            
            this.isInitialized = true;
            console.log('🎮 GameBoardManagerOptimized: Менеджер инициализирован');
            
        } catch (error) {
            console.error('🎮 GameBoardManagerOptimized: Ошибка инициализации:', error);
            this.handleError(error);
        }
    }

    /**
     * PERFORMANCE MONITORING
     */
    initializePerformanceMonitoring() {
        // Мониторинг FPS
        const measureFPS = () => {
            const now = performance.now();
            this.frameCount++;
            
            if (now - this.lastFrameTime >= 1000) {
                this.managerState.performanceMetrics.frameRate = this.frameCount;
                this.frameCount = 0;
                this.lastFrameTime = now;
                
                // Логируем низкий FPS
                if (this.managerState.performanceMetrics.frameRate < 30) {
                    console.warn('🎮 GameBoardManagerOptimized: Низкий FPS:', this.managerState.performanceMetrics.frameRate);
                }
            }
            
            requestAnimationFrame(measureFPS);
        };
        
        measureFPS();
        
        // Мониторинг памяти (если доступен)
        if (performance.memory) {
            setInterval(() => {
                this.managerState.performanceMetrics.memoryUsage = performance.memory.usedJSHeapSize;
            }, 5000);
        }
    }

    /**
     * ОПТИМИЗИРОВАННЫЕ EVENT HANDLERS
     */
    addOptimizedEventHandlers() {
        // Используем event delegation
        document.addEventListener('gameStateChanged', this.handleGameStateChange.bind(this));
        document.addEventListener('playerMoved', this.handlePlayerMoved.bind(this));
        document.addEventListener('errorOccurred', this.handleError.bind(this));
        
        // Throttled handlers для частых событий
        document.addEventListener('uiUpdate', this.throttle(this.handleUIUpdate.bind(this), 16));
        document.addEventListener('animationFrame', this.throttle(this.handleAnimationFrame.bind(this), 16));
    }

    handleGameStateChange(event) {
        const { newState, oldState } = event.detail;
        
        // Обновляем только изменившиеся части состояния
        this.updateStateDiffs(oldState, newState);
        
        // Debounced save
        this.debouncedSave();
    }

    handlePlayerMoved(event) {
        const { playerId, fromPosition, toPosition, steps } = event.detail;
        
        // Lazy load UI если нужно
        if (this.ui) {
            this.ui.moveTokenOptimized(playerId, fromPosition, toPosition, steps);
        }
    }

    handleUIUpdate(event) {
        this.managerState.performanceMetrics.domOperations++;
        
        // Batch UI updates
        this.debouncedUpdate();
    }

    handleAnimationFrame(event) {
        this.frameCount++;
    }

    /**
     * ОПТИМИЗИРОВАННОЕ УПРАВЛЕНИЕ СОСТОЯНИЕМ
     */
    updateStateDiffs(oldState, newState) {
        const changes = this.getStateChanges(oldState, newState);
        
        changes.forEach(change => {
            this.applyStateChange(change);
        });
    }

    getStateChanges(oldState, newState) {
        const changes = [];
        
        // Сравниваем только изменившиеся свойства
        Object.keys(newState).forEach(key => {
            if (JSON.stringify(oldState[key]) !== JSON.stringify(newState[key])) {
                changes.push({
                    key,
                    oldValue: oldState[key],
                    newValue: newState[key]
                });
            }
        });
        
        return changes;
    }

    applyStateChange(change) {
        const { key, newValue } = change;
        
        // Применяем изменения только к затронутым компонентам
        switch (key) {
            case 'currentPhase':
                this.managerState.currentPhase = newValue;
                break;
            case 'gameActive':
                this.managerState.gameActive = newValue;
                break;
            // Добавить другие случаи по необходимости
        }
    }

    /**
     * ОПТИМИЗИРОВАННОЕ СОХРАНЕНИЕ
     */
    async saveGameState() {
        if (!this.config.autoSave) return;
        
        try {
            const state = this.getCurrentState();
            
            // Используем object pooling для уведомления
            const notification = this.getPooledObject('notifications');
            notification.message = 'Игра сохранена';
            notification.type = 'success';
            notification.timestamp = Date.now();
            
            // Показываем уведомление
            this.showNotification(notification);
            
            // Возвращаем объект в пул
            this.returnToPool('notifications', notification);
            
        } catch (error) {
            console.error('🎮 GameBoardManagerOptimized: Ошибка сохранения:', error);
            this.handleError(error);
        }
    }

    /**
     * ОПТИМИЗИРОВАННОЕ ОБНОВЛЕНИЕ МЕНЕДЖЕРА
     */
    updateManager() {
        // Обновляем только при необходимости
        if (!this.isInitialized) return;
        
        // Batch updates
        this.batchUpdateManager();
    }

    batchUpdateManager() {
        // Группируем обновления
        const updates = [];
        
        // Добавляем обновления в очередь
        if (this.managerState.lastUpdate) {
            updates.push({
                type: 'lastUpdate',
                value: Date.now()
            });
        }
        
        // Применяем все обновления сразу
        updates.forEach(update => {
            this.applyManagerUpdate(update);
        });
    }

    applyManagerUpdate(update) {
        switch (update.type) {
            case 'lastUpdate':
                this.managerState.lastUpdate = update.value;
                break;
        }
    }

    /**
     * ОПТИМИЗИРОВАННЫЕ УВЕДОМЛЕНИЯ
     */
    showNotification(notification) {
        if (!this.ui) return;
        
        // Используем object pooling
        const notificationElement = this.getPooledObject('domElements');
        notificationElement.className = 'notification-optimized';
        notificationElement.textContent = notification.message;
        
        // Добавляем в DOM
        const container = document.getElementById('notifications-container');
        if (container) {
            container.appendChild(notificationElement);
            
            // Автоматическое удаление
            setTimeout(() => {
                container.removeChild(notificationElement);
                this.returnToPool('domElements', notificationElement);
            }, notification.duration);
        }
    }

    /**
     * ОБРАБОТКА ОШИБОК
     */
    handleError(error) {
        this.managerState.errorCount++;
        
        if (this.managerState.errorCount > this.config.maxErrors) {
            console.error('🎮 GameBoardManagerOptimized: Превышен лимит ошибок');
            this.pauseGame();
        }
        
        // Логируем ошибку
        console.error('🎮 GameBoardManagerOptimized: Ошибка:', error);
    }

    /**
     * ПАУЗА ИГРЫ
     */
    pauseGame() {
        this.managerState.gameActive = false;
        this.managerState.currentPhase = 'paused';
        
        // Пауза анимаций
        if (this.ui) {
            this.ui.pauseAnimations();
        }
    }

    /**
     * ВОЗОБНОВЛЕНИЕ ИГРЫ
     */
    resumeGame() {
        this.managerState.gameActive = true;
        this.managerState.currentPhase = 'playing';
        
        // Возобновление анимаций
        if (this.ui) {
            this.ui.resumeAnimations();
        }
    }

    /**
     * ПОЛУЧЕНИЕ ТЕКУЩЕГО СОСТОЯНИЯ
     */
    getCurrentState() {
        return {
            managerState: { ...this.managerState },
            config: { ...this.config },
            isInitialized: this.isInitialized,
            timestamp: Date.now()
        };
    }

    /**
     * ОЧИСТКА ПАМЯТИ
     */
    cleanup() {
        console.log('🎮 GameBoardManagerOptimized: Очистка памяти');
        
        // Очищаем UI
        if (this.ui) {
            this.ui.cleanup();
        }
        
        // Очищаем object pools
        Object.keys(this.objectPool).forEach(key => {
            this.objectPool[key] = [];
        });
        
        // Сбрасываем флаги
        Object.keys(this.lazyLoaded).forEach(key => {
            this.lazyLoaded[key] = false;
        });
        
        // Очищаем состояние
        this.managerState = {
            gameActive: false,
            currentPhase: 'waiting',
            lastUpdate: null,
            errorCount: 0,
            performanceMetrics: {
                frameRate: 0,
                memoryUsage: 0,
                domOperations: 0
            }
        };
        
        this.isInitialized = false;
        
        console.log('🎮 GameBoardManagerOptimized: Очистка завершена');
    }

    /**
     * ПОЛУЧЕНИЕ МЕТРИК ПРОИЗВОДИТЕЛЬНОСТИ
     */
    getPerformanceMetrics() {
        return {
            ...this.managerState.performanceMetrics,
            objectPoolSizes: Object.keys(this.objectPool).reduce((acc, key) => {
                acc[key] = this.objectPool[key].length;
                return acc;
            }, {}),
            lazyLoadedComponents: Object.keys(this.lazyLoaded).reduce((acc, key) => {
                acc[key] = this.lazyLoaded[key];
                return acc;
            }, {})
        };
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameBoardManagerOptimized;
} else if (typeof window !== 'undefined') {
    window.GameBoardManagerOptimized = GameBoardManagerOptimized;
}
