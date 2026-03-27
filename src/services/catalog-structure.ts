export type CatalogStructure = Array<{
  id: string;
  name: string;
  slug: string;
  subcategories: Array<{
    id: string;
    name: string;
    slug: string;
    description?: string;
    related_skus: string[];
  }>;
}>;

// Структура витрины (клиентская): категории -> подкатегории -> товары по SKU.
// Цены и базовые категории в админке НЕ меняем.
export const CATALOG_STRUCTURE: CatalogStructure = [
  {
    id: 'face_care',
    name: 'Уход за лицом',
    slug: 'face-care',
    subcategories: [
      {
        id: 'face_oils',
        name: 'Масла и сыворотки',
        slug: 'face-oils-serums',
        description: 'Премиальные смеси масел холодного отжима и моно-масла (Моринга, Аргана, Таману).',
        related_skus: ['FS1003-24', 'FS1002-24', 'FO0001-30', 'FO0002-30', 'FO0003-30', 'SI0044-45', 'SI0045-45', 'SI0046-45', 'GOS0003-20'],
      },
      {
        id: 'face_cleansing',
        name: 'Очищение',
        slug: 'cleansing',
        description: 'Гидрофильные масла, очищающие кремы и скрабы.',
        related_skus: ['FC0001-45', 'FC0003-45', 'FC0020-90', 'FC0021-90', 'FB0002-20', 'PB0008-100'],
      },
      {
        id: 'toners',
        name: 'Тоники и цветочные воды',
        slug: 'toners-mists',
        description: 'Натуральные гидролаты и бесспиртовые тоники.',
        related_skus: ['FS0016-50', 'FS0018-50'],
      },
    ],
  },
  {
    id: 'body_care',
    name: 'Уход за телом',
    slug: 'body-care',
    subcategories: [
      {
        id: 'body_wash',
        name: 'Гели для душа и мыло',
        slug: 'body-wash-soap',
        description: 'Натуральные гели для душа и мыло ручной работы.',
        related_skus: ['SP0020-470', 'SP0021-470', 'SP0022-470', 'SP0003-25', 'SP0014-50'],
      },
      {
        id: 'body_moisturizers',
        name: 'Увлажнение и питание',
        slug: 'lotions-balms',
        description: 'Лосьоны для тела, густые баттеры и бальзамы.',
        related_skus: ['BL1001-90', 'BL1002-90', 'BA1001-12', 'BA0002-25'],
      },
    ],
  },
  {
    id: 'hair_care',
    name: 'Уход за волосами',
    slug: 'hair-care',
    subcategories: [
      {
        id: 'shampoo',
        name: 'Шампуни',
        slug: 'shampoo',
        description: 'Безсульфатные шампуни с эфирными маслами.',
        related_skus: ['SH0001-470', 'SH0002-470'],
      },
      {
        id: 'conditioner',
        name: 'Кондиционеры',
        slug: 'conditioner',
        description: 'Питательные кондиционеры для всех типов волос.',
        related_skus: ['HT0001-420'],
      },
    ],
  },
  {
    id: 'aromatherapy',
    name: 'Ароматерапия',
    slug: 'aromatherapy',
    subcategories: [
      {
        id: 'solid_perfume',
        name: 'Твердые духи',
        slug: 'solid-perfume',
        description: 'Компактные духи на основе пчелиного воска.',
        related_skus: ['PE1001-12', 'PE1003-12'],
      },
      {
        id: 'rollers',
        name: 'Арома-роллеры',
        slug: 'rollers',
        description: 'Смеси эфирных масел для нанесения на точки пульсации.',
        related_skus: ['R001-5', 'R003-5'],
      },
    ],
  },
  {
    id: 'men_collection',
    name: 'Мужская коллекция',
    slug: 'men-collection',
    subcategories: [
      {
        id: 'men_face',
        name: 'Уход для мужчин',
        slug: 'men-face-body',
        description: 'Специальные формулы масел и очищения для мужской кожи.',
        related_skus: ['FS1002-24', 'SP0014-50'],
      },
    ],
  },
];

