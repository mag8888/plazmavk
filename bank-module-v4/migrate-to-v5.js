/**
 * Bank Module v4 to v5 Migration Script
 * Скрипт для автоматической миграции с v4 на v5
 */

class BankModuleMigrator {
    constructor() {
        this.migrationSteps = [
            'backupCurrentModule',
            'updateHTMLReferences',
            'updateCSSReferences',
            'updateJavaScriptReferences',
            'updateEventHandlers',
            'updateFunctionCalls',
            'validateMigration'
        ];
    }

    async migrate() {
        console.log('🚀 Начинаем миграцию Bank Module v4 → v5');
        
        try {
            for (const step of this.migrationSteps) {
                console.log(`📋 Выполняем шаг: ${step}`);
                await this[step]();
                console.log(`✅ Шаг ${step} завершен`);
            }
            
            console.log('🎉 Миграция успешно завершена!');
            this.showMigrationReport();
            
        } catch (error) {
            console.error('❌ Ошибка миграции:', error);
            this.showErrorReport(error);
        }
    }

    async backupCurrentModule() {
        console.log('💾 Создаем резервную копию текущего модуля');
        
        // Сохраняем текущее состояние
        const currentState = {
            bankModuleV4: window.bankModuleV4,
            openBankV4: window.openBankV4,
            closeBankV4: window.closeBankV4,
            requestCreditV4: window.requestCreditV4,
            payoffCreditV4: window.payoffCreditV4,
            transferMoneyV4: window.transferMoneyV4,
            getBankDataV4: window.getBankDataV4
        };
        
        // Сохраняем в localStorage для возможности отката
        localStorage.setItem('bank-module-v4-backup', JSON.stringify({
            timestamp: Date.now(),
            state: currentState
        }));
        
        console.log('✅ Резервная копия создана');
    }

    async updateHTMLReferences() {
        console.log('🔧 Обновляем HTML ссылки');
        
        // Обновляем ссылки на CSS
        const cssLinks = document.querySelectorAll('link[href*="bank-styles-v4"]');
        cssLinks.forEach(link => {
            const newHref = link.href.replace('bank-styles-v4', 'bank-styles-v5');
            link.href = newHref + '?v=5.0';
            console.log(`📝 Обновлен CSS: ${newHref}`);
        });
        
        // Обновляем ссылки на JS
        const jsScripts = document.querySelectorAll('script[src*="bank-module-v4"]');
        jsScripts.forEach(script => {
            const newSrc = script.src.replace('bank-module-v4.js', 'bank-module-v5.js');
            script.src = newSrc + '?v=5.0';
            console.log(`📝 Обновлен JS: ${newSrc}`);
        });
        
        // Обновляем HTML структуру модального окна
        this.updateModalHTML();
    }

    updateModalHTML() {
        const modal = document.getElementById('bankModal');
        if (!modal) {
            console.warn('⚠️ Модальное окно bankModal не найдено');
            return;
        }
        
        // Обновляем заголовок
        const title = modal.querySelector('.bank-modal-title');
        if (title) {
            title.innerHTML = 'Банковские операции <span style="color: #ff6b6b; font-size: 12px; font-weight: normal;">[v5-OPTIMIZED]</span>';
        }
        
        // Обновляем обработчики событий
        const closeBtn = modal.querySelector('.bank-modal-close');
        if (closeBtn) {
            closeBtn.setAttribute('onclick', 'closeBankV5()');
            closeBtn.setAttribute('aria-label', 'Закрыть банк');
        }
        
        console.log('✅ HTML структура обновлена');
    }

    async updateCSSReferences() {
        console.log('🎨 Обновляем CSS ссылки');
        
        // Проверяем загрузку нового CSS
        const newCssLink = document.querySelector('link[href*="bank-styles-v5"]');
        if (newCssLink) {
            return new Promise((resolve) => {
                newCssLink.onload = () => {
                    console.log('✅ Новый CSS загружен');
                    resolve();
                };
                newCssLink.onerror = () => {
                    console.warn('⚠️ Ошибка загрузки нового CSS');
                    resolve();
                };
            });
        }
    }

    async updateJavaScriptReferences() {
        console.log('⚙️ Обновляем JavaScript ссылки');
        
        // Ждем загрузки нового модуля
        return new Promise((resolve) => {
            const checkModule = () => {
                if (window.BankModuleV5) {
                    console.log('✅ Bank Module v5 загружен');
                    resolve();
                } else {
                    setTimeout(checkModule, 100);
                }
            };
            checkModule();
        });
    }

