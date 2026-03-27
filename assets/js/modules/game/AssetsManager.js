export default class AssetsManager {
    constructor({ state, container, notifier }) {
        this.state = state;
        this.container = container;
        this.notifier = notifier;
    }

    init() {
        if (!this.container) {
            return;
        }
        this.state.on('change', (snapshot) => this.render(snapshot));
    }

    render(snapshot) {
        if (!snapshot) {
            this.container.innerHTML = '';
            return;
        }
        const player = this.state.getCurrentPlayer();
        if (!player) {
            this.container.innerHTML = '<p class="assets-placeholder">Данные игрока недоступны.</p>';
            return;
        }

        const totalValue = player.assets?.reduce((sum, asset) => sum + Number(asset.purchasePrice || 0), 0) || 0;
        const incomeValue = player.assets?.reduce((sum, asset) => sum + Number(asset.monthlyIncome || 0), 0) || 0;
        const totalEl = document.getElementById('assetsTotal');
        if (totalEl) {
            totalEl.textContent = `$${totalValue.toLocaleString()}`;
        }
        const incomeEl = document.getElementById('assetsIncome');
        if (incomeEl) {
            incomeEl.textContent = `Доход: $${incomeValue.toLocaleString()} / мес`;
        }

        if (!player.assets || player.assets.length === 0) {
            this.container.innerHTML = '<p class="assets-placeholder">У вас пока нет активов.</p>';
            return;
        }

        const otherPlayers = snapshot.players.filter(p => p.userId !== player.userId);
        this.container.innerHTML = '';

        player.assets.forEach((asset) => {
            const item = document.createElement('div');
            item.className = 'asset-item';
            item.innerHTML = `
                <div class="asset-header">
                    <span class="asset-name">${asset.name}</span>
                    <span class="asset-type">${asset.type || 'актив'}</span>
                </div>
                <div class="asset-meta">
                    <span>Цена: $${Number(asset.purchasePrice || 0).toLocaleString()}</span>
                    <span>Доход: $${Number(asset.monthlyIncome || 0).toLocaleString()} / мес</span>
                </div>
            `;

            const actions = document.createElement('div');
            actions.className = 'asset-actions';

            const sellBtn = document.createElement('button');
            sellBtn.className = 'btn btn-secondary';
            sellBtn.textContent = 'Продать';
            sellBtn.addEventListener('click', async () => {
                try {
                    await this.state.sellAsset(asset.id);
                    this.notifier?.show('Актив продан', { type: 'success' });
                } catch (error) {
                    this.notifier?.show(error.message || 'Не удалось продать актив', { type: 'error' });
                }
            });
            actions.appendChild(sellBtn);

            // Кнопка перемещения в каталог
            const catalogBtn = document.createElement('button');
            catalogBtn.className = 'btn btn-secondary';
            catalogBtn.textContent = '📦 В каталог';
            catalogBtn.addEventListener('click', () => {
                // Перемещаем актив в каталог (добавляем в глобальный каталог)
                if (window.dealsModule) {
                    window.dealsModule.moveAssetToCatalog(asset, player.userId);
                    this.notifier?.show('Актив перемещен в каталог', { type: 'success' });
                }
            });
            actions.appendChild(catalogBtn);

            if (otherPlayers.length > 0) {
                const transferWrapper = document.createElement('div');
                transferWrapper.className = 'asset-transfer';

                const select = document.createElement('select');
                select.className = 'asset-transfer-select';
                select.innerHTML = '<option value="">Передать игроку...</option>' +
                    otherPlayers.map(p => `<option value="${p.userId}">${p.name}</option>`).join('');

                const transferBtn = document.createElement('button');
                transferBtn.className = 'btn btn-primary';
                transferBtn.textContent = 'Передать';
                transferBtn.disabled = true;

                select.addEventListener('change', () => {
                    transferBtn.disabled = !select.value;
                });

                transferBtn.addEventListener('click', async () => {
                    if (!select.value) return;
                    try {
                        await this.state.transferAsset(asset.id, select.value);
                        this.notifier?.show('Актив передан', { type: 'success' });
                    } catch (error) {
                        this.notifier?.show(error.message || 'Не удалось передать актив', { type: 'error' });
                    }
                });

                transferWrapper.appendChild(select);
                transferWrapper.appendChild(transferBtn);
                actions.appendChild(transferWrapper);
            }

            item.appendChild(actions);
            this.container.appendChild(item);
        });
    }
}
