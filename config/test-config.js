// Тестовый конфигурационный файл
console.log('🔍 Loading test-config.js...');

const TEST_CONFIG = [
    { id: 1, name: 'Test 1' },
    { id: 2, name: 'Test 2' }
];

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TEST_CONFIG };
} else if (typeof window !== 'undefined') {
    console.log('🔍 Setting window globals for test-config...');
    window.TEST_CONFIG = TEST_CONFIG;
    console.log('✅ Test-config loaded:', TEST_CONFIG.length, 'items');
}
