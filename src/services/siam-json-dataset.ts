export type SiamJsonEntry = {
  title: string;
  short_description: string;
  full_description: string;
  price?: string | number;
  sku: string;
  volume?: string;
  ingredients?: string;
};

// Встроенный датасет (из PDF/Perplexity). Цена НЕ используется для обновлений (оставляем как на сайте).
export const SIAM_JSON_ENTRIES: SiamJsonEntry[] = [
  {
    title: 'Масло для лица Rudis Oleum (Original Formula)',
    short_description: 'Легендарная смесь масел для глубокого питания и сияния кожи.',
    full_description:
      'Флагманский продукт бренда. Мощная смесь масел холодного отжима, богатая антиоксидантами. Питает, восстанавливает эластичность, защищает от старения. Подходит для всех типов кожи.',
    price: 'По запросу',
    sku: 'FS1003-24',
    volume: '24 мл',
    ingredients:
      'Oryza Sativa Rice Bran Oil, Vitis Vinifera Grape Seed Oil, Prunus Amygdalus Dulcis Sweet Almond Oil, Moringa Oleifera Moringa Seed Oil, Argania Spinosa Argan Kernel Oil, Rosmarinus Officinalis Rosemary Leaf Oil, Cymbopogon Citratus Lemongrass Oil, Tocopherol',
  },
  {
    title: 'Масло для лица Rudis Oleum (Men\'s Formula)',
    short_description: 'Мужская версия легендарного масла для лица.',
    full_description:
      'Специально разработанная формула для мужской кожи. Успокаивает после бритья, питает, не оставляя жирного блеска. Имеет более терпкий аромат гвоздики и мяты.',
    price: 'По запросу',
    sku: 'FS1002-24',
    volume: '24 мл',
    ingredients:
      'Vitis Vinifera Grape Seed Oil, Prunus Amygdalus Dulcis Sweet Almond Oil, Simmondsia Chinensis Jojoba Seed Oil, Moringa Oleifera Moringa Seed Oil, Cymbopogon Citratus Lemongrass Oil, Rosmarinus Officinalis Rosemary Leaf Oil, Eugenia Caryophyllus Clove Leaf Oil, Mentha Piperita Peppermint Oil',
  },
  {
    title: 'Масло для лица Rudis Oleum (Sensitive/Repair)',
    short_description: 'Восстанавливающее масло с таману для чувствительной кожи.',
    full_description:
      'Обогащено маслом Таману для мощной регенерации. Идеально для поврежденной кожи, склонной к воспалениям или шрамам.',
    price: 'По запросу',
    sku: 'FS1006-24',
    volume: '24 мл',
    ingredients:
      'Calophyllum Inophyllum Tamanu Seed Oil, Moringa Oleifera Moringa Seed Oil, Argania Spinosa Argan Kernel Oil, Pelargonium Graveolens Geranium Flower Oil, Citrus Aurantium Bergamia Bergamot Fruit Oil',
  },
  {
    title: 'Масло для лица \'Rosehip & Jojoba\' (Шиповник и Жожоба)',
    short_description: 'Антивозрастное масло для выравнивания тона.',
    full_description:
      'Классическое сочетание для зрелой кожи. Масло шиповника стимулирует регенерацию, жожоба увлажняет. Помогает бороться с пигментацией и мелкими морщинами.',
    price: 'По запросу',
    sku: 'FO0001-30',
    volume: '30 мл',
    ingredients:
      'Simmondsia Chinensis Jojoba Seed Oil, Rosa Canina Rosehip Fruit Oil, Argania Spinosa Argan Kernel Oil, Tocopherol',
  },
  {
    title: 'Масло для лица \'Cranberry & Black Cumin\' (Клюква и Черный Тмин)',
    short_description: 'Уход для проблемной и склонной к акне кожи.',
    full_description:
      'Масло черного тмина обладает сильным антибактериальным действием, а клюква насыщает витаминами. Балансирует жирную кожу.',
    price: 'По запросу',
    sku: 'FO0002-30',
    volume: '30 мл',
    ingredients:
      'Simmondsia Chinenis Jojoba Seed Oil, Vaccinium Macrocarpon Cranberry Seed Oil, Nigella Sativa Black Cumin Seed Oil, Tocopherol',
  },
  {
    title: 'Масло для лица \'Pomegranate & Passionfruit\' (Гранат и Маракуйя)',
    short_description: 'Витаминный коктейль для уставшей кожи.',
    full_description: 'Масло гранатовых косточек — мощный антиоксидант. Возвращает коже упругость и здоровый цвет.',
    price: 'По запросу',
    sku: 'FO0003-30',
    volume: '30 мл',
    ingredients:
      'Simmondsia Chinenis Jojoba Seed Oil, Punica Granatum Pomegranate Seed Oil, Passiflora Edulis Passionfruit Seed Oil, Psidium Guajava Guava Seed Oil, Tocopherol',
  },
  {
    title: 'Масло для лица \'Raspberry & Passionfruit\' (Малина и Маракуйя)',
    short_description: 'Легкое увлажняющее масло с защитой от солнца.',
    full_description:
      'Масло семян малины обладает природным SPF-фактором. Легкая текстура, быстро впитывается, идеально на лето.',
    price: 'По запросу',
    sku: 'FO0004-30',
    volume: '30 мл',
    ingredients:
      'Simmondsia Chinenis Jojoba Seed Oil, Rubus Idaeus Raspberry Seed Oil, Passiflora Edulis Passionfruit Seed Oil, Tocopherol',
  },
  {
    title: 'Масло Моринги (Moringa Oil) 100%',
    short_description: 'Чистое масло моринги холодного отжима.',
    full_description:
      "Универсальное 'чудо-масло'. Глубоко увлажняет, обладает антисептическими свойствами. Подходит для лица, тела и волос.",
    price: 'По запросу',
    sku: 'SI0044-45',
    volume: '45 мл',
    ingredients: 'Moringa Oleifera Moringa Seed Oil 100%',
  },
  {
    title: 'Масло Таману (Tamanu Oil) 100%',
    short_description: 'Чистое заживляющее масло таману.',
    full_description:
      'Традиционное средство полинезийцев. Ускоряет заживление ран, ожогов, акне, рубцов. Имеет специфический ореховый запах.',
    price: 'По запросу',
    sku: 'SI0045-45',
    volume: '45 мл',
    ingredients: 'Calophyllum Inophyllum Tamanu Seed Oil 100%',
  },
  {
    title: 'Масло Арганы (Argan Oil) 100%',
    short_description: 'Жидкое золото Марокко для кожи и волос.',
    full_description: 'Богато витамином Е и жирными кислотами. Питает сухую кожу, восстанавливает блеск волос.',
    price: 'По запросу',
    sku: 'SI0046-45',
    volume: '45 мл',
    ingredients: 'Argania Spinosa Argan Kernel Oil 100%',
  },
  {
    title: 'Очищающее масло для лица \'Tea Tree & Rosehip\'',
    short_description: 'Гидрофильное масло для глубокого очищения.',
    full_description:
      'Растворяет макияж и загрязнения. Чайное дерево борется с воспалениями, шиповник питает. Смывается водой.',
    price: 'По запросу',
    sku: 'FC0001-45',
    volume: '45 мл',
    ingredients: 'Olea Europaea Olive Fruit Oil, Rosa Canina Rosehip Fruit Oil, Tocopherol, Melaleuca Alternifolia Tea Tree Leaf Oil',
  },
  {
    title: 'Очищающее масло для лица \'Black Cumin & Lemon Balm\'',
    short_description: 'Детокс-очищение для жирной кожи.',
    full_description: 'Черный тмин очищает поры, мелисса успокаивает. Регулирует выработку кожного сала.',
    price: 'По запросу',
    sku: 'FC0003-45',
    volume: '45 мл',
    ingredients:
      'Prunus Amygdalus Dulcis Sweet Almond Oil, Ricinus Communis Castor Seed Oil, Nigella Sativa Black Caraway Seed Oil, Melissa Officinalis Lemon Balm Leaf Oil',
  },
  {
    title: 'Очищающий крем \'Rosehip & Cucumber\' (Шиповник и Огурец)',
    short_description: 'Нежное молочко для умывания.',
    full_description: 'Мягкая кремовая текстура. Экстракт огурца освежает, алоэ увлажняет. Не стягивает кожу.',
    price: 'По запросу',
    sku: 'FC0020-90',
    volume: '90 мл',
    ingredients:
      'Aloe Barbadensis Aloe Vera Leaf Juice, Rosa Eglanteria Rose Hip Seed Oil, Coco-Glucoside, Cucumis Sativus Cucumber Fruit Extract, Pelargonium Graveolens Geranium Flower Oil',
  },
  {
    title: 'Очищающий крем \'Ginger & Lemongrass\' (Имбирь и Лемонграсс)',
    short_description: 'Бодрящее очищение для нормальной кожи.',
    full_description: 'Оставляет ощущение свежести и тонуса. Аромат тайского спа.',
    price: 'По запросу',
    sku: 'FC0021-90',
    volume: '90 мл',
    ingredients:
      'Aloe Barbadensis Aloe Vera Leaf Juice, Rosa Eglanteria Rose Hip Seed Oil, Zingiber Cassumunar Plai Root Oil, Cymbopogon Citratus Lemongrass Oil',
  },
  {
    title: 'Розовая цветочная вода (Rose Water)',
    short_description: 'Натуральный гидролат дамасской розы.',
    full_description:
      'Увлажняет, тонизирует, восстанавливает pH-баланс кожи. Идеально для использования перед нанесением масла.',
    price: 'По запросу',
    sku: 'FS0016-50',
    volume: '50 мл',
    ingredients: 'Rosa Damascena Rose Flower Water, Glycerin',
  },
  {
    title: 'Тоник \'Witch Hazel & Tea Tree\'',
    short_description: 'Матирующий тоник для проблемной кожи.',
    full_description: 'Гамамелис сужает поры, чайное дерево предотвращает акне. Не содержит спирта.',
    price: 'По запросу',
    sku: 'FS0018-50',
    volume: '50 мл',
    ingredients: 'Hamamelis Virginiana Witch Hazel Water, Melaleuca Alternifolia Tea Tree Leaf Oil',
  },
  {
    title: 'Скраб для лица \'Sugar & Honey\' (Сахар и Мед)',
    short_description: 'Натуральный эксфолиант для сияния кожи.',
    full_description: 'Кристаллы сахара мягко отшелушивают, мед и масла питают. Кожа становится бархатистой.',
    price: 'По запросу',
    sku: 'FB0002-20',
    volume: '20 г',
    ingredients:
      'Sugar, Honey, Cocos Nucifera Coconut Oil, Simmondsia Chinensis Jojoba Seed Oil, Prunus Amygdalus Dulcis Sweet Almond Oil',
  },
  {
    title: 'Маска для лица \'White Clay\' (Белая глина)',
    short_description: 'Детокс-маска для глубокого очищения пор.',
    full_description: 'Каолин (белая глина) вытягивает загрязнения и токсины. Выравнивает тон кожи.',
    price: 'По запросу',
    sku: 'PB0008-100',
    volume: '100 г',
    ingredients: 'Kaolin White Clay 100%',
  },
  {
    title: 'Сыворотка \'Defy Age\'',
    short_description: 'Интенсивная антивозрастная сыворотка.',
    full_description: 'Концентрированная формула с арганой, морингой и шиповником для борьбы с признаками старения.',
    price: 'По запросу',
    sku: 'GOS0003-20',
    volume: '20 мл',
    ingredients:
      'Argania Spinosa Argan Kernel Oil, Moringa Oleifera Moringa Seed Oil, Rosa Canina Rosehip Fruit Oil, Rosmarinus Officinalis Rosemary Leaf Oil',
  },
  {
    title: 'Гель для душа \'Ginger & Lemongrass\'',
    short_description: 'Энергизирующий гель для душа.',
    full_description: 'Мягкая моющая основа без сульфатов. Яркий аромат имбиря и лемонграсса пробуждает утром.',
    price: 'По запросу',
    sku: 'SP0020-470',
    volume: '470 мл (доступны 100/230 мл)',
    ingredients:
      'Aloe Barbadensis Aloe Vera Leaf juice, Decyl Glucoside, Zingiber Cassumunar Plai Root Oil, Cymbopogon Citratus Lemongrass Oil',
  },
  {
    title: 'Гель для душа \'Lavender & Ylang Ylang\'',
    short_description: 'Расслабляющий гель для душа.',
    full_description: 'Успокаивающий аромат лаванды и иланг-иланга. Идеален для вечернего душа.',
    price: 'По запросу',
    sku: 'SP0021-470',
    volume: '470 мл (доступны 100/230 мл)',
    ingredients:
      'Aloe Barbadensis Aloe Vera Leaf juice, Lavandula Angustifolia Lavender Oil, Cananga Odorata Ylang Ylang Flower Oil',
  },
  {
    title: 'Гель для душа \'Peppermint & Eucalyptus\'',
    short_description: 'Освежающий гель для душа.',
    full_description: 'Холодящий эффект мяты и эвкалипта. Отлично подходит после спорта или в жару.',
    price: 'По запросу',
    sku: 'SP0022-470',
    volume: '470 мл (доступны 100/230 мл)',
    ingredients:
      'Aloe Barbadensis Aloe Vera Leaf juice, Mentha Piperita Peppermint Oil, Rosmarinus Officinalis Rosemary Leaf Oil',
  },
  {
    title: 'Лосьон для тела \'Lavender & Aloe\'',
    short_description: 'Легкий увлажняющий лосьон.',
    full_description: 'Быстро впитывается, не оставляя липкости. Увлажняет и успокаивает кожу.',
    price: 'По запросу',
    sku: 'BL1001-90',
    volume: '90 мл / 220 мл',
    ingredients:
      'Aloe Barbadensis Aloe Vera Leaf Juice, Prunus Amygdalus Dulcis Sweet Almond Oil, Lavandula Angustifolia Lavender Flower Extract',
  },
  {
    title: 'Лосьон для тела \'Ginger & Lemongrass\'',
    short_description: 'Тонизирующий лосьон для тела.',
    full_description: 'Питает кожу и оставляет свежий цитрусовый аромат.',
    price: 'По запросу',
    sku: 'BL1002-90',
    volume: '90 мл / 220 мл',
    ingredients: 'Aloe Barbadensis Aloe Vera Leaf Juice, Prunus Amygdalus Dulcis Sweet Almond Oil, Zingiber Cassumunar Plai Root Oil',
  },
  {
    title: 'Шампунь \'Ginger & Lemongrass\'',
    short_description: 'Шампунь для блеска и силы волос.',
    full_description: 'Натуральная формула без SLS. Подходит для всех типов волос.',
    price: 'По запросу',
    sku: 'SH0001-470',
    volume: '470 мл (доступны 100/230 мл)',
    ingredients:
      'Aloe Barbadensis Aloe Vera Leaf juice, Hydrolyzed Wheat Protein, Zingiber Cassumunar Plai Root Oil, Cymbopogon Flexuosus Lemongrass Oil',
  },
  {
    title: 'Шампунь \'Lavender & Ylang Ylang\'',
    short_description: 'Мягкий шампунь для нормальных волос.',
    full_description: 'Деликатно очищает, придает волосам мягкость и приятный аромат.',
    price: 'По запросу',
    sku: 'SH0002-470',
    volume: '470 мл (доступны 100/230 мл)',
    ingredients:
      'Aloe Barbadensis Aloe Vera Leaf juice, Lavandula Angustifolia Lavender Oil, Cananga Odorata Ylang Ylang Flower Oil',
  },
  {
    title: 'Кондиционер для волос \'Ginger & Lemongrass\'',
    short_description: 'Питательный кондиционер.',
    full_description: 'Облегчает расчесывание, предотвращает сечение кончиков.',
    price: 'По запросу',
    sku: 'HT0001-420',
    volume: '420 мл (доступны 90/220 мл)',
    ingredients:
      'Aloe Barbadensis Aloe Vera Leaf juice, Cetyl Alcohol, Macadamia Integrifolia Seed Oil, Zingiber Cassumunar Plai Root Oil',
  },
  {
    title: 'Мыло ручной работы \'Ginger & Tea Tree\'',
    short_description: 'Антибактериальное натуральное мыло.',
    full_description: 'Отлично очищает, подходит для спины и декольте, склонных к высыпаниям.',
    price: 'По запросу',
    sku: 'SP0003-25',
    volume: '25 г / 50 г / 100 г',
    ingredients:
      'Cocos Nucifera Coconut Oil, Zingiber Officinale Ginger Root Oil, Melaleuca Alternifolia Tea Tree Leaf Oil',
  },
  {
    title: 'Мыло ручной работы \'Lemongrass & Cedarwood\'',
    short_description: 'Мужское мыло с древесным ароматом.',
    full_description: 'Глубокое очищение с терпким ароматом кедра и лемонграсса.',
    price: 'По запросу',
    sku: 'SP0014-50',
    volume: '50 г / 100 г',
    ingredients:
      'Cocos Nucifera L. Coconut Oil, Cymbopogon Flexuosus Lemongrass Oil, Cedrus Atlantica Cedarwood Bark Oil',
  },
  {
    title: 'Бальзам для тела \'Shea & Coconut\'',
    short_description: 'SOS-средство для сухой кожи.',
    full_description: 'Густой баттер на основе масла ши и кокоса. Спасает обветренные губы, локти, пятки.',
    price: 'По запросу',
    sku: 'BA1001-12',
    volume: '12 г (доступно 100г)',
    ingredients: 'Butyrospermum Parkii Shea Butter, Cocos Nucifera Coconut Oil, Beeswax, Honey',
  },
  {
    title: 'Бальзам \'Muscle Balm\' (Pain Relief)',
    short_description: 'Разогревающий бальзам для мышц.',
    full_description: 'С гвоздикой и корицей. Помогает снять напряжение после спорта или при болях в спине.',
    price: 'По запросу',
    sku: 'BA0002-25',
    volume: '25 г',
    ingredients:
      'Butyrospermum Parkii Shea Butter, Eugenia Caryophyllus Clove Leaf Oil, Mentha Piperita Peppermint Oil, Cinnamomum Zeylanicum Cinnamon Bark Extract',
  },
  {
    title: 'Твердые духи (Solid Perfume) \'Jasmine\'',
    short_description: 'Натуральные духи с абсолютом жасмина.',
    full_description: 'Бесспиртовые духи на восковой основе. Удобный формат для сумочки. Чувственный цветочный аромат.',
    price: 'По запросу',
    sku: 'PE1003-12',
    volume: '12 г',
    ingredients: 'Butyrospermum Parkii Shea Butter, Beeswax, Jasminum Sambac Jasmine Flower Extract',
  },
  {
    title: 'Твердые духи (Solid Perfume) \'Lavender & Bergamot\'',
    short_description: 'Расслабляющий аромат.',
    full_description: 'Нежный и спокойный аромат для гармонии в течение дня.',
    price: 'По запросу',
    sku: 'PE1001-12',
    volume: '12 г',
    ingredients:
      'Butyrospermum Parkii Shea Butter, Beeswax, Lavandula Angustifolia Lavender Oil, Citrus Aurantium Bergamia Bergamot Fruit Oil',
  },
  {
    title: 'Арома-роллер \'Revive\' (Eucalyptus & Peppermint)',
    short_description: 'Роллер для ясности ума.',
    full_description: 'Наносите на виски или запястья для концентрации внимания и снятия головной боли.',
    price: 'По запросу',
    sku: 'R001-5',
    volume: '5 мл',
    ingredients: 'Simmondsia Chinensis Jojoba Seed Oil, Eucalyptus Globulus Eucalyptus Leaf Oil, Mentha Piperita Peppermint Oil',
  },
  {
    title: 'Арома-роллер \'Relax\' (Lavender & Bergamot)',
    short_description: 'Роллер-антистресс.',
    full_description: 'Помогает успокоиться и уснуть. Идеально для использования перед сном.',
    price: 'По запросу',
    sku: 'R003-5',
    volume: '5 мл',
    ingredients: 'Simmondsia Chinensis Jojoba Seed Oil, Lavandula Angustifolia Lavender Oil, Citrus Aurantium Bergamia Bergamot Fruit Oil',
  },
];

