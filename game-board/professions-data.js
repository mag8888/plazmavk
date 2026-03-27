// Система карточек профессий и мечты для Game Board v2.0

export const PROFESSIONS = [
    {
        id: 'entrepreneur',
        name: 'Предприниматель',
        description: 'Владелец бизнеса',
        salary: 10000,
        expenses: 6200,
        cashFlow: 3800,
        color: '#00ff96',
        icon: '🚀'
    },
    {
        id: 'doctor',
        name: 'Врач',
        description: 'Специалист в области медицины',
        salary: 8000,
        expenses: 4500,
        cashFlow: 3500,
        color: '#ff6b6b',
        icon: '👨‍⚕️'
    },
    {
        id: 'engineer',
        name: 'Инженер',
        description: 'Специалист по техническим решениям',
        salary: 7500,
        expenses: 4000,
        cashFlow: 3500,
        color: '#00bfff',
        icon: '⚙️'
    },
    {
        id: 'teacher',
        name: 'Учитель',
        description: 'Преподаватель в образовательном учреждении',
        salary: 5000,
        expenses: 3000,
        cashFlow: 2000,
        color: '#ffd93d',
        icon: '👨‍🏫'
    },
    {
        id: 'lawyer',
        name: 'Юрист',
        description: 'Специалист по правовым вопросам',
        salary: 9000,
        expenses: 5000,
        cashFlow: 4000,
        color: '#9b59b6',
        icon: '⚖️'
    },
    {
        id: 'artist',
        name: 'Художник',
        description: 'Творческий специалист',
        salary: 4000,
        expenses: 2500,
        cashFlow: 1500,
        color: '#e74c3c',
        icon: '🎨'
    }
];

