// Game Board v2.0 - Full Cards Configuration
// Полная конфигурация всех карточек сделок (103 карточки)

// Малые сделки (79 карточек)
const FULL_SMALL_DEALS = [
    // Tesla акции (5 карточек)
    { id: 'small_001', name: 'Tesla акции ($10)', cost: 10, income: 0, description: 'Tesla акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'TSLA' },
    { id: 'small_002', name: 'Tesla акции ($20)', cost: 20, income: 0, description: 'Tesla акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'TSLA' },
    { id: 'small_003', name: 'Tesla акции ($30)', cost: 30, income: 0, description: 'Tesla акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'TSLA' },
    { id: 'small_004', name: 'Tesla акции ($40)', cost: 40, income: 0, description: 'Tesla акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'TSLA' },
    { id: 'small_005', name: 'Tesla акции ($50)', cost: 50, income: 0, description: 'Tesla акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'TSLA' },
    
    // Microsoft акции (7 карточек)
    { id: 'small_006', name: 'Microsoft акции ($10)', cost: 10, income: 0, description: 'Microsoft акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'MSFT' },
    { id: 'small_007', name: 'Microsoft акции ($20)', cost: 20, income: 0, description: 'Microsoft акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'MSFT' },
    { id: 'small_008', name: 'Microsoft акции ($20)', cost: 20, income: 0, description: 'Microsoft акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'MSFT' },
    { id: 'small_009', name: 'Microsoft акции ($30)', cost: 30, income: 0, description: 'Microsoft акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'MSFT' },
    { id: 'small_010', name: 'Microsoft акции ($30)', cost: 30, income: 0, description: 'Microsoft акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'MSFT' },
    { id: 'small_011', name: 'Microsoft акции ($40)', cost: 40, income: 0, description: 'Microsoft акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'MSFT' },
    { id: 'small_012', name: 'Microsoft акции ($50)', cost: 50, income: 0, description: 'Microsoft акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'MSFT' },
    
    // Nvidia акции (7 карточек)
    { id: 'small_013', name: 'Nvidia акции ($10)', cost: 10, income: 0, description: 'Nvidia акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'NVDA' },
    { id: 'small_014', name: 'Nvidia акции ($20)', cost: 20, income: 0, description: 'Nvidia акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'NVDA' },
    { id: 'small_015', name: 'Nvidia акции ($20)', cost: 20, income: 0, description: 'Nvidia акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'NVDA' },
    { id: 'small_016', name: 'Nvidia акции ($30)', cost: 30, income: 0, description: 'Nvidia акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'NVDA' },
    { id: 'small_017', name: 'Nvidia акции ($30)', cost: 30, income: 0, description: 'Nvidia акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'NVDA' },
    { id: 'small_018', name: 'Nvidia акции ($40)', cost: 40, income: 0, description: 'Nvidia акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'NVDA' },
    { id: 'small_019', name: 'Nvidia акции ($50)', cost: 50, income: 0, description: 'Nvidia акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'NVDA' },
    
    // Apple акции (7 карточек)
    { id: 'small_020', name: 'Apple акции ($10)', cost: 10, income: 0, description: 'Apple акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'AAPL' },
    { id: 'small_021', name: 'Apple акции ($20)', cost: 20, income: 0, description: 'Apple акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'AAPL' },
    { id: 'small_022', name: 'Apple акции ($20)', cost: 20, income: 0, description: 'Apple акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'AAPL' },
    { id: 'small_023', name: 'Apple акции ($30)', cost: 30, income: 0, description: 'Apple акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'AAPL' },
    { id: 'small_024', name: 'Apple акции ($30)', cost: 30, income: 0, description: 'Apple акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'AAPL' },
    { id: 'small_025', name: 'Apple акции ($40)', cost: 40, income: 0, description: 'Apple акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'AAPL' },
    { id: 'small_026', name: 'Apple акции ($50)', cost: 50, income: 0, description: 'Apple акции (диапазон цены $10-$40)', type: 'small_deal', category: 'stocks', icon: '📈', color: '#10b981', maxQuantity: 100000, isDividendStock: false, stockSymbol: 'AAPL' },
    
    // BTC (биткоин - 10 карточек)
    { id: 'small_027', name: 'BTC ($1000)', cost: 1000, income: 100, description: 'Биткоин высокорисковый актив с колебанием цен 1000-100 000$', type: 'small_deal', category: 'crypto', icon: '₿', color: '#10b981', maxQuantity: 1000, isDividendStock: false, cryptoSymbol: 'BTC' },
    { id: 'small_028', name: 'BTC ($5000)', cost: 5000, income: 500, description: 'Биткоин высокорисковый актив с колебанием цен 1000-100 000$', type: 'small_deal', category: 'crypto', icon: '₿', color: '#10b981', maxQuantity: 1000, isDividendStock: false, cryptoSymbol: 'BTC' },
    { id: 'small_029', name: 'BTC ($10000)', cost: 10000, income: 1000, description: 'Биткоин высокорисковый актив с колебанием цен 1000-100 000$', type: 'small_deal', category: 'crypto', icon: '₿', color: '#10b981', maxQuantity: 1000, isDividendStock: false, cryptoSymbol: 'BTC' },
    { id: 'small_030', name: 'BTC ($20000)', cost: 20000, income: 2000, description: 'Биткоин высокорисковый актив с колебанием цен 1000-100 000$', type: 'small_deal', category: 'crypto', icon: '₿', color: '#10b981', maxQuantity: 1000, isDividendStock: false, cryptoSymbol: 'BTC' },
    { id: 'small_031', name: 'BTC ($50000)', cost: 50000, income: 5000, description: 'Биткоин высокорисковый актив с колебанием цен 1000-100 000$', type: 'small_deal', category: 'crypto', icon: '₿', color: '#10b981', maxQuantity: 1000, isDividendStock: false, cryptoSymbol: 'BTC' },
    { id: 'small_032', name: 'BTC ($100000)', cost: 100000, income: 10000, description: 'Биткоин высокорисковый актив с колебанием цен 1000-100 000$', type: 'small_deal', category: 'crypto', icon: '₿', color: '#10b981', maxQuantity: 1000, isDividendStock: false, cryptoSymbol: 'BTC' },
    
    // Дивидендные акции (4 карточки)
    { id: 'small_033', name: 'AT&T привилегированные акции (T)', cost: 5000, income: 30, description: 'Привилегированные акции дают доход AT&T. Дивиденды: $30/мес', type: 'small_deal', category: 'dividend_stocks', icon: '📈', color: '#10b981', maxQuantity: 1000, isDividendStock: true, dividendYield: 30, stockSymbol: 'T' },
    { id: 'small_034', name: 'AT&T привилегированные акции (T)', cost: 5000, income: 30, description: 'Привилегированные акции дают доход AT&T. Дивиденды: $30/мес', type: 'small_deal', category: 'dividend_stocks', icon: '📈', color: '#10b981', maxQuantity: 1000, isDividendStock: true, dividendYield: 30, stockSymbol: 'T' },
    { id: 'small_035', name: 'Procter & Gamble привилегированные акции (PG)', cost: 2000, income: 10, description: 'Привилегированные акции дают доход Procter & Gamble. Дивиденды: $10/мес', type: 'small_deal', category: 'dividend_stocks', icon: '📈', color: '#10b981', maxQuantity: 1000, isDividendStock: true, dividendYield: 10, stockSymbol: 'PG' },
    { id: 'small_036', name: 'Procter & Gamble привилегированные акции (PG)', cost: 2000, income: 10, description: 'Привилегированные акции дают доход Procter & Gamble. Дивиденды: $10/мес', type: 'small_deal', category: 'dividend_stocks', icon: '📈', color: '#10b981', maxQuantity: 1000, isDividendStock: true, dividendYield: 10, stockSymbol: 'PG' },
    
    // Недвижимость и бизнес (15 карточек)
    { id: 'small_037', name: 'Комната в пригороде', cost: 3000, income: 250, description: 'Комната в пригороде для сдачи в аренду', type: 'small_deal', category: 'real_estate', icon: '🏠', color: '#10b981' },
    { id: 'small_038', name: 'Комната в пригороде', cost: 3000, income: 250, description: 'Комната в пригороде для сдачи в аренду', type: 'small_deal', category: 'real_estate', icon: '🏠', color: '#10b981' },
    { id: 'small_039', name: 'Комната в пригороде', cost: 3000, income: 250, description: 'Комната в пригороде для сдачи в аренду', type: 'small_deal', category: 'real_estate', icon: '🏠', color: '#10b981' },
    { id: 'small_040', name: 'Комната в пригороде', cost: 3000, income: 250, description: 'Комната в пригороде для сдачи в аренду', type: 'small_deal', category: 'real_estate', icon: '🏠', color: '#10b981' },
    { id: 'small_041', name: 'Комната в пригороде', cost: 3000, income: 250, description: 'Комната в пригороде для сдачи в аренду', type: 'small_deal', category: 'real_estate', icon: '🏠', color: '#10b981' },
    { id: 'small_042', name: 'Студия маникюра на 1 место', cost: 4900, income: 200, description: 'Студия маникюра на 1 рабочее место', type: 'small_deal', category: 'beauty_salon', icon: '💅', color: '#10b981' },
    { id: 'small_043', name: 'Студия маникюра на 1 место', cost: 4900, income: 200, description: 'Студия маникюра на 1 рабочее место', type: 'small_deal', category: 'beauty_salon', icon: '💅', color: '#10b981' },
    { id: 'small_044', name: 'Кофейня', cost: 4900, income: 100, description: 'Небольшая кофейня', type: 'small_deal', category: 'coffee_shop', icon: '☕', color: '#10b981' },
    { id: 'small_045', name: 'Кофейня', cost: 4900, income: 100, description: 'Небольшая кофейня', type: 'small_deal', category: 'coffee_shop', icon: '☕', color: '#10b981' },
    { id: 'small_046', name: 'Партнёрство в автомастерской', cost: 4500, income: 350, description: 'Партнёрство в автомастерской', type: 'small_deal', category: 'partnership', icon: '🤝', color: '#10b981' },
    { id: 'small_047', name: 'Партнёрство в автомастерской', cost: 4500, income: 350, description: 'Партнёрство в автомастерской', type: 'small_deal', category: 'partnership', icon: '🤝', color: '#10b981' },
    { id: 'small_048', name: 'Покупка дрона для съёмок', cost: 3000, income: 50, description: 'Покупка дрона для съёмок - дополнительный доход', type: 'small_deal', category: 'equipment', icon: '🚁', color: '#10b981' },
    { id: 'small_049', name: 'Флипинг студии', cost: 5000, income: 50, description: 'Флипинг студии - перепродажа недвижимости', type: 'small_deal', category: 'flipping', icon: '🏠', color: '#10b981' },
    { id: 'small_050', name: 'Участок земли 20га', cost: 5000, income: 0, description: 'Участок земли 20 га - инвестиция в недвижимость', type: 'small_deal', category: 'land', icon: '🌍', color: '#10b981' },
    { id: 'small_051', name: 'Франшиза Plazma Life water', cost: 200, income: 0, description: 'Молодая компания Plazma Life water с сильным продуктом быстро развивается', type: 'small_deal', category: 'franchise', icon: '💧', color: '#10b981', isDiceCard: true, diceMultiplier: 100, franchiseName: 'Plazma Life water' },
    
    // Благотворительность (6 карточек)
    { id: 'small_052', name: 'Друг просит в займ', cost: 5000, income: 0, description: 'Другу нужны деньги, он вам будет благодарен', type: 'small_deal', category: 'charity', icon: '❤️', color: '#10b981', isFriendMoneyCard: true, friendCardNumber: 1 },
    { id: 'small_053', name: 'Приют для кошек', cost: 5000, income: 0, description: 'Пожертвование в приют для кошек', type: 'small_deal', category: 'charity', icon: '🐱', color: '#10b981' },
    { id: 'small_054', name: 'Накормить бездомных', cost: 5000, income: 0, description: 'Благотворительность - накормить бездомных', type: 'small_deal', category: 'charity', icon: '🍽️', color: '#10b981' },
    { id: 'small_055', name: 'Другу нужны деньги', cost: 5000, income: 0, description: 'Другу нужны деньги, он вам будет благодарен', type: 'small_deal', category: 'charity', icon: '❤️', color: '#10b981', isFriendMoneyCard: true, friendCardNumber: 2 },
    { id: 'small_056', name: 'Другу нужны деньги', cost: 5000, income: 0, description: 'Другу нужны деньги, он вам будет благодарен', type: 'small_deal', category: 'charity', icon: '❤️', color: '#10b981', isFriendMoneyCard: true, friendCardNumber: 3 },
    { id: 'small_057', name: 'Другу нужны деньги', cost: 5000, income: 0, description: 'Другу нужны деньги, он вам будет благодарен. Друг вам настолько благодарен что передает свой ход', type: 'small_deal', category: 'charity', icon: '❤️', color: '#10b981', isFriendMoneyCard: true, friendCardNumber: 4, effect: 'extra_turn' },
    
    // Расходы (2 карточки)
    { id: 'small_058', name: 'Крыша протекла', cost: 5000, income: 0, description: 'Крыша протекла — возможность обновить крышу (если у игрока есть недвижимость)', type: 'small_deal', category: 'expense', icon: '🔧', color: '#ef4444', isExpense: true },
    { id: 'small_059', name: 'Прорыв канализации', cost: 2000, income: 0, description: 'Прорыв канализации (у вас есть возможность починить канализацию)', type: 'small_deal', category: 'expense', icon: '🔧', color: '#ef4444', isExpense: true }
];

// Большие сделки (24 карточки)
const FULL_BIG_DEALS = [
    // Крупный бизнес (6 карточек)
    { id: 'big_001', name: 'Отель', cost: 100000, income: 8000, description: 'Небольшой отель в центре города', type: 'big_deal', category: 'hotel', icon: '🏨', color: '#3b82f6' },
    { id: 'big_002', name: 'Торговый центр', cost: 200000, income: 20000, description: 'Торговый центр', type: 'big_deal', category: 'mall', icon: '🏬', color: '#3b82f6' },
    { id: 'big_003', name: 'Завод', cost: 300000, income: 35000, description: 'Производственное предприятие', type: 'big_deal', category: 'factory', icon: '🏭', color: '#3b82f6' },
    { id: 'big_004', name: 'Университет', cost: 500000, income: 60000, description: 'Частный университет', type: 'big_deal', category: 'university', icon: '🎓', color: '#3b82f6' },
    { id: 'big_005', name: 'Больница', cost: 400000, income: 45000, description: 'Частная клиника', type: 'big_deal', category: 'hospital', icon: '🏥', color: '#3b82f6' },
    { id: 'big_006', name: 'Аэропорт', cost: 1000000, income: 150000, description: 'Региональный аэропорт', type: 'big_deal', category: 'airport', icon: '✈️', color: '#3b82f6' },
    
    // Дома в пригороде (10 карточек)
    { id: 'big_007', name: 'Дом в пригороде', cost: 7000, income: 100, description: 'Небольшой дом в пригороде для сдачи в аренду', type: 'big_deal', category: 'house', icon: '🏠', color: '#3b82f6' },
    { id: 'big_008', name: 'Дом в пригороде', cost: 7500, income: 120, description: 'Небольшой дом в пригороде для сдачи в аренду', type: 'big_deal', category: 'house', icon: '🏠', color: '#3b82f6' },
    { id: 'big_009', name: 'Дом в пригороде', cost: 8000, income: 140, description: 'Небольшой дом в пригороде для сдачи в аренду', type: 'big_deal', category: 'house', icon: '🏠', color: '#3b82f6' },
    { id: 'big_010', name: 'Дом в пригороде', cost: 8500, income: 160, description: 'Небольшой дом в пригороде для сдачи в аренду', type: 'big_deal', category: 'house', icon: '🏠', color: '#3b82f6' },
    { id: 'big_011', name: 'Дом в пригороде', cost: 9000, income: 180, description: 'Небольшой дом в пригороде для сдачи в аренду', type: 'big_deal', category: 'house', icon: '🏠', color: '#3b82f6' },
    { id: 'big_012', name: 'Дом в пригороде', cost: 9500, income: 200, description: 'Небольшой дом в пригороде для сдачи в аренду', type: 'big_deal', category: 'house', icon: '🏠', color: '#3b82f6' },
    { id: 'big_013', name: 'Дом в пригороде', cost: 10000, income: 220, description: 'Небольшой дом в пригороде для сдачи в аренду', type: 'big_deal', category: 'house', icon: '🏠', color: '#3b82f6' },
    { id: 'big_014', name: 'Дом в пригороде', cost: 8000, income: 150, description: 'Небольшой дом в пригороде для сдачи в аренду', type: 'big_deal', category: 'house', icon: '🏠', color: '#3b82f6' },
    { id: 'big_015', name: 'Дом в пригороде', cost: 8500, income: 170, description: 'Небольшой дом в пригороде для сдачи в аренду', type: 'big_deal', category: 'house', icon: '🏠', color: '#3b82f6' },
    { id: 'big_016', name: 'Дом в пригороде', cost: 9000, income: 190, description: 'Небольшой дом в пригороде для сдачи в аренду', type: 'big_deal', category: 'house', icon: '🏠', color: '#3b82f6' },
    
    // Средний бизнес (8 карточек)
    { id: 'big_017', name: 'Мини-отель', cost: 80000, income: 3000, description: 'Бутик-отель на 10 номеров, стабильно приносит доход', type: 'big_deal', category: 'mini_hotel', icon: '🏨', color: '#3b82f6' },
    { id: 'big_018', name: 'Мини-отель', cost: 80000, income: 3000, description: 'Бутик-отель на 10 номеров, стабильно приносит доход', type: 'big_deal', category: 'mini_hotel', icon: '🏨', color: '#3b82f6' },
    { id: 'big_019', name: 'Сеть кафе быстрого питания', cost: 200000, income: 7000, description: 'Прибыльный бизнес, несколько точек в центре города', type: 'big_deal', category: 'fast_food', icon: '🍔', color: '#3b82f6' },
    { id: 'big_020', name: 'Сеть кафе быстрого питания', cost: 200000, income: 7000, description: 'Прибыльный бизнес, несколько точек в центре города', type: 'big_deal', category: 'fast_food', icon: '🍔', color: '#3b82f6' },
    { id: 'big_021', name: 'Ферма органических овощей', cost: 120000, income: 4500, description: 'Экологичное хозяйство с контрактами на поставку', type: 'big_deal', category: 'farm', icon: '🌾', color: '#3b82f6' },
    { id: 'big_022', name: 'Сеть автомоек', cost: 150000, income: 5000, description: 'Хорошее расположение, стабильный трафик клиентов', type: 'big_deal', category: 'car_wash_chain', icon: '🚗', color: '#3b82f6' },
    { id: 'big_023', name: 'Коворкинг-центр', cost: 250000, income: 8000, description: 'Большое пространство для аренды под стартапы и фрилансеров', type: 'big_deal', category: 'coworking', icon: '🏢', color: '#3b82f6' },
    { id: 'big_024', name: 'Франшиза "Энергия денег"', cost: 100000, income: 10000, description: 'Франшиза на страну игры "Энергия денег" - прибыльный образовательный бизнес', type: 'big_deal', category: 'franchise', icon: '🎮', color: '#3b82f6' }
];

// Экспорт для браузера
if (typeof window !== 'undefined') {
    window.FULL_SMALL_DEALS = FULL_SMALL_DEALS;
    window.FULL_BIG_DEALS = FULL_BIG_DEALS;
}

// Экспорт для Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FULL_SMALL_DEALS,
        FULL_BIG_DEALS
    };
}
