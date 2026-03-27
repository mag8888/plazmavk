// Конфигурация клеток большого круга игры "Денежный поток"
// 44 клетки с различными типами событий

const BIG_CIRCLE_CELLS = [
  // 1-10
  {
    id: 1,
    type: 'money',
    name: 'Доход от инвестиций',
    description: 'Вам выплачивается доход от ваших инвестиций',
    income: 0,
    cost: 0
  },
  {
    id: 2,
    type: 'dream',
    name: 'Дом мечты',
    description: 'Построить дом мечты для семьи',
    income: 0,
    cost: 100000
  },
  {
    id: 3,
    type: 'business',
    name: 'Кофейня',
    description: 'Кофейня в центре города',
    income: 3000,
    cost: 100000
  },
  {
    id: 4,
    type: 'loss',
    name: 'Аудит',
    description: 'Аудит',
    income: 0,
    cost: -0.5, // -50% от наличных
    isPercentage: true
  },
  {
    id: 5,
    type: 'business',
    name: 'Центр здоровья и спа',
    description: 'Центр здоровья и спа',
    income: 5000,
    cost: 270000
  },
  {
    id: 6,
    type: 'dream',
    name: 'Антарктида',
    description: 'Посетить Антарктиду',
    income: 0,
    cost: 150000
  },
  {
    id: 7,
    type: 'business',
    name: 'Мобильное приложение',
    description: 'Мобильное приложение (подписка)',
    income: 10000,
    cost: 420000
  },
  {
    id: 8,
    type: 'charity',
    name: 'Благотворительность',
    description: 'Благотворительность',
    income: 0,
    cost: 0
  },
  {
    id: 9,
    type: 'business',
    name: 'Агентство маркетинга',
    description: 'Агентство цифрового маркетинга',
    income: 4000,
    cost: 160000
  },
  {
    id: 10,
    type: 'loss',
    name: 'Кража',
    description: 'Кража 100% наличных',
    income: 0,
    cost: -1, // -100% наличных
    isPercentage: true
  },

  // 11-20
  {
    id: 11,
    type: 'business',
    name: 'Мини-отель',
    description: 'Мини-отель/бутик-гостиница',
    income: 5000,
    cost: 200000
  },
  {
    id: 12,
    type: 'money',
    name: 'Доход от инвестиций',
    description: 'Вам выплачивается доход от ваших инвестиций',
    income: 0,
    cost: 0
  },
  {
    id: 13,
    type: 'business',
    name: 'Франшиза ресторана',
    description: 'Франшиза популярного ресторана',
    income: 8000,
    cost: 320000
  },
  {
    id: 14,
    type: 'dream',
    name: 'Вершины мира',
    description: 'Подняться на все высочайшие вершины мира',
    income: 0,
    cost: 500000
  },
  {
    id: 15,
    type: 'business',
    name: 'Мини-отель',
    description: 'Мини-отель/бутик-гостиница',
    income: 4000,
    cost: 200000
  },
  {
    id: 16,
    type: 'dream',
    name: 'Книга-бестселлер',
    description: 'Стать автором книги-бестселлера',
    income: 0,
    cost: 300000
  },
  {
    id: 17,
    type: 'business',
    name: 'Йога-центр',
    description: 'Йога- и медитационный центр',
    income: 4500,
    cost: 170000
  },
  {
    id: 18,
    type: 'loss',
    name: 'Развод',
    description: 'Развод',
    income: 0,
    cost: -0.5, // -50% от наличных
    isPercentage: true
  },
  {
    id: 19,
    type: 'business',
    name: 'Автомойки',
    description: 'Сеть автомоек самообслуживания',
    income: 3000,
    cost: 120000
  },
  {
    id: 20,
    type: 'dream',
    name: 'Яхта в Средиземном море',
    description: 'Жить год на яхте в Средиземном море',
    income: 0,
    cost: 300000
  },

  // 21-30
  {
    id: 21,
    type: 'business',
    name: 'Салон красоты',
    description: 'Салон красоты/барбершоп',
    income: 15000,
    cost: 500000
  },
  {
    id: 22,
    type: 'dream',
    name: 'Мировой фестиваль',
    description: 'Организовать мировой фестиваль',
    income: 0,
    cost: 200000
  },
  {
    id: 23,
    type: 'money',
    name: 'Доход от инвестиций',
    description: 'Вам выплачивается доход от ваших инвестиций',
    income: 0,
    cost: 0
  },
  {
    id: 24,
    type: 'business',
    name: 'Онлайн-магазин',
    description: 'Онлайн-магазин одежды',
    income: 3000,
    cost: 110000
  },
  {
    id: 25,
    type: 'loss',
    name: 'Пожар',
    description: 'Пожар (вы теряете бизнес с мин доходом)',
    income: 0,
    cost: -1, // теряете бизнес с минимальным доходом
    isBusinessLoss: true
  },
  {
    id: 26,
    type: 'dream',
    name: 'Ретрит-центр',
    description: 'Построить ретрит-центр',
    income: 0,
    cost: 500000
  },
  {
    id: 27,
    type: 'dream',
    name: 'Фонд талантов',
    description: 'Создать фонд поддержки талантов',
    income: 0,
    cost: 300000
  },
  {
    id: 28,
    type: 'dream',
    name: 'Кругосветное плавание',
    description: 'Кругосветное плавание на паруснике',
    income: 0,
    cost: 200000
  },
  {
    id: 29,
    type: 'business',
    name: 'Эко-ранчо',
    description: 'Туристический комплекс (эко-ранчо)',
    income: 20000,
    cost: 1000000
  },
  {
    id: 30,
    type: 'dream',
    name: 'Кругосветное плавание',
    description: 'Кругосветное плавание на паруснике',
    income: 0,
    cost: 300000
  },

  // 31-40
  {
    id: 31,
    type: 'business',
    name: 'Биржа',
    description: 'Биржа (Разово выплачивается 500 000$ если выпало 5 или 6 на кубике)',
    income: 0,
    cost: 50000,
    specialIncome: 500000,
    specialCondition: 'dice_5_or_6'
  },
  {
    id: 32,
    type: 'dream',
    name: 'Частный самолёт',
    description: 'Купить частный самолёт',
    income: 0,
    cost: 1000000
  },
  {
    id: 33,
    type: 'business',
    name: 'NFT-платформа',
    description: 'NFT-платформа',
    income: 12000,
    cost: 400000
  },
  {
    id: 34,
    type: 'money',
    name: 'Доход от инвестиций',
    description: 'Вам выплачивается доход от ваших инвестиций',
    income: 0,
    cost: 0
  },
  {
    id: 35,
    type: 'business',
    name: 'Школа языков',
    description: 'Школа иностранных языков',
    income: 3000,
    cost: 20000
  },
  {
    id: 36,
    type: 'dream',
    name: 'Коллекция суперкаров',
    description: 'Купить коллекцию суперкаров',
    income: 0,
    cost: 1000000
  },
  {
    id: 37,
    type: 'business',
    name: 'Школа будущего',
    description: 'Создать школу будущего для детей',
    income: 10000,
    cost: 300000
  },
  {
    id: 38,
    type: 'dream',
    name: 'Полнометражный фильм',
    description: 'Снять полнометражный фильм',
    income: 0,
    cost: 500000
  },
  {
    id: 39,
    type: 'loss',
    name: 'Рейдерский захват',
    description: 'Рейдерский захват (Вы теряете бизнес с крупным доходом)',
    income: 0,
    cost: -1, // теряете бизнес с максимальным доходом
    isBusinessLoss: true
  },
  {
    id: 40,
    type: 'dream',
    name: 'Мировой лидер',
    description: 'Стать мировым лидером мнений',
    income: 0,
    cost: 1000000
  },

  // 41-44
  {
    id: 41,
    type: 'business',
    name: 'Автомойки',
    description: 'Сеть автомоек самообслуживания',
    income: 3500,
    cost: 120000
  },
  {
    id: 42,
    type: 'dream',
    name: 'Белоснежная яхта',
    description: 'Белоснежная Яхта',
    income: 0,
    cost: 300000
  },
  {
    id: 43,
    type: 'business',
    name: 'Франшиза "Поток денег"',
    description: 'Франшиза "поток денег"',
    income: 10000,
    cost: 100000
  },
  {
    id: 44,
    type: 'dream',
    name: 'Полёт в космос',
    description: 'Полёт в космос',
    income: 0,
    cost: 250000
  }
];

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BIG_CIRCLE_CELLS;
} else if (typeof window !== 'undefined') {
  window.BIG_CIRCLE_CELLS = BIG_CIRCLE_CELLS;
}