export const DREAMS = [
    {
        id: 'dream_house',
        name: 'Построить дом мечты для семьи',
        type: 'мечта',
        cost: 500000,
        description: 'Собственный дом с садом и бассейном',
        icon: '🏠',
        color: '#00ff96'
    },
    {
        id: 'coffee_shop',
        name: 'Кофейня в центре города',
        type: 'бизнес',
        cost: 200000,
        income: 5000,
        description: 'Уютная кофейня с авторскими напитками',
        icon: '☕',
        color: '#8b4513'
    },
    {
        id: 'health_spa',
        name: 'Центр здоровья и спа',
        type: 'бизнес',
        cost: 300000,
        income: 8000,
        description: 'Современный центр красоты и здоровья',
        icon: '🧘‍♀️',
        color: '#ff69b4'
    },
    {
        id: 'antarctica',
        name: 'Посетить Антарктиду',
        type: 'мечта',
        cost: 50000,
        description: 'Экстремальное путешествие на край света',
        icon: '🧊',
        color: '#00bfff'
    },
    {
        id: 'mobile_app',
        name: 'Мобильное приложение (подписка)',
        type: 'бизнес',
        cost: 150000,
        income: 6000,
        description: 'Популярное приложение с подписочной моделью',
        icon: '📱',
        color: '#007bff'
    },
    {
        id: 'charity',
        name: 'Благотворительность',
        type: 'благотворительность',
        cost: 100000,
        description: 'Помощь нуждающимся и социальные проекты',
        icon: '❤️',
        color: '#e74c3c'
    },
    {
        id: 'digital_marketing',
        name: 'Агентство цифрового маркетинга',
        type: 'бизнес',
        cost: 180000,
        income: 7000,
        description: 'Современное агентство интернет-рекламы',
        icon: '📊',
        color: '#2ecc71'
    },
    {
        id: 'boutique_hotel',
        name: 'Мини-отель/бутик-гостиница',
        type: 'бизнес',
        cost: 400000,
        income: 12000,
        description: 'Эксклюзивный отель для особых гостей',
        icon: '🏨',
        color: '#f39c12'
    },
    {
        id: 'restaurant_franchise',
        name: 'Франшиза популярного ресторана',
        type: 'бизнес',
        cost: 250000,
        income: 9000,
        description: 'Успешная франшиза известного ресторана',
        icon: '🍽️',
        color: '#e67e22'
    },
    {
        id: 'mountain_climbing',
        name: 'Подняться на все высочайшие вершины мира',
        type: 'мечта',
        cost: 80000,
        description: 'Экстремальное альпинистское достижение',
        icon: '🏔️',
        color: '#34495e'
    },
    {
        id: 'bestseller_author',
        name: 'Стать автором книги-бестселлера',
        type: 'мечта',
        cost: 30000,
        description: 'Написать книгу, которая изменит мир',
        icon: '📚',
        color: '#9b59b6'
    },
    {
        id: 'yoga_center',
        name: 'Йога- и медитационный центр',
        type: 'бизнес',
        cost: 120000,
        income: 4000,
        description: 'Место для духовного развития и здоровья',
        icon: '🧘',
        color: '#1abc9c'
    },
    {
        id: 'car_wash_network',
        name: 'Сеть автомоек самообслуживания',
        type: 'бизнес',
        cost: 200000,
        income: 6000,
        description: 'Автоматизированные автомойки',
        icon: '🚗',
        color: '#3498db'
    },
    {
        id: 'yacht_mediterranean',
        name: 'Жить год на яхте в Средиземном море',
        type: 'мечта',
        cost: 300000,
        description: 'Романтическое путешествие по морю',
        icon: '⛵',
        color: '#3498db'
    },
    {
        id: 'beauty_salon',
        name: 'Салон красоты/барбершоп',
        type: 'бизнес',
        cost: 80000,
        income: 3500,
        description: 'Современный салон красоты',
        icon: '💇‍♀️',
        color: '#e91e63'
    },
    {
        id: 'online_clothing_store',
        name: 'Онлайн-магазин одежды',
        type: 'бизнес',
        cost: 100000,
        income: 4500,
        description: 'Модный интернет-магазин',
        icon: '👗',
        color: '#ff9800'
    },
    {
        id: 'world_festival',
        name: 'Организовать мировой фестиваль',
        type: 'мечта',
        cost: 200000,
        description: 'Культурное событие мирового масштаба',
        icon: '🎪',
        color: '#ff5722'
    },
    {
        id: 'retreat_center',
        name: 'Построить ретрит-центр',
        type: 'мечта',
        cost: 400000,
        description: 'Место для духовного уединения',
        icon: '🏛️',
        color: '#795548'
    },
    {
        id: 'talent_fund',
        name: 'Создать фонд поддержки талантов',
        type: 'мечта',
        cost: 150000,
        description: 'Помощь молодым талантам',
        icon: '🌟',
        color: '#ffc107'
    },
    {
        id: 'sailing_around_world',
        name: 'Кругосветное плавание на паруснике',
        type: 'мечта',
        cost: 250000,
        description: 'Великое морское путешествие',
        icon: '⛵',
        color: '#2196f3'
    },
    {
        id: 'eco_ranch',
        name: 'Туристический комплекс (эко-ранчо)',
        type: 'бизнес',
        cost: 500000,
        income: 15000,
        description: 'Экологический туристический комплекс',
        icon: '🌿',
        color: '#4caf50'
    },
    {
        id: 'stock_exchange',
        name: 'Биржа (Разово выплачивается 500 000$ если выпало 5 или 6 на кубике)',
        type: 'бизнес',
        cost: 1000000,
        income: 0,
        special: 'dice_bonus',
        description: 'Инвестиции в фондовый рынок',
        icon: '📈',
        color: '#ff9800'
    },
    {
        id: 'private_jet',
        name: 'Купить частный самолёт',
        type: 'мечта',
        cost: 2000000,
        description: 'Собственный самолёт для путешествий',
        icon: '✈️',
        color: '#607d8b'
    },
    {
        id: 'nft_platform',
        name: 'NFT-платформа',
        type: 'бизнес',
        cost: 300000,
        income: 10000,
        description: 'Платформа для торговли NFT',
        icon: '🎨',
        color: '#9c27b0'
    },
    {
        id: 'language_school',
        name: 'Школа иностранных языков',
        type: 'бизнес',
        cost: 120000,
        income: 5000,
        description: 'Современная языковая школа',
        icon: '🗣️',
        color: '#3f51b5'
    },
    {
        id: 'supercar_collection',
        name: 'Купить коллекцию суперкаров',
        type: 'мечта',
        cost: 1000000,
        description: 'Коллекция самых быстрых автомобилей',
        icon: '🏎️',
        color: '#f44336'
    },
    {
        id: 'future_school',
        name: 'Создать школу будущего для детей',
        type: 'бизнес',
        cost: 600000,
        income: 8000,
        description: 'Инновационная образовательная система',
        icon: '🎓',
        color: '#00bcd4'
    },
    {
        id: 'film_director',
        name: 'Снять полнометражный фильм',
        type: 'мечта',
        cost: 500000,
        description: 'Режиссёрский дебют в большом кино',
        icon: '🎬',
        color: '#ff4081'
    },
    {
        id: 'opinion_leader',
        name: 'Стать мировым лидером мнений',
        type: 'мечта',
        cost: 100000,
        description: 'Влиять на общественное мнение',
        icon: '🎤',
        color: '#ff5722'
    },
    {
        id: 'white_yacht',
        name: 'Белоснежная Яхта',
        type: 'мечта',
        cost: 800000,
        description: 'Роскошная яхта для морских путешествий',
        icon: '🛥️',
        color: '#ffffff'
    },
    {
        id: 'money_flow_franchise',
        name: 'Франшиза "поток денег"',
        type: 'бизнес',
        cost: 300000,
        income: 12000,
        description: 'Успешная финансовая франшиза',
        icon: '💰',
        color: '#ffd700'
    }
];

