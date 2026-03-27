/**
 * Конфигурация сервера
 * Централизованное управление всеми серверными параметрами
 */

class ServerConfig {
    constructor() {
        this.config = {
            // Финансовые параметры
            financial: {
                startingBalance: 3000,
                defaultProfession: {
                    salary: 10000,
                    expenses: 6200,
                    cashFlow: 3800
                },
                maxCredit: 10000,
                creditStep: 1000, // Шаг кредита
                creditPaymentRate: 100 // Платеж за каждые 1000$ кредита
            },
            
            // Настройки базы данных
            database: {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000
            },
            
            // Настройки комнат
            room: {
                defaultBalance: 10000,
                cleanupInterval: 2 * 60 * 60 * 1000, // 2 часа
                healthCheckInterval: 5 * 60 * 1000, // 5 минут
                oldRoomThreshold: 24 * 60 * 60 * 1000, // 24 часа (жизнь комнаты после старта)
                oneHourThreshold: 24 * 60 * 60 * 1000, // 24 часа (для не начатых комнат без игроков)
                lobbyDisplayThreshold: 7 * 60 * 60 * 1000 // 7 часов (показывать активные комнаты в лобби)
            },
            
            // Настройки кредитов
            credit: {
                minAmount: 1000,
                step: 1000,
                paymentRate: 100, // Платеж за каждые 1000$
                maxAmount: 50000
            },
            
            // Настройки долгов
            debts: {
                carLoan: { monthly_payment: 700, principal: 14000 },
                eduLoan: { monthly_payment: 500, principal: 10000 },
                mortgage: { monthly_payment: 1200, principal: 240000 },
                creditCards: { monthly_payment: 1000, principal: 20000 }
            }
        };
    }
    
    /**
     * Получить финансовые параметры
     */
    getFinancial() {
        return { ...this.config.financial };
    }
    
    /**
     * Получить настройки базы данных
     */
    getDatabase() {
        return { ...this.config.database };
    }
    
    /**
     * Получить настройки комнат
     */
    getRoom() {
        return { ...this.config.room };
    }
    
    /**
     * Получить настройки кредитов
     */
    getCredit() {
        return { ...this.config.credit };
    }
    
    /**
     * Получить настройки долгов
     */
    getDebts() {
        return { ...this.config.debts };
    }
    
    /**
     * Получить стартовый баланс
     */
    getStartingBalance() {
        return this.config.financial.startingBalance;
    }
    
    /**
     * Получить максимальный кредит
     */
    getMaxCredit() {
        return this.config.financial.maxCredit;
    }
    
    /**
     * Получить шаг кредита
     */
    getCreditStep() {
        return this.config.financial.creditStep;
    }
    
    /**
     * Получить ставку платежа за кредит
     */
    getCreditPaymentRate() {
        return this.config.financial.creditPaymentRate;
    }
    
    /**
     * Обновить конфигурацию
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

// Экспортируем как глобальный объект
module.exports = ServerConfig;
