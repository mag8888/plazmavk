/**
 * Bank Module v5 - Test Suite
 * Тесты для проверки функциональности банковского модуля
 */

// Мокаем DOM и глобальные объекты для тестирования
const mockDOM = {
    querySelector: jest.fn(),
    addEventListener: jest.fn(),
    createElement: jest.fn(() => ({
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        style: {}
    }))
};

const mockFetch = jest.fn();
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
};

// Настройка моков
global.document = mockDOM;
global.fetch = mockFetch;
global.localStorage = mockLocalStorage;
global.window = {
    location: { origin: 'http://localhost:3000' },
    players: []
};

describe('BankModuleV5', () => {
    let bankModule;
    let mockApiManager;
    let mockUIManager;

    beforeEach(() => {
        // Очищаем моки
        jest.clearAllMocks();
        
        // Настраиваем моки
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({})
        });
        
        mockLocalStorage.getItem.mockReturnValue('{"id": "123", "username": "testuser"}');
        
        // Создаем экземпляр модуля
        bankModule = new BankModuleV5();
    });

    describe('Инициализация', () => {
        test('должен корректно инициализироваться', () => {
            expect(bankModule).toBeDefined();
            expect(bankModule.state.isInitialized).toBe(false);
            expect(bankModule.data.balance).toBe(0);
        });

        test('должен предотвращать множественную инициализацию', async () => {
            const init1 = bankModule.init();
            const init2 = bankModule.init();
            
            expect(init1).toBe(init2);
        });
    });

    describe('Получение идентификаторов', () => {
        test('должен получать Room ID из различных источников', () => {
            // Тест URL параметров
            global.window.location.search = '?room_id=123';
            expect(bankModule.getRoomId()).toBe('123');
            
            // Тест глобальных переменных
            global.window.currentRoomId = '456';
            expect(bankModule.getRoomId()).toBe('456');
        });

        test('должен получать User ID из localStorage', () => {
            mockLocalStorage.getItem.mockReturnValue('{"id": "user123"}');
            expect(bankModule.getUserId()).toBe('user123');
        });
    });

    describe('Кэширование', () => {
        test('должен корректно проверять валидность кэша', () => {
            bankModule.cache.data = { balance: 1000 };
            bankModule.cache.timestamp = Date.now() - 2000; // 2 секунды назад
            
            expect(bankModule.isCacheValid()).toBe(true);
            
            bankModule.cache.timestamp = Date.now() - 10000; // 10 секунд назад
            expect(bankModule.isCacheValid()).toBe(false);
        });

        test('должен обновлять кэш при загрузке данных', () => {
            const testData = { balance: 5000, income: 10000 };
            bankModule.data = testData;
            bankModule.updateCache();
            
            expect(bankModule.cache.data).toEqual(testData);
            expect(bankModule.cache.timestamp).toBeCloseTo(Date.now(), -2);
        });
    });

    describe('API запросы', () => {
        test('должен корректно обрабатывать успешные запросы', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ amount: 1000 })
            });

            const response = await bankModule.apiManager.makeRequest('/test');
            expect(response.ok).toBe(true);
        });

        test('должен обрабатывать ошибки API', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            
            await expect(bankModule.apiManager.makeRequest('/test'))
                .rejects.toThrow('Network error');
        });
    });

    describe('UI обновления', () => {
        test('должен обновлять элементы DOM', () => {
            const mockElement = { textContent: '' };
            mockDOM.querySelector.mockReturnValue(mockElement);
            
            bankModule.uiManager.updateElement('#test', 'New Value');
            
            expect(mockElement.textContent).toBe('New Value');
        });

        test('должен форматировать валюту', () => {
            expect(BankUtils.formatCurrency(1000)).toBe('$1,000');
            expect(BankUtils.formatCurrency(1234567)).toBe('$1,234,567');
        });

        test('должен форматировать время', () => {
            const now = Date.now();
            expect(BankUtils.formatTime(now)).toBe('только что');
            expect(BankUtils.formatTime(now - 300000)).toBe('5 мин назад');
        });
    });

    describe('Фильтрация переводов', () => {
        test('должен удалять дубликаты', () => {
            const transfers = [
                { amount: 1000, description: 'test', timestamp: 123 },
                { amount: 1000, description: 'test', timestamp: 123 },
                { amount: 2000, description: 'test2', timestamp: 456 }
            ];
            
            const filtered = BankUtils.filterDuplicateTransfers(transfers);
            expect(filtered).toHaveLength(2);
        });

        test('должен исключать отрицательные стартовые сбережения', () => {
            const transfers = [
                { amount: 3000, description: 'стартовые сбережения', timestamp: 123 },
                { amount: -3000, description: 'стартовые сбережения', timestamp: 123 },
                { amount: 1000, description: 'перевод', timestamp: 456 }
            ];
            
            const filtered = BankUtils.filterDuplicateTransfers(transfers);
            expect(filtered).toHaveLength(2);
            expect(filtered.find(t => t.amount < 0)).toBeUndefined();
        });
    });

    describe('События', () => {
        test('должен подписываться на события', () => {
            const callback = jest.fn();
            bankModule.on('test-event', callback);
            
            expect(bankModule.listeners.has('test-event')).toBe(true);
            expect(bankModule.listeners.get('test-event')).toContain(callback);
        });

        test('должен эмитировать события', () => {
            const callback = jest.fn();
            bankModule.on('test-event', callback);
            
            bankModule.emit('test-event', { data: 'test' });
            
            expect(callback).toHaveBeenCalledWith({ data: 'test' });
        });

        test('должен отписываться от событий', () => {
            const callback = jest.fn();
            bankModule.on('test-event', callback);
            bankModule.off('test-event', callback);
            
            expect(bankModule.listeners.get('test-event')).not.toContain(callback);
        });
    });

    describe('Банковские операции', () => {
        test('должен корректно обрабатывать запрос кредита', async () => {
            bankModule.playerName = 'testuser';
            bankModule.roomId = 'room123';
            bankModule.data.maxCredit = 10000;
            bankModule.data.credit = 0;
            
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true })
            });
            
            const result = await bankModule.requestCredit(1000);
            expect(result).toBe(true);
        });

        test('должен проверять лимит кредита', async () => {
            bankModule.playerName = 'testuser';
            bankModule.data.maxCredit = 1000;
            bankModule.data.credit = 500;
            
            await expect(bankModule.requestCredit(1000))
                .rejects.toThrow('Превышен лимит кредита');
        });

        test('должен корректно обрабатывать переводы', async () => {
            bankModule.playerName = 'testuser';
            bankModule.roomId = 'room123';
            bankModule.players = [
                { name: 'testuser' },
                { name: 'recipient' }
            ];
            bankModule.data.balance = 5000;
            
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true })
            });
            
            const result = await bankModule.transferMoney(1, 1000);
            expect(result).toBe(true);
        });
    });

    describe('Утилиты', () => {
        test('должен корректно работать debounce', (done) => {
            let callCount = 0;
            const debouncedFn = BankUtils.debounce(() => {
                callCount++;
            }, 100);
            
            debouncedFn();
            debouncedFn();
            debouncedFn();
            
            setTimeout(() => {
                expect(callCount).toBe(1);
                done();
            }, 150);
        });

        test('должен корректно работать retry', async () => {
            let attemptCount = 0;
            const failingFn = () => {
                attemptCount++;
                if (attemptCount < 3) {
                    return Promise.reject(new Error('Test error'));
                }
                return Promise.resolve('success');
            };
            
            const result = await BankUtils.retry(failingFn, 3, 10);
            expect(result).toBe('success');
            expect(attemptCount).toBe(3);
        });
    });

    describe('Очистка ресурсов', () => {
        test('должен корректно очищать ресурсы при уничтожении', () => {
            const intervalId = setInterval(() => {}, 1000);
            bankModule.syncInterval = intervalId;
            
            bankModule.destroy();
            
            expect(bankModule.listeners.size).toBe(0);
            expect(bankModule.syncInterval).toBeNull();
        });
    });
});

// Интеграционные тесты
describe('BankModuleV5 Integration', () => {
    test('должен корректно работать с реальными данными', async () => {
        // Здесь можно добавить тесты с реальными данными
        // или интеграционные тесты с мок-сервером
    });
});

// Тесты производительности
describe('BankModuleV5 Performance', () => {
    test('должен быстро обновлять UI', () => {
        const start = performance.now();
        
        // Симулируем обновление UI
        for (let i = 0; i < 1000; i++) {
            BankUtils.formatCurrency(i);
        }
        
        const end = performance.now();
        expect(end - start).toBeLessThan(100); // Должно выполняться менее чем за 100ms
    });
});
