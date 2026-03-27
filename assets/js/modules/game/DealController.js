export default class DealController {
    constructor({ state, modalElement, notifier }) {
        this.state = state;
        this.modal = modalElement;
        this.notifier = notifier;
        this.headerEl = modalElement?.querySelector('[data-role="deal-header"]') || null;
        this.bodyEl = modalElement?.querySelector('[data-role="deal-body"]') || null;
        this.actionsEl = modalElement?.querySelector('[data-role="deal-actions"]') || null;
        this.closeBtn = modalElement?.querySelector('[data-role="deal-close"]') || null;
        this.visible = false;
    }

    init() {
        if (!this.modal) {
            return;
        }
        this.state.on('change', (snapshot) => this.render(snapshot));
        this.closeBtn?.addEventListener('click', () => this.hide());
        this.modal.addEventListener('click', (event) => {
            if (event.target === this.modal) {
                this.hide();
            }
        });
    }

    render(snapshot) {
        const pending = snapshot?.pendingDeal || null;
        if (!pending) {
            this.hide();
            return;
        }

        const isMine = pending.playerId === this.state.getUserId();
        const currentPlayer = snapshot.players?.find(player => player.userId === pending.playerId);
        const playerName = currentPlayer?.name || 'Игрок';

        // Оповещаем другие модули о сделке, не показывая поп-ап
        document.dispatchEvent(new CustomEvent('dealPending', {
            detail: {
                pending,
                isMine,
                playerName,
                roomState: snapshot
            }
        }));

        // Убеждаемся, что старый поп-ап скрыт
        if (this.visible) {
            this.hide();
        }
    }

    renderChoice(pending, isMine, playerName) {
        const message = document.createElement('p');
        message.textContent = isMine
            ? 'Выберите, какую сделку вы хотите открыть: малую или крупную.'
            : `${playerName} решает, какую сделку открыть.`;
        this.bodyEl.appendChild(message);

        if (!isMine) {
            return;
        }

        (pending.sizeOptions || ['small', 'big']).forEach((size) => {
            const button = document.createElement('button');
            button.className = 'btn btn-primary';
            button.textContent = size === 'small' ? 'Малая сделка' : 'Крупная сделка';
            button.addEventListener('click', async () => {
                try {
                    await this.state.chooseDeal(size);
                } catch (error) {
                    this.notifier?.show(error.message || 'Не удалось выбрать сделку', { type: 'error' });
                }
            });
            this.actionsEl.appendChild(button);
        });
    }

    renderResolution(pending, isMine, playerName) {
        const card = pending.card;
        const title = document.createElement('h4');
        title.textContent = card.name || 'Сделка';

        const details = document.createElement('div');
        details.className = 'deal-card-details';
        details.innerHTML = `
            <div><span>Тип:</span> <strong>${card.type || '-'}</strong></div>
            <div><span>Цена:</span> <strong>$${Number(card.amount || 0).toLocaleString()}</strong></div>
            <div><span>Доход:</span> <strong>$${Number(card.income || 0).toLocaleString()} / мес</strong></div>
        `;

        this.bodyEl.appendChild(title);
        this.bodyEl.appendChild(details);

        if (!isMine) {
            const notice = document.createElement('p');
            notice.textContent = `${playerName} решает, покупать ли сделку.`;
            this.bodyEl.appendChild(notice);
            return;
        }

        const buyBtn = document.createElement('button');
        buyBtn.className = 'btn btn-primary';
        buyBtn.textContent = 'Купить';
        buyBtn.addEventListener('click', async () => {
            try {
                await this.state.resolveDeal('buy');
                this.notifier?.show('Сделка приобретена', { type: 'success' });
                this.hide();
            } catch (error) {
                this.notifier?.show(error.message || 'Не удалось купить сделку', { type: 'error' });
            }
        });

        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn btn-secondary';
        skipBtn.textContent = 'Пропустить';
        skipBtn.addEventListener('click', async () => {
            try {
                await this.state.resolveDeal('skip');
                this.notifier?.show('Сделка пропущена', { type: 'info' });
                this.hide();
            } catch (error) {
                this.notifier?.show(error.message || 'Не удалось пропустить сделку', { type: 'error' });
            }
        });

        this.actionsEl.appendChild(buyBtn);
        this.actionsEl.appendChild(skipBtn);
    }

    show() {
        if (!this.modal) {
            return;
        }
        this.modal.classList.add('visible');
        this.visible = true;
    }

    hide() {
        if (!this.modal) {
            return;
        }
        this.modal.classList.remove('visible');
        this.visible = false;
    }
}
