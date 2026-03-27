/**
 * Компонент каталога активов игрока
 * Показывает все купленные карты и активы
 */

export class AssetsCatalog {
    constructor(cardModule) {
        this.cardModule = cardModule;
        this.currentPlayerId = null;
        this.isVisible = false;
    }

    /**
     * Показ каталога активов
     */
    show(playerId) {
        this.currentPlayerId = playerId;
        this.isVisible = true;
        
        const assets = this.cardModule.getPlayerAssets(playerId);
        this.createCatalogModal(assets);
    }

    /**
     * Создание модального окна каталога
     */
    createCatalogModal(assets) {
        // Удаляем существующий каталог
        const existing = document.querySelector('.assets-catalog-modal');
        if (existing) {
            existing.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'assets-catalog-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="catalog-header">
                        <h3>Мои активы</h3>
                        <button class="close-btn" onclick="window.assetsCatalog.hide()">×</button>
                    </div>
                    
                    <div class="catalog-stats">
                        <div class="stat-item">
                            <span class="stat-label">Всего активов:</span>
                            <span class="stat-value">${assets.length}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Общий доход:</span>
                            <span class="stat-value">$${this.calculateTotalIncome(assets).toLocaleString()}/мес</span>
                        </div>
                    </div>
                    
                    <div class="assets-grid">
                        ${assets.length > 0 ? this.renderAssetsGrid(assets) : this.renderEmptyState()}
                    </div>
                </div>
            </div>
        `;

        // Добавляем стили
        const style = document.createElement('style');
        style.textContent = `
            .assets-catalog-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
            }
            
            .modal-overlay {
                position: relative;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .modal-content {
                background: white;
                border-radius: 15px;
                max-width: 800px;
                width: 100%;
                max-height: 80vh;
                overflow-y: auto;
            }
            
            .catalog-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #eee;
            }
            
            .catalog-header h3 {
                margin: 0;
                color: #333;
            }
            
            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .catalog-stats {
                display: flex;
                gap: 20px;
                padding: 20px;
                background: #f8f9fa;
                border-bottom: 1px solid #eee;
            }
            
            .stat-item {
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            .stat-label {
                font-size: 0.9rem;
                color: #666;
                margin-bottom: 5px;
            }
            
            .stat-value {
                font-size: 1.2rem;
                font-weight: bold;
                color: #333;
            }
            
            .assets-grid {
                padding: 20px;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 15px;
            }
            
            .asset-card {
                border: 1px solid #ddd;
                border-radius: 10px;
                padding: 15px;
                background: white;
                transition: all 0.3s ease;
                position: relative;
            }
            
            .asset-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .asset-header {
                display: flex;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .asset-icon {
                font-size: 1.5rem;
                margin-right: 10px;
            }
            
            .asset-name {
                font-weight: bold;
                color: #333;
                flex: 1;
            }
            
            .asset-type {
                font-size: 0.8rem;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .asset-details {
                font-size: 0.9rem;
                color: #666;
            }
            
            .asset-detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
            }
            
            .asset-detail-label {
                font-weight: 500;
            }
            
            .asset-detail-value {
                color: #333;
            }
            
            .asset-income {
                background: #e8f5e8;
                color: #2e7d32;
                padding: 5px 10px;
                border-radius: 15px;
                font-weight: bold;
                text-align: center;
                margin-top: 10px;
            }
            
            .empty-state {
                text-align: center;
                padding: 40px;
                color: #666;
            }
            
            .empty-icon {
                font-size: 3rem;
                margin-bottom: 15px;
            }
            
            .empty-title {
                font-size: 1.2rem;
                font-weight: bold;
                margin-bottom: 10px;
            }
            
            .empty-description {
                font-size: 0.9rem;
                line-height: 1.4;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);
    }

    /**
     * Отрисовка сетки активов
     */
    renderAssetsGrid(assets) {
        return assets.map(asset => `
            <div class="asset-card" style="border-left: 4px solid ${asset.color}">
                <div class="asset-header">
                    <div class="asset-icon" style="color: ${asset.color}">${asset.icon}</div>
                    <div class="asset-name">${asset.name}</div>
                </div>
                
                <div class="asset-type">${this.getAssetTypeName(asset.type)}</div>
                
                <div class="asset-details">
                    <div class="asset-detail-row">
                        <span class="asset-detail-label">Стоимость:</span>
                        <span class="asset-detail-value">$${asset.cost.toLocaleString()}</span>
                    </div>
                    <div class="asset-detail-row">
                        <span class="asset-detail-label">Взнос:</span>
                        <span class="asset-detail-value">$${asset.downPayment.toLocaleString()}</span>
                    </div>
                    <div class="asset-detail-row">
                        <span class="asset-detail-label">Категория:</span>
                        <span class="asset-detail-value">${this.getCategoryName(asset.category)}</span>
                    </div>
                </div>
                
                <div class="asset-income">
                    +$${asset.cashFlow.toLocaleString()}/мес
                </div>
            </div>
        `).join('');
    }

    /**
     * Отрисовка пустого состояния
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <div class="empty-title">Нет активов</div>
                <div class="empty-description">
                    У вас пока нет купленных активов.<br>
                    Попадите на зеленые клетки, чтобы получить возможность купить активы.
                </div>
            </div>
        `;
    }

    /**
     * Расчет общего дохода
     */
    calculateTotalIncome(assets) {
        return assets.reduce((total, asset) => total + (asset.cashFlow || 0), 0);
    }

    /**
     * Получение названия типа актива
     */
    getAssetTypeName(type) {
        const typeNames = {
            'big_deal': 'Большая сделка',
            'small_deal': 'Малая сделка',
            'market': 'Рынок',
            'expense': 'Расходы'
        };
        return typeNames[type] || type;
    }

    /**
     * Получение названия категории
     */
    getCategoryName(category) {
        const categoryNames = {
            'real_estate': 'Недвижимость',
            'business': 'Бизнес',
            'stocks': 'Акции',
            'bonds': 'Облигации',
            'precious_metals': 'Драгоценные металлы',
            'crypto': 'Криптовалюта',
            'funds': 'Фонды',
            'home': 'Дом',
            'health': 'Здоровье',
            'transport': 'Транспорт',
            'education': 'Образование'
        };
        return categoryNames[category] || category;
    }

    /**
     * Скрытие каталога
     */
    hide() {
        this.isVisible = false;
        const modal = document.querySelector('.assets-catalog-modal');
        if (modal) {
            modal.remove();
        }
    }
}

// Создаем глобальный экземпляр
if (typeof window !== 'undefined') {
    window.assetsCatalog = new AssetsCatalog(window.cardModule);
}

export default AssetsCatalog;
