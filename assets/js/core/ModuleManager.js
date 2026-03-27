/**
 * ModuleManager - управление микромодулями
 */
class ModuleManager {
    constructor() {
        this.modules = new Map();
        this.dependencies = new Map();
        this.loading = new Set();
        this.loaded = new Set();
    }

    /**
     * Регистрация модуля
     */
    register(name, module, options = {}) {
        if (this.modules.has(name)) {
            console.warn(`Module ${name} is already registered`);
            return false;
        }

        const moduleInfo = {
            name,
            module,
            dependencies: options.dependencies || [],
            priority: options.priority || 0,
            autoInit: options.autoInit !== false,
            initialized: false
        };

        this.modules.set(name, moduleInfo);
        this.dependencies.set(name, moduleInfo.dependencies);

        console.log(`📦 Module ${name} registered`);
        return true;
    }

    /**
     * Получение модуля
     */
    get(name) {
        const moduleInfo = this.modules.get(name);
        return moduleInfo ? moduleInfo.module : null;
    }

    /**
     * Проверка существования модуля
     */
    has(name) {
        return this.modules.has(name);
    }

    /**
     * Инициализация модуля
     */
    async init(name, ...args) {
        const moduleInfo = this.modules.get(name);
        if (!moduleInfo) {
            throw new Error(`Module ${name} not found`);
        }

        if (moduleInfo.initialized) {
            console.log(`Module ${name} already initialized`);
            return moduleInfo.module;
        }

        // Проверяем зависимости
        await this.ensureDependencies(name);

        try {
            console.log(`🚀 Initializing module ${name}...`);
            
            if (typeof moduleInfo.module.init === 'function') {
                await moduleInfo.module.init(...args);
            }

            moduleInfo.initialized = true;
            this.loaded.add(name);
            
            console.log(`✅ Module ${name} initialized`);
            return moduleInfo.module;
        } catch (error) {
            console.error(`❌ Failed to initialize module ${name}:`, error);
            throw error;
        }
    }

    /**
     * Инициализация всех модулей
     */
    async initAll() {
        const sortedModules = this.getSortedModules();
        
        for (const moduleInfo of sortedModules) {
            if (moduleInfo.autoInit && !moduleInfo.initialized) {
                try {
                    await this.init(moduleInfo.name);
                } catch (error) {
                    console.error(`Failed to auto-init module ${moduleInfo.name}:`, error);
                }
            }
        }
    }

    /**
     * Уничтожение модуля
     */
    async destroy(name) {
        const moduleInfo = this.modules.get(name);
        if (!moduleInfo) return false;

        try {
            if (typeof moduleInfo.module.destroy === 'function') {
                await moduleInfo.module.destroy();
            }

            moduleInfo.initialized = false;
            this.loaded.delete(name);
            
            console.log(`🗑️ Module ${name} destroyed`);
            return true;
        } catch (error) {
            console.error(`Failed to destroy module ${name}:`, error);
            return false;
        }
    }

    /**
     * Получение списка модулей, отсортированных по приоритету и зависимостям
     */
    getSortedModules() {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();

        const visit = (name) => {
            if (visiting.has(name)) {
                throw new Error(`Circular dependency detected: ${name}`);
            }
            if (visited.has(name)) return;

            visiting.add(name);
            
            const moduleInfo = this.modules.get(name);
            if (moduleInfo) {
                // Сначала посещаем зависимости
                for (const dep of moduleInfo.dependencies) {
                    visit(dep);
                }
                
                visited.add(name);
                visiting.delete(name);
                sorted.push(moduleInfo);
            }
        };

        // Сортируем по приоритету
        const modules = Array.from(this.modules.values())
            .sort((a, b) => b.priority - a.priority);

        for (const moduleInfo of modules) {
            visit(moduleInfo.name);
        }

        return sorted;
    }

    /**
     * Проверка и инициализация зависимостей
     */
    async ensureDependencies(moduleName) {
        const dependencies = this.dependencies.get(moduleName) || [];
        
        for (const dep of dependencies) {
            if (!this.has(dep)) {
                throw new Error(`Dependency ${dep} not found for module ${moduleName}`);
            }

            const depModule = this.modules.get(dep);
            if (!depModule.initialized) {
                await this.init(dep);
            }
        }
    }

    /**
     * Получение информации о модуле
     */
    getModuleInfo(name) {
        return this.modules.get(name);
    }

    /**
     * Получение всех загруженных модулей
     */
    getLoadedModules() {
        return Array.from(this.loaded);
    }

    /**
     * Получение всех модулей
     */
    getAllModules() {
        return Array.from(this.modules.keys());
    }

    /**
     * Очистка всех модулей
     */
    async clear() {
        const moduleNames = Array.from(this.modules.keys());
        
        for (const name of moduleNames) {
            await this.destroy(name);
        }

        this.modules.clear();
        this.dependencies.clear();
        this.loading.clear();
        this.loaded.clear();
    }
}

// Экспорт в window для глобального доступа
window.ModuleManager = ModuleManager;