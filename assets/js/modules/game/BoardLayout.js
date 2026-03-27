// Простая раскладка клеток для визуализации треков на game.html
// Рисуем 44 клетки по периметру внешнего квадрата и 24 клетки в круглом внутреннем треке

// Загружаем конфигурацию клеток
let smallCircleCellsData = [];
let bigCircleCellsData = null;

// Сначала проверяем window.SMALL_CIRCLE_CELLS
if (typeof window !== 'undefined' && window.SMALL_CIRCLE_CELLS && window.SMALL_CIRCLE_CELLS.length > 0) {
    console.log('🔍 BoardLayout: Using window.SMALL_CIRCLE_CELLS:', window.SMALL_CIRCLE_CELLS.length);
    smallCircleCellsData = window.SMALL_CIRCLE_CELLS;
} else {
    console.log('🔍 BoardLayout: Using fallback config for small circle');
    // Fallback конфигурация
    smallCircleCellsData = [
        { id: 1, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 2, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
        { id: 3, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 4, type: 'orange_charity', name: 'Благотворительность', description: 'Пожертвовать деньги для получения возможности бросать 2 кубика', color: 'orange', icon: '❤️', action: 'charity_donation', percentage: 0.1, benefit: 'double_dice' },
        { id: 5, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 6, type: 'blue_dividend', name: 'Дивиденды', description: 'Получить дивиденды от инвестиций', color: 'blue', icon: '💰', action: 'receive_dividends' },
        { id: 7, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 8, type: 'purple_business', name: 'Бизнес', description: 'Возможность купить или продать бизнес', color: 'purple', icon: '🏪', action: 'business_opportunity' },
        { id: 9, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 10, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
        { id: 11, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 12, type: 'yellow_baby', name: 'Семья', description: 'Рождение ребенка - дополнительные расходы', color: 'yellow', icon: '👶', action: 'family_expense', cost: 5000 },
        { id: 13, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 14, type: 'blue_dividend', name: 'Дивиденды', description: 'Получить дивиденды от инвестиций', color: 'blue', icon: '💰', action: 'receive_dividends' },
        { id: 15, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 16, type: 'purple_business', name: 'Бизнес', description: 'Возможность купить или продать бизнес', color: 'purple', icon: '🏪', action: 'business_opportunity' },
        { id: 17, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 18, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
        { id: 19, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 20, type: 'red_downsize', name: 'Сокращение', description: 'Потеря работы - временное сокращение доходов', color: 'red', icon: '💸', action: 'downsize', cost: 10000 },
        { id: 21, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 22, type: 'blue_dividend', name: 'Дивиденды', description: 'Получить дивиденды от инвестиций', color: 'blue', icon: '💰', action: 'receive_dividends' },
        { id: 23, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
        { id: 24, type: 'purple_business', name: 'Бизнес', description: 'Возможность купить или продать бизнес', color: 'purple', icon: '🏪', action: 'business_opportunity' }
    ];
}

// Загружаем BIG_CIRCLE_CELLS
if (typeof window !== 'undefined' && window.BIG_CIRCLE_CELLS && window.BIG_CIRCLE_CELLS.length > 0) {
    console.log('🔍 BoardLayout: Using window.BIG_CIRCLE_CELLS:', window.BIG_CIRCLE_CELLS.length);
    bigCircleCellsData = window.BIG_CIRCLE_CELLS;
} else {
    console.log('🔍 BoardLayout: BIG_CIRCLE_CELLS not loaded from window, using empty array');
    bigCircleCellsData = [];
}

// Загружаем функции иконок
if (typeof window.getIconForType === 'undefined') {
    window.getIconForType = function(cellType, style = 'emoji') {
        const icons = {
            'green_opportunity': '💚',
            'pink_expense': '🛒',
            'blue_opportunity': '💙',
            'yellow_expense': '💛',
            'red_expense': '❤️',
            'purple_opportunity': '💜',
            'orange_charity': '❤️',
            'blue_dividend': '💰',
            'purple_business': '🏪',
            'yellow_baby': '👶',
            'red_downsize': '💸',
            // Missing types from small-circle-cells config
            'yellow_payday': '🟡',
            'blue_market': '🛍️',
            'black_loss': '💣'
        };
        return icons[cellType] || '⬤';
    };
}

if (typeof window.getIconStyleClass === 'undefined') {
    window.getIconStyleClass = function(style = 'emoji') {
        return style === 'monochrome' ? 'icon-monochrome' : 'icon-emoji';
    };
}

// Функция для получения иконок большого круга
function getBigCircleIcon(cellType) {
    const icons = {
        'money': '💰',
        'dream': '🌟',
        'business': '🏢',
        'loss': '💸',
        'charity': '❤️'
    };
    return icons[cellType] || '⬤';
}

// Простой поп-ап для клеток
function showSimplePopup(cellData) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    `;
    
    content.innerHTML = `
        <h3 style="margin: 0 0 15px 0; color: #333;">${cellData.name}</h3>
        <p style="margin: 0 0 15px 0; color: #666; line-height: 1.5;">${cellData.description}</p>
        ${cellData.income ? `<p style="margin: 0 0 10px 0; color: #28a745;"><strong>Доход:</strong> $${cellData.income.toLocaleString()}</p>` : ''}
        ${cellData.cost ? `<p style="margin: 0 0 10px 0; color: #dc3545;"><strong>Стоимость:</strong> $${cellData.cost.toLocaleString()}</p>` : ''}
        <button onclick="this.closest('div').remove()" style="
            margin-top: 20px;
            padding: 12px 24px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
        ">Закрыть</button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Закрытие по клику вне модального окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

console.log('🔍 BoardLayout: Config loaded - SMALL_CIRCLE_CELLS:', smallCircleCellsData?.length || 0, 'BIG_CIRCLE_CELLS:', bigCircleCellsData?.length || 0, 'getIconForType:', typeof window.getIconForType, 'getIconStyleClass:', typeof window.getIconStyleClass);
console.log('🔍 BoardLayout: BIG_CIRCLE_CELLS sample:', bigCircleCellsData?.slice(0, 3) || []);

function createCellElement(index, sizeClass, isInner = false) {
    const el = document.createElement('div');
    el.className = `track-cell ${sizeClass}`;
    el.style.cursor = 'pointer';
    
    const num = document.createElement('div');
    num.className = 'cell-number';
    num.textContent = String(index + 1);
    
    const icon = document.createElement('div');
    icon.className = 'cell-icon';
    
    // Получаем данные клетки и иконку
    let cellData = null;
    let iconText = '⬤';
    let iconClass = '';
    let isSelectedDream = false;
    
    console.log('🔍 BoardLayout: Creating cell', index, 'isInner:', isInner, 'SMALL_CIRCLE_CELLS length:', smallCircleCellsData?.length || 0, 'BIG_CIRCLE_CELLS length:', bigCircleCellsData?.length || 0);
    
    if (isInner && smallCircleCellsData && index < smallCircleCellsData.length) {
        // Внутренний круг - используем SMALL_CIRCLE_CELLS
        cellData = smallCircleCellsData[index];
        iconText = window.getIconForType ? window.getIconForType(cellData.type) : cellData.icon;
        console.log('🔍 Icon lookup - cellData.type:', cellData.type, 'iconText:', iconText, 'getIconForType exists:', !!window.getIconForType);
        
        // Для теста: каждая 3-я клетка использует монохромный стиль
        if (index % 3 === 0) {
            iconClass = 'icon-monochrome';
        } else {
            iconClass = window.getIconStyleClass ? window.getIconStyleClass('emoji') : 'icon-emoji';
        }
        
        // Проверяем, является ли эта клетка выбранной мечтой
        if (window.currentRoom?.currentPlayer?.selectedDream) {
            isSelectedDream = cellData.id === window.currentRoom.currentPlayer.selectedDream;
            console.log('🔍 BoardLayout: Checking dream match:', {
                cellId: cellData.id,
                selectedDream: window.currentRoom.currentPlayer.selectedDream,
                isSelectedDream
            });
        }
        
        console.log('🔍 BoardLayout: Inner cell data:', cellData, 'iconText:', iconText, 'iconClass:', iconClass, 'isSelectedDream:', isSelectedDream);
    } else if (!isInner && bigCircleCellsData && index < bigCircleCellsData.length) {
        // Внешний круг - используем BIG_CIRCLE_CELLS
        cellData = bigCircleCellsData[index];
        iconText = getBigCircleIcon(cellData.type);
        iconClass = window.getIconStyleClass ? window.getIconStyleClass('emoji') : 'icon-emoji';
        
        console.log('🔍 BoardLayout: Outer cell data:', cellData, 'iconText:', iconText, 'iconClass:', iconClass);
    }
    
    icon.textContent = iconText;
    // Ensure iconClass is never empty
    if (!iconClass) {
        iconClass = 'icon-emoji';
    }
    icon.className += ` ${iconClass}`;
    
    // Добавляем сердечко для выбранной мечты
    if (isSelectedDream) {
        const heart = document.createElement('div');
        heart.className = 'dream-heart';
        heart.textContent = '❤️';
        heart.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            font-size: 16px;
            z-index: 20;
            animation: heartbeat 1.5s ease-in-out infinite;
            filter: drop-shadow(0 2px 4px rgba(255, 0, 0, 0.3));
        `;
        el.appendChild(heart);
        console.log('🔍 BoardLayout: Added heart for selected dream:', cellData.id);
    }
    
    // Добавляем обработчик клика
    el.addEventListener('click', () => {
        if (cellData && window.cellPopup) {
            window.cellPopup.show(cellData);
        } else if (cellData) {
            // Fallback поп-ап если cellPopup не доступен
            showSimplePopup(cellData);
        }
    });
    
    // Hover эффекты теперь обрабатываются через CSS
    
    el.appendChild(num);
    el.appendChild(icon);
    return el;
}

function placeAlongPerimeter(container, total, insetPx, isInner) {
    const size = container.clientWidth; // квадрат
    
    if (isInner) {
        // Для малого круга создаем круглую раскладку
        return placeInCircle(container, total, insetPx);
    } else {
        // Для внешнего трека используем квадратную раскладку
        const step = (size - insetPx * 2) / 11; // 11 сегментов на сторону
        const cellsPerSide = 11; // 11 на сторону, 44 всего с углами
        const positions = [];
        for (let side = 0; side < 4; side++) {
            for (let i = 0; i < cellsPerSide; i++) {
                const idx = side * cellsPerSide + i;
                if (idx >= total) break;
                let x = 0; let y = 0;
                const offset = insetPx;
                if (side === 0) { // top → left→right
                    x = offset + i * step;
                    y = offset;
                } else if (side === 1) { // right side top→bottom
                    x = size - offset;
                    y = offset + i * step;
                } else if (side === 2) { // bottom right→left
                    x = size - offset - i * step;
                    y = size - offset;
                } else { // left side bottom→top
                    x = offset;
                    y = size - offset - i * step;
                }
                positions.push({ x, y });
            }
        }
        return positions.slice(0, total);
    }
}

function placeInCircle(container, total, insetPx) {
    const size = container.clientWidth;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = (size - insetPx * 2) / 2;
    
    const positions = [];
    for (let i = 0; i < total; i++) {
        const angle = (i / total) * 2 * Math.PI - Math.PI / 2; // Начинаем с верха
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        positions.push({ x, y });
    }
    return positions;
}

// Глобальная переменная для хранения информации о комнате
window.currentRoom = null;

function renderTracks(room = null) {
    console.log('🎯 renderTracks called');
    console.log('🔍 BoardLayout: SMALL_CIRCLE_CELLS available:', typeof smallCircleCellsData, 'length:', smallCircleCellsData?.length);
    console.log('🔍 BoardLayout: BIG_CIRCLE_CELLS available:', typeof bigCircleCellsData, 'length:', bigCircleCellsData?.length);
    console.log('🔍 BoardLayout: getIconForType available:', typeof window.getIconForType);
    console.log('🔍 BoardLayout: getIconStyleClass available:', typeof window.getIconStyleClass);
    
    // Проверяем, загружены ли конфигурации
    if (!smallCircleCellsData || smallCircleCellsData.length === 0) {
        console.log('🔍 BoardLayout: Configs not loaded, using fallback');
        // Используем fallback конфигурацию
        smallCircleCellsData = [
            { id: 1, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 2, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
            { id: 3, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 4, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
            { id: 5, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 6, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
            { id: 7, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 8, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
            { id: 9, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 10, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
            { id: 11, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 12, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
            { id: 13, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 14, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
            { id: 15, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 16, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
            { id: 17, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 18, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
            { id: 19, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 20, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
            { id: 21, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 22, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 },
            { id: 23, type: 'green_opportunity', name: 'Зеленая возможность', description: 'Малая / большая (на выбор)', color: 'green', icon: '💚', action: 'choose_opportunity' },
            { id: 24, type: 'pink_expense', name: 'Всякая всячина', description: 'Клетка с обязательными тратами от 100 до 4000$', color: 'pink', icon: '🛒', action: 'mandatory_expense', minCost: 100, maxCost: 4000 }
        ];
    }
    
    // getIconForType already defined above, no need to redefine
    
    if (!window.getIconStyleClass) {
        window.getIconStyleClass = function(style = 'emoji') {
            return style === 'monochrome' ? 'icon-monochrome' : 'icon-emoji';
        };
    }
    
    // Сохраняем информацию о комнате
    if (room) {
        window.currentRoom = room;
        console.log('🔍 BoardLayout: Room data saved:', {
            currentPlayer: room.currentPlayer,
            selectedDream: room.currentPlayer?.selectedDream
        });
    }
    
    // Конфигурации уже загружены выше с fallback
    
    const outer = document.getElementById('outerTrack');
    const inner = document.getElementById('innerTrack');
    
    console.log('🎯 outerTrack found:', !!outer);
    console.log('🎯 innerTrack found:', !!inner);
    
    if (!outer || !inner) {
        console.log('❌ Track elements not found, retrying in 100ms');
        setTimeout(renderTracks, 100);
        return;
    }

    // Очистим
    outer.innerHTML = '';
    inner.innerHTML = '';

    // Создадим временные абсолютно позиционированные контейнеры
    outer.style.position = 'absolute';
    inner.style.position = 'absolute';

    const outerCount = 44;
    const innerCount = 24; // Малый круг теперь имеет 24 клетки

    // Рассчитать позиции после layout
    // Используем requestAnimationFrame, чтобы размеры были актуальны
    requestAnimationFrame(() => {
        console.log('🎯 Creating track cells...');
        const outerPositions = placeAlongPerimeter(outer.parentElement, outerCount, 18, false);
        const innerPositions = placeInCircle(inner.parentElement, innerCount, 110);

        console.log('🎯 Outer positions:', outerPositions.length);
        console.log('🎯 Inner positions:', innerPositions.length);

        outerPositions.forEach((pos, i) => {
            const el = createCellElement(i, '');
            el.style.position = 'absolute';
            el.style.transform = 'translate(-50%, -50%)';
            el.style.left = `${pos.x}px`;
            el.style.top = `${pos.y}px`;
            outer.appendChild(el);
        });

        innerPositions.forEach((pos, i) => {
            const el = createCellElement(i, '', true); // isInner = true для иконок
            el.style.position = 'absolute';
            el.style.transform = 'translate(-50%, -50%)';
            el.style.left = `${pos.x}px`;
            el.style.top = `${pos.y}px`;
            inner.appendChild(el);
        });
        
        console.log('✅ Track cells created');

        // Кэшируем позиции для анимации фишек
        window._innerPositionsCache = innerPositions;

        // Рендер фишек игроков из текущего состояния игры
        renderPlayerTokensFromState(innerPositions);
    });
}

// Анимация перемещения фишки по внутреннему кругу с синхронизированной подсветкой
function animateInnerMove(pathIndices, delayMs = 500, userId = null) {
    const inner = document.getElementById('innerTrack');
    if (!inner || !Array.isArray(pathIndices) || pathIndices.length === 0) return;
    
    const cells = Array.from(inner.children);
    const positions = window._innerPositionsCache || [];
    const tokensLayer = document.getElementById('playerTokens');
    
    if (!tokensLayer || positions.length === 0) return;
    
    // Устанавливаем флаг анимации
    window._isAnimatingMove = true;
    console.log('🎬 Starting move animation for user:', userId);
    
    // Находим фишку игрока
    let targetId = userId;
    if (!targetId) {
        try { 
            targetId = window.GameState?.getUserId?.() || null; 
        } catch (_) {}
    }
    
    // Если все еще нет userId, пробуем получить из gameState
    if (!targetId && window.gameState && window.gameState.state) {
        targetId = window.gameState.state.me;
    }
    
    console.log('🎬 Looking for token with userId:', targetId);
    
    const token = targetId
        ? tokensLayer.querySelector(`.player-token[data-user-id="${String(targetId)}"]`)
        : tokensLayer.querySelector('.player-token');
        
    if (!token) {
        console.log('🎬 Token not found, available tokens:', Array.from(tokensLayer.querySelectorAll('.player-token')).map(t => t.dataset.userId));
        window._isAnimatingMove = false;
        return;
    }
    
    console.log('🎬 Found token for user:', targetId);

    // Убираем все предыдущие подсветки
    cells.forEach(c => {
        c.style.outline = '';
        c.classList.remove('active-player-cell');
    });

    // Включаем плавную анимацию перемещения и масштаба
    token.style.transition = 'left 200ms ease-in, top 200ms ease-in, transform 150ms ease-in-out';
    
    let moveIdx = 0;
    const stepMove = () => {
        const cellIndex = pathIndices[moveIdx];
        const pos = positions[cellIndex];
        
        if (pos) {
            // Синхронизированное движение фишки и подсветка клетки
            token.style.transform = 'scale(1.12)';
            token.style.left = `${pos.x}px`;
            token.style.top = `${pos.y}px`;
            
            // Подсвечиваем текущую клетку
            cells.forEach(c => c.style.outline = '');
            const cell = cells[cellIndex];
            if (cell) {
                cell.style.outline = '3px solid #16f79e';
                cell.classList.add('active-player-cell');
            }
        }
        
        const isLast = moveIdx >= pathIndices.length - 1;
        moveIdx++;
        
        if (isLast) {
            // На финальной клетке — уменьшение к норме
            setTimeout(() => {
                token.style.transition = 'left 220ms ease-out, top 220ms ease-out, transform 220ms ease-out';
                token.style.transform = 'scale(1.0)';
                
                // Завершаем анимацию
                setTimeout(() => {
                    window._isAnimatingMove = false;
                    console.log('🎬 Move animation completed');

                    // После завершения движения активируем событие клетки
                    try {
                        const finalIndex = Array.isArray(pathIndices) && pathIndices.length > 0
                            ? pathIndices[pathIndices.length - 1]
                            : null;
                        const cellData = Array.isArray(smallCircleCellsData) && finalIndex != null
                            ? smallCircleCellsData[finalIndex]
                            : null;
                        const cellType = cellData?.type || 'unknown';

                        const detail = {
                            cellType,
                            playerId: userId || (window?.GameState?.getUserId?.() || null),
                            cell: cellData || null,
                            position: finalIndex
                        };

                        // Отправляем событие через EventBus, если он доступен
                        if (window.gameCore && window.gameCore.eventBus && typeof window.gameCore.eventBus.emit === 'function') {
                            window.gameCore.eventBus.emit('cellEvent', detail);
                        }
                        // И всегда дублируем через DOM-событие, чтобы слушатели без eventBus тоже сработали
                        document.dispatchEvent(new CustomEvent('cellEvent', { detail }));
                    } catch (e) {
                        console.warn('⚠️ Failed to emit cellEvent after move:', e);
                    }
                }, 500);
            }, 120);
            return;
        }
        
        // Продолжаем движение
        setTimeout(stepMove, Math.max(160, Math.floor(delayMs * 0.5)));
    };
    
    // Запускаем анимацию
    stepMove();
}

if (typeof window !== 'undefined') {
    window.animateInnerMove = animateInnerMove;
}

// Экспорт в глобальную область для прямого вызова
if (typeof window !== 'undefined') {
    window.renderTracks = renderTracks;
    
    // Автозапуск, если подгружается напрямую
    window.addEventListener('DOMContentLoaded', () => {
        const hasTracks = document.getElementById('outerTrack') && document.getElementById('innerTrack');
        if (hasTracks) {
            renderTracks();
        }
    });
}

// Рендер фишек игроков из текущего состояния игры
function renderPlayerTokensFromState(innerPositions) {
    // Получаем состояние игры из глобального объекта GameState
    if (window.gameState && window.gameState.state && Array.isArray(window.gameState.state.players)) {
        renderPlayerTokens(window.gameState.state, innerPositions);
        
        // Синхронизируем подсветку с активным игроком только если нет анимации
        if (!window._isAnimatingMove) {
            highlightActivePlayer(window.gameState.state);
        } else {
            console.log('🎬 Skipping highlight update during animation');
        }
    }
}

// Подсветка активного игрока (только если ход завершен)
function highlightActivePlayer(gameState) {
    const inner = document.getElementById('innerTrack');
    if (!inner || !gameState.activePlayerId) return;
    
    // Проверяем, не идет ли сейчас анимация движения
    if (window._isAnimatingMove) {
        console.log('🎬 Animation in progress, skipping highlight update');
        return;
    }
    
    // Убираем все подсветки
    const cells = Array.from(inner.children);
    cells.forEach(cell => {
        cell.style.outline = '';
        cell.classList.remove('active-player-cell');
    });
    
    // Находим активного игрока
    const activePlayer = gameState.players.find(p => p.userId === gameState.activePlayerId);
    if (!activePlayer) return;
    
    // Подсвечиваем клетку активного игрока
    const cellIndex = Number(activePlayer.position || 0) % cells.length;
    const activeCell = cells[cellIndex];
    if (activeCell) {
        activeCell.style.outline = '3px solid #16f79e';
        activeCell.classList.add('active-player-cell');
    }
}

// Делаем функцию глобальной
window.renderPlayerTokensFromState = renderPlayerTokensFromState;

// Рендер фишек игроков на внутреннем треке по их выбранным токенам и позициям
function renderPlayerTokens(room, innerPositions) {
    const container = document.getElementById('playerTokens');
    if (!container) return;
    container.innerHTML = '';

    const tokenEmojiMap = {
        lion: '🦁', tiger: '🐯', fox: '🦊', panda: '🐼', frog: '🐸', owl: '🦉', octopus: '🐙', whale: '🐋'
    };

    // Цвета для обводки фишек игроков
    const playerColors = [
        '#16f79e', // Зеленый
        '#ff6b6b', // Красный
        '#4ecdc4', // Бирюзовый
        '#45b7d1', // Синий
        '#96ceb4', // Мятный
        '#feca57', // Желтый
        '#ff9ff3', // Розовый
        '#54a0ff'  // Голубой
    ];

    (room.players || []).forEach((p, idx) => {
        const token = document.createElement('div');
        token.className = 'player-token';
        token.dataset.userId = p.userId;
        token.textContent = tokenEmojiMap[p.selectedToken] || '🔷';
        
        // Добавляем цветную обводку
        const playerColor = playerColors[idx % playerColors.length];
        token.style.border = `3px solid ${playerColor}`;
        token.style.boxShadow = `0 0 10px ${playerColor}40, inset 0 0 5px ${playerColor}20`;
        token.style.backgroundColor = `${playerColor}20`;
        token.style.borderRadius = '50%';
        token.style.padding = '2px';
        
        // Добавляем класс active для активного игрока
        if (room.activePlayerId && p.userId === room.activePlayerId) {
            token.classList.add('active');
        }
        
        const posIndex = Number(p.position || 0) % (innerPositions.length || 1);
        const pos = innerPositions[posIndex] || { x: 0, y: 0 };
        const offsetStep = 8;
        const offset = (Number(p.tokenOffset ?? idx) % 4) * offsetStep;
        token.style.left = `${pos.x + offset}px`;
        token.style.top = `${pos.y + offset}px`;
        container.appendChild(token);
    });
    
    // Синхронизируем подсветку с активным игроком только если нет анимации
    if (room.activePlayerId && !window._isAnimatingMove) {
        highlightActivePlayer(room);
    }
}