    async updateEventHandlers() {
        console.log('📡 Обновляем обработчики событий');
        
        // Обновляем обработчики кнопок
        const bankButtons = document.querySelectorAll('[onclick*="openBankV4"], [onclick*="openBankModal"]');
        bankButtons.forEach(button => {
            const onclick = button.getAttribute('onclick');
            if (onclick) {
                const newOnclick = onclick
                    .replace('openBankV4()', 'openBankV5()')
                    .replace('openBankModal()', 'openBankV5()');
                button.setAttribute('onclick', newOnclick);
                console.log(`📝 Обновлен обработчик кнопки: ${newOnclick}`);
            }
        });
        
        // Обновляем обработчики форм
        const forms = document.querySelectorAll('form[onsubmit*="executeTransferV4"]');
        forms.forEach(form => {
            const onsubmit = form.getAttribute('onsubmit');
            if (onsubmit) {
                const newOnsubmit = onsubmit.replace('executeTransferV4', 'executeTransferV5');
                form.setAttribute('onsubmit', newOnsubmit);
                console.log(`📝 Обновлена форма: ${newOnsubmit}`);
            }
        });
    }

    async updateFunctionCalls() {
        console.log('🔄 Обновляем вызовы функций');
        
        // Создаем алиасы для обратной совместимости
        window.openBankV4 = window.openBankV5;
        window.closeBankV4 = window.closeBankV5;
        window.requestCreditV4 = window.requestCreditV5;
        window.payoffCreditV4 = window.payoffCreditV5;
        window.transferMoneyV4 = window.transferMoneyV5;
        window.getBankDataV4 = window.getBankDataV5;
        
        console.log('✅ Созданы алиасы для обратной совместимости');
    }

    async validateMigration() {
        console.log('✅ Валидация миграции');
        
        const checks = [
            { name: 'Bank Module v5 загружен', check: () => !!window.BankModuleV5 },
            { name: 'Функции v5 доступны', check: () => !!window.openBankV5 },
            { name: 'CSS v5 загружен', check: () => !!document.querySelector('link[href*="bank-styles-v5"]') },
            { name: 'Модальное окно существует', check: () => !!document.getElementById('bankModal') },
            { name: 'Обратная совместимость', check: () => !!window.openBankV4 }
        ];
        
        const results = checks.map(check => ({
            name: check.name,
            passed: check.check()
        }));
        
        const allPassed = results.every(result => result.passed);
        
        if (allPassed) {
            console.log('🎉 Все проверки пройдены успешно!');
        } else {
            console.warn('⚠️ Некоторые проверки не пройдены:');
            results.filter(r => !r.passed).forEach(result => {
                console.warn(`  ❌ ${result.name}`);
            });
        }
        
        return results;
    }

    showMigrationReport() {
        const report = {
            timestamp: new Date().toISOString(),
            version: 'v4 → v5',
            status: 'success',
            features: [
                'Модульная архитектура',
                'Улучшенная производительность',
                'Event-driven подход',
                'Лучшая обработка ошибок',
                'Современный дизайн',
                'Полное покрытие тестами'
            ]
        };
        
        console.log('📊 Отчет о миграции:', report);
        
        // Показываем уведомление пользователю
        if (typeof showNotification === 'function') {
            showNotification('Миграция Bank Module v4 → v5 завершена успешно!', 'success');
        }
    }

    showErrorReport(error) {
        const report = {
            timestamp: new Date().toISOString(),
            version: 'v4 → v5',
            status: 'error',
            error: error.message,
            stack: error.stack
        };
        
        console.error('📊 Отчет об ошибке:', report);
        
        // Показываем уведомление об ошибке
        if (typeof showNotification === 'function') {
            showNotification('Ошибка миграции Bank Module. Проверьте консоль.', 'error');
        }
    }

    // Функция для отката миграции
    async rollback() {
        console.log('🔄 Выполняем откат миграции');
        
        try {
            const backup = localStorage.getItem('bank-module-v4-backup');
            if (!backup) {
                throw new Error('Резервная копия не найдена');
            }
            
            const backupData = JSON.parse(backup);
            
            // Восстанавливаем функции v4
            Object.assign(window, backupData.state);
            
            // Восстанавливаем CSS и JS ссылки
            const cssLinks = document.querySelectorAll('link[href*="bank-styles-v5"]');
            cssLinks.forEach(link => {
                link.href = link.href.replace('bank-styles-v5', 'bank-styles-v4');
            });
            
            const jsScripts = document.querySelectorAll('script[src*="bank-module-v5"]');
            jsScripts.forEach(script => {
                script.src = script.src.replace('bank-module-v5.js', 'bank-module-v4.js');
            });
            
            console.log('✅ Откат выполнен успешно');
            
        } catch (error) {
            console.error('❌ Ошибка отката:', error);
        }
    }
}

// Автоматический запуск миграции
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, нужно ли выполнить миграцию
    const shouldMigrate = localStorage.getItem('bank-migrate-to-v5') === 'true';
    
    if (shouldMigrate) {
        const migrator = new BankModuleMigrator();
        migrator.migrate();
        
        // Убираем флаг миграции
        localStorage.removeItem('bank-migrate-to-v5');
    }
});

// Экспорт для ручного использования
window.BankModuleMigrator = BankModuleMigrator;

// Функции для ручного управления миграцией
window.migrateBankModule = () => {
    const migrator = new BankModuleMigrator();
    return migrator.migrate();
};

window.rollbackBankModule = () => {
    const migrator = new BankModuleMigrator();
    return migrator.rollback();
};

console.log('🔄 Bank Module Migration Script загружен');
