/**
 * Модуль событий для игры "Энергия денег"
 * Обрабатывает игровые события (PAYDAY, благотворительность, банкротство)
 */

export class EventModule {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.eventQueue = [];
        this.processingEvents = false;
        this.eventHistory = [];
        this.maxHistorySize = 100;
        this.isDestroyed = false;
    }

    /**
     * Инициализация модуля событий
     */
    async init() {
        console.log('⚡ EventModule инициализирован');
        
        // Подписка на события
        this.gameCore.eventBus.on('playerMoved', this.onPlayerMoved.bind(this));
        this.gameCore.eventBus.on('playerTurnEnded', this.onPlayerTurnEnded.bind(this));
        this.gameCore.eventBus.on('cardProcessed', this.onCardProcessed.bind(this));
    }

    /**
     * Добавление события в очередь
     * @param {Object} event - Событие
     */
    queueEvent(event) {
        if (this.isDestroyed) {
            console.warn('EventModule уничтожен, событие не может быть добавлено');
            return false;
        }

        const eventData = {
            ...event,
            id: this.generateEventId(),
            timestamp: Date.now(),
            processed: false
        };

        this.eventQueue.push(eventData);
        
        console.log(`⚡ Событие добавлено в очередь: ${event.type}`);
        
        // Автоматическая обработка очереди
        this.processEventQueue();
        
        return eventData.id;
    }

    /**
     * Обработка очереди событий
     */
    async processEventQueue() {
        if (this.processingEvents || this.eventQueue.length === 0) {
            return;
        }

        this.processingEvents = true;

        try {
            while (this.eventQueue.length > 0) {
                const event = this.eventQueue.shift();
                await this.processEvent(event);
            }
        } catch (error) {
            console.error('Ошибка обработки очереди событий:', error);
        } finally {
            this.processingEvents = false;
        }
    }

    /**
     * Обработка конкретного события
     * @param {Object} event - Событие
     */
    async processEvent(event) {
        try {
            console.log(`⚡ Обработка события: ${event.type}`);
            
            let result = null;
            
            switch (event.type) {
                case 'payday':
                case 'receive_salary':
                    result = await this.processPaydayEvent(event);
                    break;
                case 'charity':
                    result = await this.processCharityEvent(event);
                    break;
                case 'bankruptcy':
                    result = await this.processBankruptcyEvent(event);
                    break;
                case 'card_draw':
                    result = await this.processCardDrawEvent(event);
                    break;
                case 'movement':
                    result = await this.processMovementEvent(event);
                    break;
                case 'baby_born':
                    result = await this.processBabyBornEvent(event);
                    break;
                default:
                    console.warn(`Неизвестный тип события: ${event.type}`);
                    result = { success: false, message: 'Неизвестное событие' };
            }

            // Сохранение в историю
            this.saveToHistory(event, result);
            
            // Эмиссия события обработки
            this.gameCore.eventBus.emit('eventProcessed', {
                event,
                result,
                timestamp: Date.now()
            });

            event.processed = true;
            
            return result;

        } catch (error) {
            console.error('Ошибка обработки события:', error);
            
            const errorResult = {
                success: false,
                message: 'Ошибка обработки события',
                error: error.message
            };
            
            this.saveToHistory(event, errorResult);
            
            return errorResult;
        }
    }

    /**
     * Обработка события PAYDAY
     * @param {Object} event - Событие
     */
    async processPaydayEvent(event) {
        const playerManager = this.gameCore.getModule('playerManager');
        const bankModule = this.gameCore.getModule('bankModule');
        const player = playerManager.getPlayer(event.playerId);
        
        if (!player) {
            return { success: false, message: 'Игрок не найден' };
        }

        try {
            // Получаем зарплату из профессии игрока
            const salary = player.profession?.salary || 0;
            const passiveIncome = player.passiveIncome || 0;
            const totalIncome = salary + passiveIncome;
            
            // Добавление дохода
            playerManager.updateBalance(player.id, totalIncome, 'PAYDAY - Зарплата');
            
            // Обработка кредитов (автоматическое списание)
            if (player.creditAmount > 0 && bankModule) {
                const creditInterest = Math.round(player.creditAmount * 0.10); // 10% в месяц
                playerManager.updateBalance(player.id, -creditInterest, 'Проценты по кредиту');
                
                // Проверка банкротства после списания процентов
                if (player.balance < 0) {
                    this.queueEvent({
                        type: 'bankruptcy',
                        playerId: player.id,
                        reason: 'insufficient_funds_after_credit_payment'
                    });
                }
            }
            
            // Обработка расходов (базовые расходы профессии + расходы на детей)
            const baseExpenses = player.profession?.expenses || 0;
            const childExpenses = (player.children || 0) * 1000; // $1000 на ребенка
            const totalExpenses = baseExpenses + childExpenses;
            
            if (totalExpenses > 0) {
                playerManager.updateBalance(player.id, -totalExpenses, 'PAYDAY - Расходы');
                
                // Проверка банкротства после расходов
                if (player.balance < 0) {
                    this.queueEvent({
                        type: 'bankruptcy',
                        playerId: player.id,
                        reason: 'insufficient_funds_after_expenses'
                    });
                }
            }
            
            // Обновление даты последнего PAYDAY
            playerManager.updatePlayer(player.id, {
                lastPayday: Date.now()
            });
            
            console.log(`💰 PAYDAY обработан для игрока ${player.name}: +$${totalIncome} (зарплата: $${salary}, пассивный доход: $${passiveIncome})`);
            
            return {
                success: true,
                message: `PAYDAY: +$${totalIncome}`,
                income: totalIncome,
                salary: salary,
                passiveIncome: passiveIncome,
                expenses: totalExpenses,
                childExpenses: childExpenses,
                creditInterest: player.creditAmount > 0 ? Math.round(player.creditAmount * 0.10) : 0
            };
            
        } catch (error) {
            console.error('Ошибка обработки PAYDAY:', error);
            return { success: false, message: 'Ошибка обработки PAYDAY' };
        }
    }

    /**
     * Обработка события рождения ребенка
     * @param {Object} event - Событие
     */
    async processBabyBornEvent(event) {
        const playerManager = this.gameCore.getModule('playerManager');
        const player = playerManager.getPlayer(event.playerId);
        
        if (!player) {
            return { success: false, message: 'Игрок не найден' };
        }

        try {
            // Бросаем дополнительный кубик для определения рождения ребенка
            const babyDice = Math.floor(Math.random() * 6) + 1; // 1-6
            console.log(`👶 Бросок кубика для рождения ребенка: ${babyDice}`);
            
            if (babyDice <= 4) {
                // Ребенок родился (1-4)
                const currentChildren = player.children || 0;
                
                // Проверяем максимум 3 детей
                if (currentChildren >= 3) {
                    console.log(`👶 У игрока ${player.name} уже максимальное количество детей (3), ребенок не родился`);
                    return {
                        success: true,
                        message: `У вас уже максимальное количество детей (3)`,
                        babyBorn: false,
                        diceResult: babyDice,
                        childrenCount: currentChildren
                    };
                }
                
                const newChildrenCount = currentChildren + 1;
                
                // Обновляем количество детей
                playerManager.updatePlayer(player.id, {
                    children: newChildrenCount
                });
                
                // Выплачиваем разовую сумму $5000
                playerManager.updateBalance(player.id, 5000, 'Рождение ребенка - подарок');
                
                // Показываем поздравление с анимацией конфети
                this.showBabyCelebration(player.name, newChildrenCount);
                
                console.log(`👶 Ребенок родился у игрока ${player.name}! Всего детей: ${newChildrenCount}`);
                
                return {
                    success: true,
                    message: `🎉 Поздравляем! У вас родился ребенок! +$5000`,
                    babyBorn: true,
                    diceResult: babyDice,
                    childrenCount: newChildrenCount,
                    bonus: 5000
                };
            } else {
                // Ребенок не родился (5-6)
                console.log(`👶 Ребенок не родился у игрока ${player.name} (кубик: ${babyDice})`);
                
                return {
                    success: true,
                    message: `К сожалению, ребенок не родился в этот раз`,
                    babyBorn: false,
                    diceResult: babyDice
                };
            }
            
        } catch (error) {
            console.error('Ошибка обработки рождения ребенка:', error);
            return { success: false, message: 'Ошибка обработки рождения ребенка' };
        }
    }

    /**
     * Показ поздравления с рождением ребенка
     * @param {string} playerName - Имя игрока
     * @param {number} childrenCount - Количество детей
     */
    showBabyCelebration(playerName, childrenCount) {
        // Создаем модальное окно поздравления
        const celebrationModal = document.createElement('div');
        celebrationModal.className = 'baby-celebration-modal';
        celebrationModal.innerHTML = `
            <div class="celebration-overlay">
                <div class="celebration-content">
                    <div class="celebration-icon">👶</div>
                    <h2 class="celebration-title">Поздравляем!</h2>
                    <p class="celebration-message">
                        У ${playerName} родился ребенок!<br>
                        Всего детей: ${childrenCount}
                    </p>
                    <p class="celebration-bonus">+$5000 подарок!</p>
                    <button class="celebration-close" onclick="this.closest('.baby-celebration-modal').remove()">
                        Закрыть
                    </button>
                </div>
            </div>
        `;
        
        // Добавляем стили для анимации конфети
        const style = document.createElement('style');
        style.textContent = `
            .baby-celebration-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                pointer-events: none;
            }
            
            .celebration-overlay {
                position: relative;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: all;
            }
            
            .celebration-content {
                background: linear-gradient(135deg, #ff6b6b, #ffa726);
                padding: 40px;
                border-radius: 20px;
                text-align: center;
                color: white;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                animation: celebrationBounce 0.6s ease-out;
                position: relative;
                overflow: hidden;
            }
            
            .celebration-icon {
                font-size: 4rem;
                margin-bottom: 20px;
                animation: celebrationPulse 1s ease-in-out infinite;
            }
            
            .celebration-title {
                font-size: 2.5rem;
                margin: 0 0 20px 0;
                text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
            }
            
            .celebration-message {
                font-size: 1.2rem;
                margin: 0 0 15px 0;
                line-height: 1.4;
            }
            
            .celebration-bonus {
                font-size: 1.5rem;
                font-weight: bold;
                margin: 0 0 30px 0;
                color: #4caf50;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
            }
            
            .celebration-close {
                background: rgba(255, 255, 255, 0.2);
                border: 2px solid white;
                color: white;
                padding: 12px 24px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 1rem;
                font-weight: bold;
                transition: all 0.3s ease;
            }
            
            .celebration-close:hover {
                background: white;
                color: #ff6b6b;
            }
            
            @keyframes celebrationBounce {
                0% { transform: scale(0.3) rotate(-10deg); opacity: 0; }
                50% { transform: scale(1.1) rotate(5deg); }
                100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            
            @keyframes celebrationPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            /* Анимация конфети */
            .celebration-content::before {
                content: '';
                position: absolute;
                top: -50px;
                left: -50px;
                right: -50px;
                bottom: -50px;
                background: 
                    radial-gradient(circle at 20% 20%, #ff6b6b 2px, transparent 2px),
                    radial-gradient(circle at 80% 20%, #4caf50 2px, transparent 2px),
                    radial-gradient(circle at 40% 40%, #ffa726 2px, transparent 2px),
                    radial-gradient(circle at 60% 60%, #2196f3 2px, transparent 2px),
                    radial-gradient(circle at 80% 80%, #9c27b0 2px, transparent 2px);
                background-size: 20px 20px;
                animation: confetti 3s linear infinite;
                pointer-events: none;
            }
            
            @keyframes confetti {
                0% { transform: translateY(-100vh) rotate(0deg); }
                100% { transform: translateY(100vh) rotate(360deg); }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(celebrationModal);
        
        // Автоматически закрываем через 5 секунд
        setTimeout(() => {
            if (celebrationModal.parentNode) {
                celebrationModal.remove();
            }
            if (style.parentNode) {
                style.remove();
            }
        }, 5000);
    }

    /**
     * Обработка события благотворительности
     * @param {Object} event - Событие
     */
    async processCharityEvent(event) {
        const playerManager = this.gameCore.getModule('playerManager');
        const player = playerManager.getPlayer(event.playerId);
        
        if (!player) {
            return { success: false, message: 'Игрок не найден' };
        }

        try {
            // Расчет суммы благотворительности (10% от дохода)
            const charityAmount = Math.round(player.monthlyIncome * 0.10);
            
            if (charityAmount <= 0) {
                return { success: true, message: 'Нет дохода для благотворительности' };
            }
            
            // Проверка достаточности средств
            if (player.balance < charityAmount) {
                return { 
                    success: false, 
                    message: `Недостаточно средств для благотворительности. Нужно: $${charityAmount}` 
                };
            }
            
            // Списание средств
            playerManager.updateBalance(player.id, -charityAmount, `Благотворительность (10% от дохода)`);
            
            // Обновление даты последней благотворительности
            playerManager.updatePlayer(player.id, {
                lastCharity: Date.now()
            });
            
            console.log(`❤️ Благотворительность обработана для игрока ${player.name}: -$${charityAmount}`);
            
            return {
                success: true,
                message: `Благотворительность: -$${charityAmount}`,
                amount: charityAmount
            };
            
        } catch (error) {
            console.error('Ошибка обработки благотворительности:', error);
            return { success: false, message: 'Ошибка обработки благотворительности' };
        }
    }

    /**
     * Обработка события банкротства
     * @param {Object} event - Событие
     */
    async processBankruptcyEvent(event) {
        const playerManager = this.gameCore.getModule('playerManager');
        const player = playerManager.getPlayer(event.playerId);
        
        if (!player) {
            return { success: false, message: 'Игрок не найден' };
        }

        try {
            console.log(`💸 Обработка банкротства игрока ${player.name}`);
            
            // Сброс состояния игрока
            playerManager.updatePlayer(player.id, {
                balance: 0,
                creditAmount: 0,
                assets: [],
                passiveIncome: 0,
                position: 0,
                track: 'inner',
                isBankrupt: true,
                bankruptcyCount: (player.bankruptcyCount || 0) + 1
            });
            
            // Эмиссия события банкротства
            this.gameCore.eventBus.emit('playerBankrupted', {
                player,
                reason: event.reason,
                bankruptcyCount: player.bankruptcyCount
            });
            
            return {
                success: true,
                message: `Игрок ${player.name} обанкротился`,
                bankruptcyCount: player.bankruptcyCount
            };
            
        } catch (error) {
            console.error('Ошибка обработки банкротства:', error);
            return { success: false, message: 'Ошибка обработки банкротства' };
        }
    }

    /**
     * Обработка события взятия карты
     * @param {Object} event - Событие
     */
    async processCardDrawEvent(event) {
        const cardModule = this.gameCore.getModule('cardModule');
        
        if (!cardModule) {
            return { success: false, message: 'Модуль карт не найден' };
        }

        try {
            const card = cardModule.drawCard(event.deckType, event.options);
            
            if (!card) {
                return { success: false, message: 'Не удалось взять карту' };
            }
            
            return {
                success: true,
                message: `Взята карта: ${card.name}`,
                card
            };
            
        } catch (error) {
            console.error('Ошибка обработки взятия карты:', error);
            return { success: false, message: 'Ошибка взятия карты' };
        }
    }

    /**
     * Обработка события движения
     * @param {Object} event - Событие
     */
    async processMovementEvent(event) {
        const movementModule = this.gameCore.getModule('movementModule');
        
        if (!movementModule) {
            return { success: false, message: 'Модуль движения не найден' };
        }

        try {
            const result = await movementModule.movePlayer(event.playerId, event.steps, event.options);
            
            if (!result) {
                return { success: false, message: 'Не удалось переместить игрока' };
            }
            
            return {
                success: true,
                message: `Игрок перемещен на позицию ${result.position}`,
                position: result.position,
                cell: result.cell
            };
            
        } catch (error) {
            console.error('Ошибка обработки движения:', error);
            return { success: false, message: 'Ошибка движения' };
        }
    }

    /**
     * Создание события PAYDAY
     * @param {string} playerId - ID игрока
     */
    createPaydayEvent(playerId) {
        return this.queueEvent({
            type: 'payday',
            playerId,
            priority: 'high'
        });
    }

    /**
     * Создание события благотворительности
     * @param {string} playerId - ID игрока
     */
    createCharityEvent(playerId) {
        return this.queueEvent({
            type: 'charity',
            playerId,
            priority: 'medium'
        });
    }

    /**
     * Создание события банкротства
     * @param {string} playerId - ID игрока
     * @param {string} reason - Причина банкротства
     */
    createBankruptcyEvent(playerId, reason = 'insufficient_funds') {
        return this.queueEvent({
            type: 'bankruptcy',
            playerId,
            reason,
            priority: 'high'
        });
    }

    /**
     * Создание события рождения ребенка
     * @param {string} playerId - ID игрока
     */
    createBabyBornEvent(playerId) {
        return this.queueEvent({
            type: 'baby_born',
            playerId,
            priority: 'medium'
        });
    }

    /**
     * Получение истории событий
     * @param {number} limit - Лимит записей
     */
    getHistory(limit = 10) {
        return this.eventHistory.slice(-limit);
    }

    /**
     * Сохранение в историю
     * @param {Object} event - Событие
     * @param {Object} result - Результат обработки
     */
    saveToHistory(event, result) {
        this.eventHistory.push({
            event,
            result,
            timestamp: Date.now()
        });

        // Ограничение размера истории
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }

    /**
     * Получение статистики
     */
    getStats() {
        const totalEvents = this.eventHistory.length;
        const eventTypes = {};
        
        this.eventHistory.forEach(entry => {
            const type = entry.event.type;
            eventTypes[type] = (eventTypes[type] || 0) + 1;
        });
        
        return {
            totalEvents,
            eventTypes,
            queueLength: this.eventQueue.length,
            processingEvents: this.processingEvents
        };
    }

    /**
     * Генерация ID события
     */
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Обработчики событий
     */
    onPlayerMoved(data) {
        // Автоматическая обработка событий при движении
        const cell = data.cell;
        
        if (cell) {
            switch (cell.type) {
                case 'payday':
                case 'yellow_payday':
                    this.createPaydayEvent(data.playerId);
                    break;
                case 'charity':
                case 'orange_charity':
                    this.createCharityEvent(data.playerId);
                    break;
                case 'purple_baby':
                    this.createBabyBornEvent(data.playerId);
                    break;
            }
        }
    }

    onPlayerTurnEnded(player) {
        // Очистка очереди событий при завершении хода
        this.eventQueue = this.eventQueue.filter(event => event.playerId === player.id);
    }

    onCardProcessed(data) {
        // Обработка результатов карт
        if (data.result && data.result.financialImpact !== 0) {
            const playerManager = this.gameCore.getModule('playerManager');
            const player = playerManager.getPlayer(data.player);
            
            if (player && player.balance < 0) {
                this.createBankruptcyEvent(player.id, 'insufficient_funds_after_card');
            }
        }
    }

    /**
     * Уничтожение модуля событий
     */
    destroy() {
        this.eventQueue = [];
        this.eventHistory = [];
        this.processingEvents = false;
        this.isDestroyed = true;
        console.log('🗑️ EventModule уничтожен');
    }
}

export default EventModule;