export const LOSSES = [
    {
        id: 'audit',
        name: 'Аудит',
        type: 'потеря',
        description: 'Налоговая проверка',
        penalty: 0.1,
        icon: '📋',
        color: '#f44336'
    },
    {
        id: 'cash_theft',
        name: 'Кража 100% наличных',
        type: 'потеря',
        description: 'Полная потеря наличных средств',
        penalty: 1.0,
        icon: '🔒',
        color: '#d32f2f'
    },
    {
        id: 'divorce',
        name: 'Развод',
        type: 'потеря',
        description: 'Разделение имущества',
        penalty: 0.5,
        icon: '💔',
        color: '#e91e63'
    },
    {
        id: 'fire',
        name: 'Пожар (вы теряете бизнес с мин доходом)',
        type: 'потеря',
        description: 'Потеря бизнеса с минимальным доходом',
        penalty: 0.3,
        icon: '🔥',
        color: '#ff5722'
    },
    {
        id: 'raider_capture',
        name: 'Рейдерский захват (Вы теряете бизнес с крупным доходом)',
        type: 'потеря',
        description: 'Потеря бизнеса с крупным доходом',
        penalty: 0.4,
        icon: '⚔️',
        color: '#d32f2f'
    },
    {
        id: 'sanctions',
        name: 'Санкции заблокировали все счета',
        type: 'потеря',
        description: 'Блокировка всех банковских счетов',
        penalty: 0.8,
        icon: '🚫',
        color: '#424242'
    }
];

export const INVESTMENT_CARDS = [
    {
        id: 'investment_income',
        name: 'Вам выплачивается доход от ваших инвестиций',
        type: 'деньги',
        income: 2000,
        description: 'Пассивный доход от инвестиций',
        icon: '📈',
        color: '#4caf50'
    }
];

// Функции для работы с карточками
export function getRandomProfession() {
    return PROFESSIONS[Math.floor(Math.random() * PROFESSIONS.length)];
}

export function getRandomDream() {
    return DREAMS[Math.floor(Math.random() * DREAMS.length)];
}

export function getRandomLoss() {
    return LOSSES[Math.floor(Math.random() * LOSSES.length)];
}

export function getRandomInvestment() {
    return INVESTMENT_CARDS[Math.floor(Math.random() * INVESTMENT_CARDS.length)];
}

export function getCardByType(type) {
    switch(type) {
        case 'мечта':
            return getRandomDream();
        case 'бизнес':
            return DREAMS.filter(card => card.type === 'бизнес')[Math.floor(Math.random() * DREAMS.filter(card => card.type === 'бизнес').length)];
        case 'потеря':
            return getRandomLoss();
        case 'деньги':
            return getRandomInvestment();
        case 'благотворительность':
            return DREAMS.filter(card => card.type === 'благотворительность')[0];
        default:
            return getRandomDream();
    }
}

// Экспорт для использования в браузере
if (typeof window !== 'undefined') {
    window.PROFESSIONS = PROFESSIONS;
    window.DREAMS = DREAMS;
    window.LOSSES = LOSSES;
    window.INVESTMENT_CARDS = INVESTMENT_CARDS;
    window.getRandomProfession = getRandomProfession;
    window.getRandomDream = getRandomDream;
    window.getRandomLoss = getRandomLoss;
    window.getRandomInvestment = getRandomInvestment;
    window.getCardByType = getCardByType;
    console.log('✅ Professions data loaded to window:', PROFESSIONS.length, 'professions');
}
