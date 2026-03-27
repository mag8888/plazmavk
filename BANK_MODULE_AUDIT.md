# АУДИТ БАНКОВСКОГО МОДУЛЯ - ПРОБЛЕМЫ С ДАННЫМИ

## 🔍 ОБНАРУЖЕННЫЕ ПРОБЛЕМЫ

### 1. МНОЖЕСТВЕННЫЕ ИСТОЧНИКИ ДАННЫХ
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Server API    │    │   DataStore     │    │  BankModuleV4   │
│                 │    │                 │    │                 │
│ - /api/bank/    │───▶│ - balance       │◀───│ - this.data     │
│ - balance       │    │ - income        │    │ - this.cache    │
│ - financials    │    │ - expenses      │    │                 │
│ - credit/status │    │ - payday        │    │                 │
│ - history       │    │ - credit        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  GameModule.js  │    │  integration.js │    │  PlayerSummary  │
│                 │    │                 │    │                 │
│ - Прямые API    │    │ - window.*      │    │ - this.data     │
│ - вызовы        │    │ - переменные    │    │ - fallback      │
│ - localStorage  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2. КОНФЛИКТУЮЩИЕ ОБНОВЛЕНИЯ

#### A. BankModuleV4 обновляет данные в 3 местах:
1. **this.data** - локальные данные модуля
2. **window.dataStore** - централизованное хранилище  
3. **window.gameState.state.players** - глобальное состояние игры
4. **window.players** - массив игроков
5. **localStorage** - локальное хранилище браузера

#### B. GameModule.js обновляет данные независимо:
1. **Прямые API вызовы** к серверу
2. **Обновление DataStore** напрямую
3. **window._creditExpense** - глобальная переменная

#### C. integration.js обновляет UI:
1. **window.currentBalance** - глобальная переменная
2. **window.monthlyIncome** - глобальная переменная  
3. **window.monthlyExpenses** - глобальная переменная
4. **window.totalCredit** - глобальная переменная

### 3. ПРОБЛЕМЫ С СИНХРОНИЗАЦИЕЙ

#### A. Порядок обновлений:
```
1. BankModuleV4.loadData() → this.data
2. BankModuleV4.loadData() → window.dataStore  
3. BankModuleV4.loadData() → window.gameState
4. GameModule.state.on('change') → window.dataStore
5. integration.syncDataFromBankV4() → window.*
6. PlayerSummary.render() → DOM
```

#### B. Конфликты:
- **GameModule** может перезаписать данные DataStore после BankModuleV4
- **integration.js** может использовать устаревшие данные из window.*
- **PlayerSummary** может получить данные из разных источников

### 4. ДУБЛИРОВАНИЕ ЛОГИКИ

#### A. Расчеты PAYDAY в 3 местах:
1. **BankModuleV4.updateUI()** - строки 865-870
2. **integration.js.updateFinancesDisplay()** - строки 74-75  
3. **PlayerSummary.render()** - строки 83-84

#### B. Обновление UI в 4 местах:
1. **BankModuleV4.updateUI()** - внутренний UI банка
2. **DataStoreAdapter.updateExternalPanel()** - внешняя панель
3. **integration.js.updateFinancesDisplay()** - внешняя панель
4. **PlayerSummary.render()** - панель игрока

### 5. ПРОБЛЕМЫ С КЭШИРОВАНИЕМ

#### A. this.cache vs DataStore:
- BankModuleV4 использует this.cache для кэширования
- DataStore имеет свою систему кэширования
- Могут быть рассинхронизированы

#### B. localStorage vs DataStore:
- BankModuleV4 сохраняет в localStorage (строки 484-488)
- DataStore не использует localStorage
- При перезагрузке могут быть разные данные

## 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. RACE CONDITIONS
- GameModule и BankModuleV4 могут обновлять DataStore одновременно
- Порядок выполнения не гарантирован

### 2. STALE DATA
- integration.js может использовать устаревшие window.* переменные
- PlayerSummary может получить данные из кэша вместо DataStore

### 3. INCONSISTENT STATE
- this.data может отличаться от DataStore
- window.gameState может отличаться от DataStore
- localStorage может отличаться от всех остальных

## 💡 РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ

### 1. ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ
- Убрать все локальные this.data обновления
- Использовать только DataStore для всех данных
- Убрать дублирующие расчеты

### 2. УПРОСТИТЬ ПОТОК ДАННЫХ
```
Server API → DataStore → UI Updates
```

### 3. УБРАТЬ КОНФЛИКТУЮЩИЕ ОБНОВЛЕНИЯ
- Убрать прямые обновления window.gameState из BankModuleV4
- Убрать прямые API вызовы из GameModule
- Убрать localStorage из BankModuleV4

### 4. ЦЕНТРАЛИЗОВАТЬ UI ОБНОВЛЕНИЯ
- Только DataStoreAdapter должен обновлять UI
- Убрать дублирующие updateUI() методы
