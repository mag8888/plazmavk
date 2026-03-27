import { prisma } from '../lib/prisma.js';

export interface BotContentData {
  key: string;
  title: string;
  content: string;
  description?: string | null;
  category?: string | null;
  language?: string;
  isActive?: boolean;
}

/**
 * Получить контент бота по ключу
 */
export async function getBotContent(key: string, language: string = 'ru'): Promise<string | null> {
  try {
    const content = await prisma.botContent.findFirst({
      where: {
        key,
        language,
        isActive: true,
      },
      select: {
        content: true,
      },
    });

    return content?.content || null;
  } catch (error) {
    console.error('Error getting bot content:', error);
    return null;
  }
}

/**
 * Получить все контенты бота
 */
export async function getAllBotContents(): Promise<BotContentData[]> {
  try {
    const contents = await prisma.botContent.findMany({
      orderBy: [
        { category: 'asc' },
        { key: 'asc' },
      ],
    });

    return contents;
  } catch (error) {
    console.error('Error getting all bot contents:', error);
    return [];
  }
}

/**
 * Создать или обновить контент бота
 */
export async function upsertBotContent(data: BotContentData): Promise<BotContentData | null> {
  try {
    // REFACTOR: Explicit check to avoid "Replica Set" transaction requirement
    let content = await prisma.botContent.findUnique({
      where: { key: data.key },
    });

    if (content) {
      content = await prisma.botContent.update({
        where: { key: data.key },
        data: {
          title: data.title,
          content: data.content,
          description: data.description,
          category: data.category,
          language: data.language || 'ru',
          isActive: data.isActive !== undefined ? data.isActive : true,
          updatedAt: new Date(),
        },
      });
    } else {
      content = await prisma.botContent.create({
        data: {
          key: data.key,
          title: data.title,
          content: data.content,
          description: data.description,
          category: data.category,
          language: data.language || 'ru',
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });
    }

    return content;
  } catch (error) {
    console.error('Error upserting bot content:', error);
    return null;
  }
}

/**
 * Удалить контент бота
 */
export async function deleteBotContent(key: string): Promise<boolean> {
  try {
    await prisma.botContent.delete({
      where: { key },
    });
    return true;
  } catch (error) {
    console.error('Error deleting bot content:', error);
    return false;
  }
}

/**
 * Инициализировать базовый контент бота
 */
export async function initializeBotContent(): Promise<void> {
  try {
    const defaultContents: BotContentData[] = [
      {
        key: 'welcome_message',
        title: 'Приветственное сообщение',
        content: '👋 Добро пожаловать в эру будущего! \n\n💧 Plazma Water — это сообщество энергичных и осознанных людей. Мы используем инновационные технологии, чтобы восстанавливать и очищать организм на всех уровнях.\n\n🛍️ Выберите товары в каталоге или узнайте больше о партнёрской программе!',
        description: 'Сообщение, которое показывается при команде /start',
        category: 'messages',
        language: 'ru',
        isActive: true,
      },
      {
        key: 'about_text',
        title: 'О проекте',
        content: '🌟 PLAZMA — структурированная вода для здоровья!\n\n💧 Наша вода проходит специальную обработку:\n• Улучшает структуру молекул воды\n• Повышает биологическую активность\n• Способствует лучшему усвоению организмом\n\n• Усиление иммунитета\n• Улучшение обмена веществ\n• Повышение энергии и жизненного тонуса\n• Антиоксидантные свойства\n\n🌱 Экологически чистая технология без химических добавок!\n\n⚠️ Не является лекарственным средством.',
        description: 'Текст о проекте PLAZMA',
        category: 'descriptions',
        language: 'ru',
        isActive: true,
      },
      {
        key: 'partner_intro',
        title: 'Введение в партнёрскую программу',
        content: '👋 Станьте партнёром PLAZMA!\n\nВы можете рекомендовать друзьям здоровье и получать пассивный доход.\n\n💸 15% от каждой покупки по вашей ссылке.\n\n+5% от покупок второй и 5% третьей линии\n\n🔗 Достаточно поделиться своей персональной ссылкой.',
        description: 'Вводный текст партнёрской программы',
        category: 'messages',
        language: 'ru',
        isActive: true,
      },
      {
        key: 'direct_plan_text',
        title: 'Прямая комиссия 15%',
        content: 'Прямая комиссия — 15%\nДелитесь ссылкой → получаете 15% от всех покупок друзей.\n\n🔑 Условия активации:\n• Совершите покупку на 12 000 ₽\n• Программа активируется на 2 месяца\n• Для продления — снова купить на 12 000 ₽ в течение 2 месяцев\n\n📲 Выбирайте удобный формат и начинайте зарабатывать уже сегодня!',
        description: 'Описание прямой комиссии',
        category: 'descriptions',
        language: 'ru',
        isActive: true,
      },
      {
        key: 'multi_plan_text',
        title: 'Многоуровневая система',
        content: 'Многоуровневая система — 15% + 5% + 5%\n• 15% с покупок ваших друзей (1-й уровень)\n• 5% с покупок их друзей (2-й уровень)\n• 5% с покупок следующего уровня (3-й уровень)\n\n💡 Условия бонуса:\n• Ваш бонус 10%\n• Бонус 15%+5%+5% начнет действовать при Вашей активности 120PZ в месяц\n\n📲 Выбирайте удобный формат и начинайте зарабатывать уже сегодня!',
        description: 'Описание многоуровневой системы',
        category: 'descriptions',
        language: 'ru',
        isActive: true,
      },
      {
        key: 'support_message',
        title: 'Сообщение поддержки',
        content: '🆘 Поддержка PLAZMA\n\n📞 Свяжитесь с нами в этом чате или по контактам с сайта.\n\n⏰ Мы ответим как можно быстрее.\n\n💬 Мы всегда готовы помочь!',
        description: 'Информация о поддержке',
        category: 'messages',
        language: 'ru',
        isActive: true,
      },
      {
        key: 'cart_empty_message',
        title: 'Корзина пуста',
        content: '🛒 Ваша корзина пуста\n\nДобавьте товары из каталога, чтобы оформить заказ!',
        description: 'Сообщение когда корзина пуста',
        category: 'messages',
        language: 'ru',
        isActive: true,
      },
      {
        key: 'order_success_message',
        title: 'Заказ успешно создан',
        content: '✅ Заказ отправлен! Мы свяжемся с вами в ближайшее время.\n\n📞 Для быстрой связи поделитесь своим номером телефона:',
        description: 'Сообщение об успешном создании заказа',
        category: 'messages',
        language: 'ru',
        isActive: true,
      },
    ];

    for (const content of defaultContents) {
      await upsertBotContent(content);
    }

    console.log('✅ Bot content initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing bot content:', error);
  }
}
