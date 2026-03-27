import { Telegraf, Markup } from 'telegraf';
import { Context } from '../../bot/context.js';
import { BotModule } from '../../bot/types.js';
import { logUserAction, ensureUser, checkUserContact, handlePhoneNumber } from '../../services/user-history.js';
import { upsertPartnerReferral, recordPartnerTransaction, getOrCreatePartnerProfile, buildReferralLink } from '../../services/partner-service.js';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

const greeting = `👋 Добро пожаловать!
PLAZMA — структурированная вода для здоровья и энергии.
💧 Вода — источник жизни. Мы доставляем воду с улучшенной структурой.
⚡ Поддержка иммунитета, тонус и естественная гармония организма.

Хотите узнать больше? 👇`;

/** Текст под фото приветствия (экран «эра будущего») */
/** Текст под фото приветствия (экран «эра будущего») */
const WELCOME_PHOTO_CAPTION = `Добро пожаловать в эру будущего!

💧Plazma Water — это сообщество энергичных и осознанных людей. Мы используем инновационные технологии, чтобы восстанавливать и очищать организм на всех уровнях: от физического до энергетического.

🌀Zero Point Energy. Наша технология начинается там, где заканчивается привычная химия. Это новая физика воды, основанная на энергии нулевой точки.

🙌🏼 Мы приглашаем тех, кто выбирает свой путь, берет ответственность за свое состояние и вдохновляет других.`;

const introDetails = `💧 Что такое PLAZMA?
Структурированная вода — источник жизни ⚡️

✨ PLAZMA — это вода, прошедшая специальную обработку для улучшения структуры.
Правильная структура воды способствует лучшему усвоению, энергии и восстановлению организма 🧬

🚀 Наша технология:
• Улучшение структуры молекул воды
• Повышение биологической активности
• Без химических добавок

💎 Преимущества:
• Экологически чистая технология
• Поддержка иммунитета и обмена веществ
• Антиоксидантные свойства
• Повышение энергии и жизненного тонуса

💠 Результат:
Лёгкость, энергия и естественное восстановление 🌿

⚠️ Не является лекарственным средством.`;

type MenuStats = Partial<Record<'shop' | 'cart' | 'reviews', string>>;

type UiMode = 'classic' | 'app';

type NavigationItem = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  badgeKey?: keyof MenuStats;
  defaultBadge?: string;
  handler: (ctx: Context) => Promise<void>;
};

const NAVIGATION_ACTION_PREFIX = 'nav:menu:';
const SWITCH_TO_CLASSIC_ACTION = 'nav:mode:classic';
const DEFAULT_UI_MODE: UiMode = 'app';
const WELCOME_VIDEO_URL = 'https://res.cloudinary.com/dcldvbjvf/video/upload/v1759337188/%D0%9F%D0%9E%D0%A7%D0%95%D0%9C%D0%A3_%D0%91%D0%90%D0%94%D0%AB_%D0%BD%D0%B5_%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%B0%D1%8E%D1%82_%D0%95%D1%81%D1%82%D1%8C_%D1%80%D0%B5%D1%88%D0%B5%D0%BD%D0%B8%D0%B5_gz54oh.mp4';
const DEFAULT_WEBAPP_SUFFIX = '/webapp';

function getWebappUrl(): string {
  const baseUrl = env.webappUrl || env.publicBaseUrl || 'https://vital-production-82b0.up.railway.app';
  if (baseUrl.includes(DEFAULT_WEBAPP_SUFFIX)) {
    return baseUrl;
  }
  return `${baseUrl.replace(/\/$/, '')}${DEFAULT_WEBAPP_SUFFIX}`;
}

function getWelcomePhotoUrl(): string {
  // webapp is mounted at /webapp, and it serves static from webapp/
  // so /webapp/static/images/welcome-future.jpg should work
  const base = (env.publicBaseUrl || env.webappUrl || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/webapp/static/images/welcome-future.jpg`;
}

/** Кнопки приветствия (общие для фото и fallback-текста) */
function getWelcomeReplyMarkup() {
  const webappUrl = getWebappUrl();
  return {
    inline_keyboard: [
      [{ text: '🎁 Подарок', callback_data: 'nav:gift' }],
      [Markup.button.webApp('🛒 Магазин', webappUrl)],
      [{ text: '🔗 Ваша реф ссылка', callback_data: 'nav:my_ref_link' }],
      [{ text: '🌐 Сайт', url: 'https://iplazma.com' }],
      [{ text: '📢 Телеграм канал', url: 'https://t.me/iplasmanano' }],
    ],
  };
}

/** Приветствие с фото PLAZMA, подпись и кнопки: Подарок, Открыть каталог, Ваша реф ссылка */
async function sendWelcomeWithPhoto(ctx: Context, options?: { referralInviterName?: string }) {
  const caption = options?.referralInviterName
    ? `🎉 Вас пригласил ${options.referralInviterName}\n\n${WELCOME_PHOTO_CAPTION}`
    : WELCOME_PHOTO_CAPTION;

  // 1. Send photo with INLINE buttons (Gift, Shop, Ref Link)
  const inlineMarkup = getWelcomeReplyMarkup();

  try {
    await ctx.replyWithPhoto(
      { url: getWelcomePhotoUrl() },
      { caption, parse_mode: 'HTML', reply_markup: inlineMarkup }
    );
  } catch (err: any) {
    console.warn('⚠️ Welcome photo failed, sending text fallback:', err?.message || err);
    await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: inlineMarkup });
  }

  // 2. Ensure Main Keyboard (persistent menu) is set
  await ctx.reply('👇 Меню', mainKeyboard(getWebappUrl()));
}

async function showSupport(ctx: Context) {
  await ctx.reply(
    '💬 Служба поддержки\n\nНапишите свой вопрос прямо в этот чат — команда PLAZMA ответит как можно быстрее.\n\nЕсли нужен срочный контакт, оставьте номер телефона, и мы перезвоним.'
  );
}

async function handleSupportMessage(ctx: Context) {
  const user = await ensureUser(ctx);
  if (!user) return;

  const messageText = (ctx.message as any)?.text;
  if (!messageText) return;

  // Skip if it's a command
  if (messageText.startsWith('/')) return;

  // Skip if it's a button press (common button texts)
  const buttonTexts = ['🛒 Магазин', '💰 Партнёрка', '⭐ Отзывы', 'ℹ️ О нас', 'Меню', 'Главное меню', 'Назад'];
  if (buttonTexts.includes(messageText)) return;

  // Log the support message attempt
  await logUserAction(ctx, 'support:message_sent_autoreply', { messageLength: messageText.length });

  // Send auto-reply instead of forwarding to admin
  await ctx.reply(
    `Доброго времени 🙌🏼\n\n` +
    `Для заказа плазмы выберите вкладку магазин в боте или на нашем сайте iplazma.com\n\n` +
    `Или вы можете написать нашему менеджеру для консультации @Aurelia_8888`,
    { link_preview_options: { is_disabled: true } }
  );
}

/** Текст подарка и кнопки: Слушать звуковые матрицы + Каталог (как в Plazma Water Bot) */
async function showGiftMessage(ctx: Context) {
  const giftMessage = `🔥 Для Вас уникальный материал.

Аудиофайлы записанные методом Гаряева были списаны с реакторов конкретной плазмы.

Слушая файлы вы можете получить весь спектр воздействия. 👇`;

  const webappUrl = getWebappUrl();
  await ctx.reply(giftMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎶 Слушать звуковые матрицы', callback_data: 'nav:gift_audio' }],
        [{ text: '📚 Гайд плазменное здоровье', url: 'https://t.me/iplasmanano/584' }],
      ],
    },
  });
}

/** Описание перед списком аудио (звуковые матрицы Гаряева) */
const GIFT_AUDIO_INTRO = `🎶 Звуковые матрицы с реакторов плазмы по методу Гаряева. Слушаем и исцеляемся.

Перед прослушиванием задать намерение на исцеление, можно точечно. Это чистые звуковые матрицы без обработки и наложения фоновой музыки. Можно слушать как в наушниках, так и фоном.`;

const navigationItems: NavigationItem[] = [
  {
    id: 'shop',
    title: 'Магазин',
    emoji: '🛒',
    description: 'Каталог продукции и сезонные наборы',
    badgeKey: 'shop',
    handler: async (ctx) => {
      // Сразу открываем webapp
      await ctx.answerCbQuery();
      const webappUrl = getWebappUrl();
      await ctx.reply(
        '🛒 <b>Открываю магазин...</b>',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🚀 Открыть магазин',
                  web_app: { url: webappUrl }
                }
              ]
            ]
          }
        }
      );
    },
  },
  {
    id: 'partner',
    title: 'Партнёрка',
    emoji: '🤝',
    description: 'Реферальные бонусы и личный кабинет',
    handler: async (ctx) => {
      const { showPartnerIntro } = await import('../partner/index.js');
      await showPartnerIntro(ctx);
    },
  },
  {
    id: 'reviews',
    title: 'Отзывы',
    emoji: '⭐',
    description: 'Истории сообщества и результаты клиентов',
    badgeKey: 'reviews',
    handler: async (ctx) => {
      const { showReviews } = await import('../reviews/index.js');
      await showReviews(ctx);
    },
  },
  {
    id: 'about',
    title: 'О нас',
    emoji: 'ℹ️',
    description: 'Информация о Plazma Water и соцсети',
    handler: async (ctx) => {
      const { showAbout } = await import('../about/index.js');
      await showAbout(ctx);
    },
  },
  {
    id: 'support',
    title: 'Поддержка',
    emoji: '💬',
    description: 'Ответим на вопросы и поможем с заказом',
    defaultBadge: '24/7',
    handler: showSupport,
  },
];

function getUiMode(ctx: Context): UiMode {
  const mode = ctx.session?.uiMode;
  if (mode === 'app' || mode === 'classic') {
    return mode;
  }

  ctx.session.uiMode = DEFAULT_UI_MODE;
  return DEFAULT_UI_MODE;
}

function setUiMode(ctx: Context, mode: UiMode) {
  ctx.session.uiMode = mode;
}

async function sendWelcomeVideo(ctx: Context) {
  await ctx.reply('✨ PLAZMA — вода, источник жизни.', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🎥 Смотреть видео',
            url: WELCOME_VIDEO_URL,
          },
        ],
        [
          {
            text: '📖 Подробнее',
            callback_data: 'nav:more',
          },
        ],
        [
          {
            text: '🎁 Подарок',
            callback_data: 'nav:gift',
          },
        ],
      ],
    },
  });
}

async function sendClassicHome(ctx: Context) {
  await ctx.reply(greeting, mainKeyboard(getWebappUrl()));
}

async function sendAppHome(
  ctx: Context,
  options: { introText?: string; includeGreeting?: boolean } = {}
) {
  const { introText, includeGreeting = true } = options;

  let text = greeting;
  if (introText) text = introText;
  else if (!includeGreeting) text = 'Каталог';
  await ctx.reply(text, mainKeyboard(getWebappUrl()));
}

async function renderHome(ctx: Context) {
  if (getUiMode(ctx) === 'app') {
    await sendAppHome(ctx);
  } else {
    await sendClassicHome(ctx);
  }
}


async function exitAppInterface(ctx: Context) {
  setUiMode(ctx, 'classic');
  await sendClassicHome(ctx);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function getBadge(stats: MenuStats, item: NavigationItem) {
  if (item.badgeKey) {
    const value = stats[item.badgeKey];
    if (value) {
      return value;
    }
  }
  return item.defaultBadge;
}

function buildNavigationKeyboard(stats: MenuStats) {
  const buttons = navigationItems.map((item) => {
    const badge = getBadge(stats, item);
    const label = `${item.emoji} ${item.title}${badge ? ` • ${badge}` : ''}`;
    return Markup.button.callback(label, `${NAVIGATION_ACTION_PREFIX}${item.id}`);
  });

  const rows = chunkArray(buttons, 2);
  rows.push([Markup.button.callback('⌨️ Классический режим', SWITCH_TO_CLASSIC_ACTION)]);

  return Markup.inlineKeyboard(rows);
}

function formatMenuMessage(stats: MenuStats) {
  const header = '🧭 <b>Навигация и сервисы</b>\n[ 🔍 Поиск по разделам ]';

  const body = navigationItems
    .map((item) => {
      const badge = getBadge(stats, item);
      const lines = [`• <b>${item.emoji} ${item.title}</b>${badge ? ` <code>${badge}</code>` : ''}`, `  ${item.description}`];
      return lines.join('\n');
    })
    .join('\n\n');

  const footer = '👇 Нажмите на карточку, чтобы перейти в нужный раздел.';

  return `${header}\n\n${body}\n\n${footer}`;
}

async function collectMenuStats(ctx: Context): Promise<MenuStats> {
  const stats: MenuStats = {};

  try {
    const [{ getActiveCategories }, { getActiveReviews }] = await Promise.all([
      import('../../services/shop-service.js'),
      import('../../services/review-service.js'),
    ]);

    const [categories, reviews] = await Promise.all([
      getActiveCategories().catch(() => []),
      getActiveReviews().catch(() => []),
    ]);

    if (categories.length > 0) {
      stats.shop = String(categories.length);
    }

    if (reviews.length > 0) {
      stats.reviews = String(reviews.length);
    }
  } catch (error) {
    console.warn('🧭 Navigation: Failed to collect shared stats', error);
  }

  const userId = ctx.from?.id?.toString();
  if (userId) {
    try {
      const user = await ensureUser(ctx);
      if (user) {
        const { getCartItems } = await import('../../services/cart-service.js');
        const cartItems = await getCartItems(user.id);
        const totalQuantity = cartItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
        if (totalQuantity > 0) {
          stats.cart = String(totalQuantity);
        }
      }
    } catch (error) {
      console.warn('🧭 Navigation: Failed to collect cart stats', error);
    }
  }

  return stats;
}

async function sendNavigationMenu(ctx: Context) {
  const stats = await collectMenuStats(ctx);
  const message = formatMenuMessage(stats);
  const keyboard = buildNavigationKeyboard(stats);

  await ctx.reply(message, {
    parse_mode: 'HTML',
    ...keyboard,
  });
}

export function mainKeyboard(webappUrl: string) {
  return Markup.keyboard([
    [Markup.button.webApp('Магазин', webappUrl)],
  ]).resize();
}

export const navigationModule: BotModule = {
  async register(bot: Telegraf<Context>) {
    // Handle help command
    bot.command('help', async (ctx) => {
      await logUserAction(ctx, 'command:help');
      await ctx.reply(
        '🆘 <b>Справка по боту</b>\n\n' +
        'Доступные команды:\n' +
        '/start - Запустить бота и открыть главное меню\n' +
        '/help - Показать эту справку\n' +
        '/shop - Открыть магазин товаров\n' +
        '/partner - Партнерская программа\n' +
        '/reviews - Отзывы клиентов\n' +
        '/about - О нас\n' +
        '/add_balance - Пополнить баланс через Lava\n' +
        '/support - Поддержка 24/7\n' +
        '/app - Открыть веб-приложение\n\n' +
        'Или используйте кнопки меню для навигации!',
        { parse_mode: 'HTML' }
      );
    });

    // Handle support command
    bot.command('support', async (ctx) => {
      await logUserAction(ctx, 'command:support');
      await showSupport(ctx);
    });

    // Handle app command - open webapp directly
    bot.command('app', async (ctx) => {
      await logUserAction(ctx, 'command:app');

      await ctx.reply('Магазин', Markup.removeKeyboard());
    });

    bot.start(async (ctx) => {
      await logUserAction(ctx, 'command:start');

      // Сначала всегда отправляем приветствие (фото + кнопки), чтобы /start хоть что-то выводил
      const startPayload = ctx.startPayload;
      console.log('🔗 Referral: startPayload =', startPayload);

      // Handle new format: username (simple referral link)
      if (startPayload && !startPayload.startsWith('ref_direct_') && !startPayload.startsWith('ref_multi_')) {

        // Handle Product Deep Link: start=prod_UUID
        if (startPayload.startsWith('prod_')) {
          const productId = startPayload.replace('prod_', '');
          console.log('🛒 Deep link to product:', productId);

          await ensureUser(ctx); // Ensure user exists before trying to buy
          const { handleBuy } = await import('../shop/index.js');
          await handleBuy(ctx, productId);
          return; // Stop further referral processing if this is a product link
        }

        // Handle Gift Certificate Deep Link: start=gift_CODE
        if (startPayload.startsWith('gift_')) {
          const certCode = startPayload.replace('gift_', '');
          console.log('🎁 Deep link to gift certificate:', certCode);

          const user = await ensureUser(ctx);
          if (!user) return;

          try {
            const { prisma } = await import('../../lib/prisma.js');
            const cert = await prisma.giftCertificate.findFirst({
              where: {
                OR: [{ giftToken: certCode }, { code: certCode }],
                status: { in: ['ACTIVE', 'GIFTED'] }
              }
            });

            if (!cert) {
              await ctx.reply('❌ Сертификат не найден или уже использован.');
              return;
            }

            if (cert.userId === user.id && cert.status === 'ACTIVE') {
              // Owner is clicking their own cert link
              const amountRub = Math.round(Number(cert.initialPz) * 100);
              await ctx.reply(
                `🎁 Это ваш собственный сертификат!\n\n` +
                `Номинал: <b>${amountRub.toLocaleString('ru-RU')} ₽</b>\n` +
                `Код: <code>${cert.code}</code>\n\n` +
                `Перешлите ссылку другу, чтобы подарить его!`,
                { parse_mode: 'HTML' }
              );
              return;
            }

            // Activate for this user
            await prisma.giftCertificate.update({
              where: { id: cert.id },
              data: { status: 'ACTIVE', giftToken: null, userId: user.id }
            });

            const amountRub = Math.round(Number(cert.initialPz) * 100);
            await ctx.reply(
              `🎉 <b>Сертификат активирован!</b>\n\n` +
              `Номинал: <b>${amountRub.toLocaleString('ru-RU')} ₽</b>\n` +
              `Код: <code>${cert.code}</code>\n\n` +
              `Сертификат зачислен на ваш аккаунт. Используйте его при оформлении заказа!`,
              { parse_mode: 'HTML' }
            );
            return;
          } catch (e) {
            console.error('Gift cert deep link error:', e);
            await ctx.reply('❌ Ошибка активации сертификата. Попробуйте позже.');
            return;
          }
        }

        // Handle B2B Partner Certificate Deep Link: start=b2b_CODE
        if (startPayload.startsWith('b2b_')) {
          const linkCode = startPayload.replace('b2b_', '');
          console.log('🏢 B2B deep link, code:', linkCode);

          try {
            const { prisma } = await import('../../lib/prisma.js');
            const p: any = prisma as any;

            const partner = await p.b2BPartner.findUnique({ where: { linkCode } });

            if (!partner || !partner.isActive) {
              await ctx.reply('❌ Ссылка недействительна или партнёр деактивирован.');
              await sendWelcomeWithPhoto(ctx);
              return;
            }

            // Check limit
            if (partner.maxCertificates > 0 && partner.issuedCount >= partner.maxCertificates) {
              await ctx.reply('😔 К сожалению, эти сертификаты закончились.');
              await sendWelcomeWithPhoto(ctx);
              return;
            }

            // Ensure user
            const user = await ensureUser(ctx);
            if (!user) return;

            // Check if user already received a certificate from this partner
            const existing = await p.b2BCertificateIssue.findUnique({
              where: { partnerId_userId: { partnerId: partner.id, userId: user.id } }
            });
            if (existing) {
              await ctx.reply('ℹ️ Вы уже получили сертификат от этого партнёра.');
              await sendWelcomeWithPhoto(ctx);
              return;
            }

            // Issue certificate in a transaction
            const valuePz = partner.certificateValueRub / 100;
            const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            const genCertCode = () => {
              const part = (n: number) => Array.from({ length: n }, () => codeAlphabet[Math.floor(Math.random() * codeAlphabet.length)]).join('');
              return `B2B-${part(4)}-${part(4)}`;
            };

            let certCode = '';
            let certId = '';

            // Retry loop for unique code
            for (let attempt = 0; attempt < 6; attempt++) {
              const code = genCertCode();
              try {
                const result = await prisma.$transaction(async (tx: any) => {
                  // Re-check limit inside transaction
                  const freshPartner = await tx.b2BPartner.findUnique({ where: { id: partner.id } });
                  if (!freshPartner || !freshPartner.isActive) throw new Error('PARTNER_INACTIVE');
                  if (freshPartner.maxCertificates > 0 && freshPartner.issuedCount >= freshPartner.maxCertificates) throw new Error('LIMIT_REACHED');

                  // Create certificate
                  const cert = await tx.giftCertificate.create({
                    data: {
                      code,
                      userId: user.id,
                      initialPz: valuePz,
                      remainingPz: valuePz,
                      status: 'ACTIVE',
                    }
                  });

                  // Record issue
                  await tx.b2BCertificateIssue.create({
                    data: {
                      partnerId: partner.id,
                      userId: user.id,
                      certificateId: cert.id,
                    }
                  });

                  // Increment issued count
                  await tx.b2BPartner.update({
                    where: { id: partner.id },
                    data: { issuedCount: { increment: 1 } }
                  });

                  return cert;
                });

                certCode = result.code;
                certId = result.id;
                break;
              } catch (e: any) {
                if (e?.message === 'PARTNER_INACTIVE') {
                  await ctx.reply('❌ Ссылка недействительна или партнёр деактивирован.');
                  await sendWelcomeWithPhoto(ctx);
                  return;
                }
                if (e?.message === 'LIMIT_REACHED') {
                  await ctx.reply('😔 К сожалению, эти сертификаты закончились.');
                  await sendWelcomeWithPhoto(ctx);
                  return;
                }
                if (e?.code === 'P2002') continue; // unique violation on code, retry
                throw e;
              }
            }

            if (!certCode) {
              await ctx.reply('❌ Ошибка выдачи сертификата. Попробуйте позже.');
              return;
            }

            const amountRub = partner.certificateValueRub;
            await ctx.reply(
              `🎉 <b>Сертификат получен!</b>\n\n` +
              `🏢 Партнёр: <b>${partner.name}</b>\n` +
              `💰 Номинал: <b>${amountRub.toLocaleString('ru-RU')} ₽</b>\n` +
              `🔑 Код: <code>${certCode}</code>\n\n` +
              `Сертификат зачислен на ваш аккаунт. Используйте его при оформлении заказа!`,
              { parse_mode: 'HTML' }
            );

            await logUserAction(ctx, 'b2b:certificate_issued', {
              partnerId: partner.id,
              partnerName: partner.name,
              certificateCode: certCode,
              amountRub,
            });

            await sendWelcomeWithPhoto(ctx);
            return;
          } catch (e) {
            console.error('B2B cert deep link error:', e);
            await ctx.reply('❌ Ошибка получения сертификата. Попробуйте позже.');
            return;
          }
        }

        // Try to find user by username
        try {
          const { prisma } = await import('../../lib/prisma.js');

          // Check if user already existed before ensuring
          let existingUserBeforeEnsure: { id: string } | null = null;
          if (ctx.from?.id) {
            try {
              existingUserBeforeEnsure = await prisma.user.findUnique({
                where: { telegramId: ctx.from.id.toString() },
                select: { id: true }
              });
            } catch (error: any) {
              // Silent fail for DB errors
              if (error?.code === 'P1013' || error?.message?.includes('Authentication failed')) {
                existingUserBeforeEnsure = null;
              }
            }
          }

          const referrerUser = await prisma.user.findFirst({
            where: {
              username: startPayload,
            },
            include: { partner: true }
          });

          if (referrerUser) {
            console.log('🔗 Referral: Found user by username:', referrerUser.username);

            // Ensure current user exists first
            const user = await ensureUser(ctx);
            if (!user) {
              console.log('🔗 Referral: Failed to ensure user');
              return;
            }

            const isNewUser = !existingUserBeforeEnsure;
            console.log('🔗 Referral: Is new user:', isNewUser);

            // Process referral - create partner profile if it doesn't exist
            let partnerProfile = referrerUser.partner;
            if (!partnerProfile) {
              console.log('🔗 Referral: Partner profile not found, creating one for referrer');
              const { getOrCreatePartnerProfile } = await import('../../services/partner-service.js');
              partnerProfile = await getOrCreatePartnerProfile(referrerUser.id, 'DIRECT');
              console.log('🔗 Referral: Partner profile created:', partnerProfile.id);
            }

            // Create referral record
            if (partnerProfile) {
              const referralLevel = 1;
              const programType = partnerProfile.programType || 'DIRECT';
              await upsertPartnerReferral(partnerProfile.id, referralLevel, user.id, undefined, programType as 'DIRECT' | 'MULTI_LEVEL');
              console.log('🔗 Referral: Referral record created via username');
            }

            // Award 3 PZ bonus for new user registration via referral link
            if (isNewUser) {
              try {
                // Check if bonus was already awarded for this referral (using partnerProfile from above)
                let existingBonus = null;
                if (partnerProfile) {
                  existingBonus = await prisma.partnerTransaction.findFirst({
                    where: {
                      profileId: partnerProfile.id,
                      OR: [
                        { description: { contains: `Бонус 3PZ за приглашение нового пользователя (${user.id})` } },
                        { description: { contains: `Бонус за приглашение друга (${user.id})` } }
                      ]
                    }
                  });
                }

                if (!existingBonus) {
                  // Award 3PZ bonus to inviter for new user registration
                  console.log('🔗 Referral: Awarding 3PZ bonus to inviter for new user registration');

                  let updatedReferrer;

                  // Use partner profile (created above if didn't exist)
                  if (partnerProfile) {
                    await recordPartnerTransaction(
                      partnerProfile.id,
                      3,
                      `Бонус 3PZ за приглашение нового пользователя (${user.id})`,
                      'CREDIT'
                    );

                    // Get updated balance after transaction
                    updatedReferrer = await prisma.user.findUnique({
                      where: { id: referrerUser.id },
                      select: {
                        balance: true,
                        telegramId: true,
                        firstName: true
                      }
                    });
                  } else {
                    // If no partner profile, update balance directly
                    updatedReferrer = await prisma.user.update({
                      where: { id: referrerUser.id },
                      data: {
                        balance: {
                          increment: 3
                        }
                      },
                      select: {
                        balance: true,
                        telegramId: true,
                        firstName: true
                      }
                    });
                    console.log('🔗 Referral: Bonus 3PZ added directly to referrer balance (no partner profile)');
                  }

                  console.log('🔗 Referral: Bonus 3PZ processed, new balance:', updatedReferrer?.balance);

                  // Send notification to inviter (always send if bonus was awarded)
                  if (updatedReferrer) {
                    try {
                      const joinedLabel = user.username ? `@${user.username}` : (user.firstName || 'пользователь');
                      const notificationText =
                        '🎉 <b>Баланс пополнен!</b>\n\n' +
                        `💰 Сумма: 3.00 PZ\n` +
                        `💳 Текущий баланс: ${updatedReferrer.balance.toFixed(2)} PZ\n\n` +
                        `✨ К вам присоединился ${joinedLabel} по вашей реферальной ссылке!\n\n` +
                        `Приглашайте больше друзей и получайте бонусы!`;

                      await ctx.telegram.sendMessage(
                        referrerUser.telegramId,
                        notificationText,
                        { parse_mode: 'HTML' }
                      );
                      console.log('🔗 Referral: Notification sent successfully to inviter:', referrerUser.telegramId);
                    } catch (error: any) {
                      console.error('🔗 Referral: Failed to send notification to inviter:', error?.message || error);
                      // Log full error for debugging
                      if (error?.response) {
                        console.error('🔗 Referral: Telegram API error:', JSON.stringify(error.response, null, 2));
                      }
                    }
                  } else {
                    console.warn('🔗 Referral: updatedReferrer is null, cannot send notification');
                  }
                } else {
                  console.log('🔗 Referral: Bonus already awarded for this user, skipping');
                }
              } catch (error: any) {
                console.error('🔗 Referral: Error awarding bonus:', error?.message);
              }
            } else {
              console.log('🔗 Referral: User already exists, bonus not awarded');
            }
          }
        } catch (error: any) {
          console.warn('🔗 Referral: Error processing username referral:', error?.message);
        }
      }

      // Handle old format: ref_direct_CODE or ref_multi_CODE
      if (startPayload && (startPayload.startsWith('ref_direct_') || startPayload.startsWith('ref_multi_'))) {
        const parts = startPayload.split('_');
        console.log('🔗 Referral: parts =', parts);

        const programType = parts[1] === 'direct' ? 'DIRECT' : 'MULTI_LEVEL';
        const referralCode = parts.slice(2).join('_'); // Join remaining parts in case code contains underscores

        console.log('🔗 Referral: programType =', programType, 'referralCode =', referralCode);

        try {
          // Find partner profile by referral code
          const { prisma } = await import('../../lib/prisma.js');
          console.log('🔗 Referral: Searching for partner profile with code:', referralCode);

          let partnerProfile;
          try {
            partnerProfile = await prisma.partnerProfile.findUnique({
              where: { referralCode },
              include: { user: true }
            });
          } catch (error: any) {
            // Silent fail for DB errors - continue without referral processing
            if (error?.code === 'P1013' || error?.message?.includes('Authentication failed')) {
              console.warn('🔗 Referral: Database auth error, skipping referral processing');
              partnerProfile = null;
            } else {
              throw error; // Re-throw non-auth errors
            }
          }

          console.log('🔗 Referral: Found partner profile:', partnerProfile ? 'YES' : 'NO');

          if (partnerProfile) {
            // Check if user already existed before ensuring
            let existingUserBeforeEnsure: { id: string } | null = null;
            if (ctx.from?.id) {
              try {
                existingUserBeforeEnsure = await prisma.user.findUnique({
                  where: { telegramId: ctx.from.id.toString() },
                  select: { id: true }
                });
              } catch (error: any) {
                // Silent fail for DB errors
                if (error?.code === 'P1013' || error?.message?.includes('Authentication failed')) {
                  existingUserBeforeEnsure = null;
                } else {
                  throw error;
                }
              }
            }

            // Ensure user exists first
            const user = await ensureUser(ctx);
            if (!user) {
              console.log('🔗 Referral: Failed to ensure user');
              await ctx.reply('❌ Ошибка при регистрации пользователя.');
              return;
            }

            const isExistingUser = Boolean(existingUserBeforeEnsure);

            console.log('🔗 Referral: User ensured, upserting referral record');

            // Use upsert to create or get existing referral record
            const referralLevel = programType === 'DIRECT' ? 1 : 1; // Both start at level 1
            const referral = await upsertPartnerReferral(partnerProfile.id, referralLevel, user.id, undefined, programType);

            // Calculate if this is a new referral (created in last 30 seconds)
            const isNewReferral = referral && (new Date().getTime() - new Date(referral.createdAt).getTime() < 30000);

            // Award bonus only if this is a new user (not existing before)
            if (!isExistingUser) {
              // Check if bonus was already awarded for this user
              const existingBonus = await prisma.partnerTransaction.findFirst({
                where: {
                  profileId: partnerProfile.id,
                  OR: [
                    { description: { contains: `Бонус за приглашение друга (${user.id})` } },
                    { description: { contains: `Бонус 3PZ за приглашение нового пользователя (${user.id})` } }
                  ]
                }
              });

              if (!existingBonus) {
                // Award 3PZ to the inviter only if not already awarded
                console.log('🔗 Referral: Awarding 3PZ bonus to inviter for new user');

                await recordPartnerTransaction(
                  partnerProfile.id,
                  3,
                  `Бонус 3PZ за приглашение нового пользователя (${user.id})`,
                  'CREDIT'
                );

                // Get updated user balance after transaction
                const updatedReferrer = await prisma.user.findUnique({
                  where: { id: partnerProfile.userId },
                  select: {
                    balance: true,
                    telegramId: true,
                    firstName: true
                  }
                });

                console.log('🔗 Referral: Bonus awarded successfully, new balance:', updatedReferrer?.balance);

                // Send notification to inviter (always send if bonus was awarded)
                if (updatedReferrer) {
                  try {
                    console.log('🔗 Referral: Sending notification to inviter:', updatedReferrer.telegramId);
                    const joinedLabel = user.username ? `@${user.username}` : (user.firstName || 'пользователь');
                    const notificationText =
                      '🎉 <b>Баланс пополнен!</b>\n\n' +
                      `💰 Сумма: 3.00 PZ\n` +
                      `💳 Текущий баланс: ${updatedReferrer.balance.toFixed(2)} PZ\n\n` +
                      `✨ К вам присоединился ${joinedLabel} по вашей реферальной ссылке!\n\n` +
                      `Приглашайте больше друзей и получайте бонусы!`;

                    await ctx.telegram.sendMessage(
                      updatedReferrer.telegramId,
                      notificationText,
                      { parse_mode: 'HTML' }
                    );
                    console.log('🔗 Referral: Notification sent successfully to inviter');
                  } catch (error: any) {
                    console.error('🔗 Referral: Failed to send notification to inviter:', error?.message || error);
                    // Log full error for debugging
                    if (error?.response) {
                      console.error('🔗 Referral: Telegram API error:', JSON.stringify(error.response, null, 2));
                    }
                  }
                } else {
                  console.warn('🔗 Referral: updatedReferrer is null, cannot send notification');
                }
              } else {
                console.log('🔗 Referral: Bonus already awarded for this user, skipping');
              }
            } else {
              console.log('🔗 Referral: User already existed, bonus not awarded');
            }

            console.log('🔗 Referral: Sending welcome photo with buttons');
            await sendWelcomeWithPhoto(ctx, { referralInviterName: partnerProfile.user.firstName || 'партнёр' });
            console.log('🔗 Referral: Welcome message sent');

            await logUserAction(ctx, 'partner:referral_joined', {
              referralCode,
              partnerId: partnerProfile.id,
              programType
            });

            // Notify partner about new referral ONLY if it's a new record
            if (isNewReferral) {
              try {
                console.log('🔗 Referral: Sending notification to partner:', partnerProfile.user.telegramId);
                const joinedLabel = user.username ? `@${user.username}` : (user.firstName || 'пользователь');

                // Fetch actual count to be accurate
                const currentPartnersCount = await prisma.partnerReferral.count({
                  where: { profileId: partnerProfile.id }
                });

                // Check if partner is a super-partner (25%) or regular (15%)
                const fullPartnerProfile = await prisma.partnerProfile.findUnique({
                  where: { id: partnerProfile.id },
                  select: { isSuperPartner: true }
                });
                const isSuperPartner = fullPartnerProfile?.isSuperPartner === true;
                const percentLabel = isSuperPartner ? '25%' : '15%';
                const partnerTypeLabel = isSuperPartner ? ' (Супер партнёр)' : '';

                const notificationText =
                  '🎉 <b>Новый партнёр!</b>\n\n' +
                  `✨ К вам присоединился ${joinedLabel} по вашей реферальной ссылке!\n\n` +
                  `👥 Всего партнёров: ${currentPartnersCount}\n` +
                  `💰 Вы получите ${percentLabel} с покупок этого пользователя${partnerTypeLabel}\n\n` +
                  `Приглашайте больше друзей и получайте бонусы!`;

                await ctx.telegram.sendMessage(
                  partnerProfile.user.telegramId,
                  notificationText,
                  { parse_mode: 'HTML' }
                );
                console.log('🔗 Referral: Partner notification sent successfully');
              } catch (error: any) {
                console.error('🔗 Referral: Failed to send partner notification:', error?.message || error);
              }
            } else {
              console.log('🔗 Referral: Skipping duplicate partner notification (referral already existed)');
            }

            return; // Don't call renderHome to avoid duplicate greeting
          } else {
            console.log('🔗 Referral: Partner profile not found for code:', referralCode);
            await ctx.reply('❌ Реферальная ссылка недействительна. Партнёр не найден.');
          }
        } catch (error) {
          console.error('🔗 Referral: Error processing referral:', error);
          await ctx.reply('❌ Ошибка при обработке реферальной ссылки. Попробуйте позже.');
        }
      }

      await sendWelcomeWithPhoto(ctx);
      // После приветствия — при необходимости запрашиваем телефон (не блокируя показ приветствия)
      await checkUserContact(ctx);
    });


    bot.hears(['Меню', 'Главное меню', 'Назад'], async (ctx) => {
      await logUserAction(ctx, 'menu:main');
      await renderHome(ctx);
    });

    // Обработчики для кнопок классического меню
    bot.hears('Каталог', async (ctx) => {
      await logUserAction(ctx, 'menu:catalog');
      await ctx.reply('Каталог', Markup.removeKeyboard());
    });

    bot.hears('🛒 Магазин', async (ctx) => {
      await logUserAction(ctx, 'menu:shop');
      const webappUrl = getWebappUrl();
      await ctx.reply(
        '🛒 <b>Открываю магазин...</b>',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🚀 Открыть магазин',
                  web_app: { url: webappUrl }
                }
              ]
            ]
          }
        }
      );
    });

    bot.hears('🤝 Партнёрка', async (ctx) => {
      await logUserAction(ctx, 'menu:partner');
      const { showPartnerIntro } = await import('../partner/index.js');
      await showPartnerIntro(ctx);
    });


    bot.hears('⭐ Отзывы', async (ctx) => {
      await logUserAction(ctx, 'menu:reviews');
      const { showReviews } = await import('../reviews/index.js');
      await showReviews(ctx);
    });

    bot.hears(['🎶 Звуковые матрицы Гаряева', 'Звуковые матрицы'], async (ctx) => {
      await logUserAction(ctx, 'menu:gift_audio');
      await ctx.reply(GIFT_AUDIO_INTRO);
      try {
        const { showAudioFiles } = await import('../audio/index.js');
        await showAudioFiles(ctx, 'gift');
      } catch (e) {
        console.warn('hears gift_audio failed:', (e as Error)?.message);
        await ctx.reply('🎵 Аудиофайлы загружаются. Попробуйте позже или напишите в поддержку.');
      }
    });

    bot.hears('ℹ️ О нас', async (ctx) => {
      await logUserAction(ctx, 'menu:about');
      const { showAbout } = await import('../about/index.js');
      await showAbout(ctx);
    });



    bot.action('nav:more', async (ctx) => {
      await ctx.answerCbQuery();
      await logUserAction(ctx, 'cta:detailed-intro');
      await ctx.reply(introDetails);
    });

    bot.action('nav:gift', async (ctx) => {
      await ctx.answerCbQuery();
      await logUserAction(ctx, 'cta:gift');
      await showGiftMessage(ctx);
    });

    bot.action('nav:gift_audio', async (ctx) => {
      await ctx.answerCbQuery();
      await logUserAction(ctx, 'cta:gift_audio');
      await ctx.reply(GIFT_AUDIO_INTRO);
      try {
        const { showAudioFiles } = await import('../audio/index.js');
        await showAudioFiles(ctx, 'gift');
      } catch (e) {
        console.warn('nav:gift_audio failed:', (e as Error)?.message);
        await ctx.reply('🎵 Аудиофайлы загружаются. Попробуйте позже или напишите в поддержку.');
      }
    });

    bot.action('nav:my_ref_link', async (ctx) => {
      console.log('🔗 [REF] Кнопка «Ваша реф ссылка» нажата, userId:', ctx.from?.id);
      await ctx.answerCbQuery();
      await logUserAction(ctx, 'cta:my_ref_link');
      try {
        const { env } = await import('../../config/env.js');
        if (!env.databaseUrl) {
          console.log('🔗 [REF] Нет DATABASE_URL/MONGO_URL');
          await ctx.reply('❌ Реферальная ссылка недоступна: не настроена база данных (DATABASE_URL или MONGO_URL на сервере).');
          return;
        }
        const user = await ensureUser(ctx);
        if (!user) {
          console.log('🔗 [REF] ensureUser вернул null');
          await ctx.reply('❌ Сначала нажмите /start и начните диалог с ботом.');
          return;
        }
        if ((user as any).__fromMock) {
          console.log('🔗 [REF] Пользователь из mock — БД недоступна');
          await ctx.reply(
            '❌ Реферальная ссылка временно недоступна: нет связи с базой данных.\n\n' +
            'Проверьте на сервере переменные MONGO_URL или DATABASE_URL и перезапустите приложение.'
          );
          return;
        }
        const profile = await getOrCreatePartnerProfile(user.id, 'DIRECT');
        const { main: link } = buildReferralLink(profile.referralCode, (profile.programType || 'DIRECT') as 'DIRECT' | 'MULTI_LEVEL', user.username || undefined);
        const escapedLink = link.replace(/&/g, '&amp;');
        await ctx.reply(
          `🔗 <b>Ваша реферальная ссылка:</b>\n\n<a href="${escapedLink}">${escapedLink}</a>\n\nПоделитесь ссылкой с друзьями — вы получите бонусы с их покупок.`,
          { parse_mode: 'HTML' }
        );
        console.log('🔗 [REF] Ссылка отправлена, code:', profile.referralCode);
      } catch (e: any) {
        console.error('🔗 [REF] Ошибка:', e?.message || e);
        const hint = e?.code === 'P2003' ? ' Возможно, база данных недоступна или не настроена (MONGO_URL / DATABASE_URL).' : '';
        await ctx.reply('❌ Не удалось получить реферальную ссылку.' + hint + ' Попробуйте позже или обратитесь в поддержку.');
      }
    });


    for (const item of navigationItems) {
      bot.action(`${NAVIGATION_ACTION_PREFIX}${item.id}`, async (ctx) => {
        await ctx.answerCbQuery();
        await logUserAction(ctx, `menu:${item.id}`, { source: 'navigation-card' });

        try {
          await item.handler(ctx);
        } catch (error) {
          console.error(`🧭 Navigation: Failed to open section ${item.id}`, error);
          await ctx.reply('❌ Не удалось открыть раздел. Попробуйте позже.');
        }
      });
    }

    bot.action(SWITCH_TO_CLASSIC_ACTION, async (ctx) => {
      await ctx.answerCbQuery();
      await logUserAction(ctx, 'ui:mode_classic', { source: 'navigation-card' });
      await exitAppInterface(ctx);
    });

    // Handle app help
    bot.action('nav:app:help', async (ctx) => {
      await ctx.answerCbQuery();
      await logUserAction(ctx, 'app:help');
      await ctx.reply(
        '📱 <b>Как пользоваться веб-приложением</b>\n\n' +
        '🌐 <b>Что такое веб-приложение?</b>\n' +
        'Это полнофункциональный интернет-магазин, который открывается прямо в Telegram.\n\n' +
        '✨ <b>Возможности:</b>\n' +
        '• Просмотр каталога товаров\n' +
        '• Добавление в корзину\n' +
        '• Оформление заказов\n' +
        '• Просмотр отзывов\n' +
        '• Партнерская программа\n\n' +
        '🚀 <b>Как открыть:</b>\n' +
        '1. Нажмите кнопку "🚀 Открыть приложение"\n' +
        '2. Приложение откроется в Telegram\n' +
        '3. Используйте как обычный сайт\n\n' +
        '💡 <b>Совет:</b> Веб-приложение работает быстрее и удобнее для покупок!',
        { parse_mode: 'HTML' }
      );
    });

    // Handle admin reply to user support messages
    bot.action(/^admin_reply:(.+):(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();

      const matches = ctx.match;
      const userTelegramId = matches[1];
      const userName = matches[2];

      // Store the reply context in session for the admin
      if (!ctx.session) ctx.session = {};
      ctx.session.replyingTo = {
        userTelegramId,
        userName
      };

      await ctx.reply(
        `📝 <b>Ответ пользователю ${userName}</b>\n\n` +
        `💭 Напишите ваш ответ следующим сообщением, и он будет отправлен пользователю.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '❌ Отменить ответ',
                  callback_data: 'cancel_admin_reply'
                }
              ]
            ]
          }
        }
      );
    });

    // Handle cancel admin reply
    bot.action('cancel_admin_reply', async (ctx) => {
      await ctx.answerCbQuery();

      if (ctx.session && ctx.session.replyingTo) {
        delete ctx.session.replyingTo;
        await ctx.reply('❌ Ответ отменен.');
      }
    });

    // ===== Order Confirmation Dialog =====

    // Shared helper: load order and build formatted data
    async function buildOrderData(orderId: string) {
      const { prisma } = await import('../../lib/prisma.js');
      const order = await prisma.orderRequest.findUnique({
        where: { id: orderId },
        include: { user: true }
      });
      if (!order || !order.user) return null;

      const user = order.user;
      const userName = user.firstName || 'клиент';

      // itemsJson is Prisma Json type — already parsed, NOT a string
      let items: any[] = [];
      if (Array.isArray(order.itemsJson)) {
        items = order.itemsJson as any[];
      } else if (order.itemsJson && typeof order.itemsJson === 'string') {
        try { items = JSON.parse(order.itemsJson); } catch { items = []; }
      }

      // Build items list
      let itemsList = '';
      let totalRub = 0;
      let itemsListSimple = ''; // For client: just name + qty
      items.forEach((item: any, i: number) => {
        const qty = item.quantity || 1;
        const priceRub = Math.round((item.price || 0) * 100);
        const lineTotal = priceRub * qty;
        totalRub += lineTotal;
        itemsList += `${i + 1}. ${item.title || 'Товар'} — ${qty} шт. × ${priceRub} ₽ = ${lineTotal} ₽\n`;
        itemsListSimple += `${i + 1}. ${item.title || 'Товар'} — ${qty} шт.\n`;
      });

      // Contact info (for admin/manager view only)
      let contactLines = '';
      if (user.phone) contactLines += `📱 Тел: ${user.phone}\n`;
      if (user.deliveryAddress) contactLines += `📍 Адрес: ${user.deliveryAddress}\n`;
      if (user.firstName || user.lastName) {
        contactLines += `👤 ФИО: ${user.firstName || ''} ${user.lastName || ''}\n`;
      }
      if (user.username) contactLines += `💬 Telegram: @${user.username}\n`;

      // Extra info from order message (certificate, discount, balance)
      let extraInfo = '';
      const msg = order.message || '';
      if (msg.includes('сертификат') || msg.includes('Сертификат')) {
        const certMatch = msg.match(/К оплате после сертификата:\s*(\d+)\s*₽/);
        if (certMatch) {
          extraInfo += `🎟 Применён сертификат\n💳 К оплате после сертификата: ${certMatch[1]} ₽\n`;
        }
      }
      if (msg.includes('Скидка') || msg.includes('скидка')) {
        const discountMatch = msg.match(/Скидка.*?(\d+\s*₽)/i);
        if (discountMatch) {
          extraInfo += `🏷️ Скидка: ${discountMatch[1]}\n`;
        }
      }
      if (msg.includes('Оплата с баланса')) {
        const balanceMatch = msg.match(/Оплата с баланса:\s*(\d+)\s*₽/);
        if (balanceMatch) {
          extraInfo += `💳 Оплата с баланса: ${balanceMatch[1]} ₽\n`;
        }
      }

      return { order, user, userName, items, itemsList, itemsListSimple, totalRub, contactLines, extraInfo };
    }

    // When admin clicks "Написать пользователю" on order notification
    bot.action(/^order_confirm:(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const orderId = (ctx.match as RegExpExecArray)[1];

      try {
        const data = await buildOrderData(orderId);
        if (!data) {
          await ctx.reply('❌ Заказ не найден.');
          return;
        }

        const { userName, itemsList, itemsListSimple, totalRub, contactLines, extraInfo } = data;

        // Build preview template for admin (shows what client will see)
        const clientPreview =
          `Доброго времени, ${userName}!\n\n` +
          `✅ Ваш заказ принят:\n\n` +
          `${itemsListSimple}\n` +
          `💰 Итого: ${totalRub} ₽\n` +
          (extraInfo ? `${extraInfo}\n` : '') +
          `Спасибо за заказ! Мы свяжемся с вами в ближайшее время для подтверждения.\n\n` +
          `👩‍💼 Ваш менеджер: @Aurelia_8888`;

        await ctx.reply(
          `📋 <b>Шаблон сообщения для клиента:</b>\n\n` +
          `<i>${clientPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</i>\n\n` +
          `<b>Данные клиента:</b>\n${contactLines}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '📩 Отправить клиенту',
                    callback_data: `oc_client:${orderId}`
                  }
                ],
                [
                  {
                    text: '📤 Отправить менеджеру',
                    callback_data: `oc_manager:${orderId}`
                  }
                ],
                [
                  {
                    text: '❌ Отмена',
                    callback_data: 'cancel_admin_reply'
                  }
                ]
              ]
            }
          }
        );
      } catch (error) {
        console.error('Order confirm error:', error);
        await ctx.reply('❌ Ошибка загрузки заказа.');
      }
    });

    // Send confirmation to CLIENT
    bot.action(/^oc_client:(.+)$/, async (ctx) => {
      await ctx.answerCbQuery('Отправляю...');
      const orderId = (ctx.match as RegExpExecArray)[1];

      try {
        const data = await buildOrderData(orderId);
        if (!data) {
          await ctx.reply('❌ Заказ или пользователь не найден.');
          return;
        }

        const { order, user, userName, itemsListSimple, totalRub, extraInfo } = data;

        // Double-send protection
        if (order.status === 'PROCESSING' || order.status === 'COMPLETED') {
          await ctx.reply(`⚠️ Подтверждение уже было отправлено клиенту ${userName} ранее. Отправить повторно?`, {
            reply_markup: {
              inline_keyboard: [[
                { text: '📩 Да, отправить ещё раз', callback_data: `oc_resend:${orderId}` },
                { text: '❌ Нет', callback_data: 'cancel_admin_reply' }
              ]]
            }
          });
          return;
        }

        const clientMessage =
          `Доброго времени, ${userName}! 🌿\n\n` +
          `✅ <b>Ваш заказ принят:</b>\n\n` +
          `${itemsListSimple}\n` +
          `💰 <b>Итого: ${totalRub} ₽</b>\n` +
          (extraInfo ? `${extraInfo}\n` : '') +
          `Спасибо за заказ! Мы свяжемся с вами в ближайшее время для подтверждения. 💚\n\n` +
          `👩‍💼 Ваш менеджер: @Aurelia_8888`;

        await ctx.telegram.sendMessage(user.telegramId, clientMessage, { parse_mode: 'HTML' });

        // Mark order as confirmed
        const { prisma } = await import('../../lib/prisma.js');
        await prisma.orderRequest.update({
          where: { id: orderId },
          data: { status: 'PROCESSING' }
        });

        await ctx.reply(`✅ Подтверждение отправлено клиенту ${userName}!`);
      } catch (error: any) {
        console.error('Send to client error:', error);
        if (error?.response?.description?.includes('bot was blocked')) {
          await ctx.reply('❌ Пользователь заблокировал бота. Отправка невозможна.');
        } else {
          await ctx.reply(`❌ Ошибка отправки: ${error?.message || 'Неизвестная ошибка'}`);
        }
      }
    });

    // Resend confirmation (after duplicate warning)
    bot.action(/^oc_resend:(.+)$/, async (ctx) => {
      await ctx.answerCbQuery('Отправляю повторно...');
      const orderId = (ctx.match as RegExpExecArray)[1];

      try {
        const data = await buildOrderData(orderId);
        if (!data) {
          await ctx.reply('❌ Заказ не найден.');
          return;
        }

        const { user, userName, itemsListSimple, totalRub, extraInfo } = data;

        const clientMessage =
          `Доброго времени, ${userName}! 🌿\n\n` +
          `✅ <b>Ваш заказ принят:</b>\n\n` +
          `${itemsListSimple}\n` +
          `💰 <b>Итого: ${totalRub} ₽</b>\n` +
          (extraInfo ? `${extraInfo}\n` : '') +
          `Спасибо за заказ! Мы свяжемся с вами в ближайшее время для подтверждения. 💚\n\n` +
          `👩‍💼 Ваш менеджер: @Aurelia_8888`;

        await ctx.telegram.sendMessage(user.telegramId, clientMessage, { parse_mode: 'HTML' });
        await ctx.reply(`✅ Подтверждение повторно отправлено клиенту ${userName}!`);
      } catch (error: any) {
        console.error('Resend to client error:', error);
        await ctx.reply(`❌ Ошибка повторной отправки: ${error?.message || 'Неизвестная ошибка'}`);
      }
    });

    // Send order info to MANAGER
    bot.action(/^oc_manager:(.+)$/, async (ctx) => {
      await ctx.answerCbQuery('Отправляю менеджеру...');
      const orderId = (ctx.match as RegExpExecArray)[1];

      try {
        const data = await buildOrderData(orderId);
        if (!data) {
          await ctx.reply('❌ Заказ или пользователь не найден.');
          return;
        }

        const { userName, itemsList, totalRub, contactLines, extraInfo } = data;

        const managerMessage =
          `📦 <b>Новый заказ от клиента</b>\n\n` +
          `👤 Клиент: ${userName}\n` +
          `${contactLines}\n` +
          `📦 Состав заказа:\n${itemsList}\n` +
          `💰 <b>Итого: ${totalRub} ₽</b>\n` +
          (extraInfo ? `${extraInfo}\n` : '') +
          `🆔 Заказ: <code>${orderId}</code>`;

        await ctx.reply(
          `📤 <b>Сообщение для менеджера (скопируйте или перешлите):</b>\n\n${managerMessage}`,
          { parse_mode: 'HTML' }
        );
      } catch (error: any) {
        console.error('Send to manager error:', error);
        await ctx.reply(`❌ Ошибка: ${error?.message || 'Неизвестная ошибка'}`);
      }
    });

    // Handle text messages for support
    bot.on('text', async (ctx, next) => {
      // Only process if user is in support mode or sent a support message
      const messageText = (ctx.message as any)?.text;
      if (!messageText) {
        await next();
        return;
      }

      // Skip commands and button texts
      if (messageText.startsWith('/')) {
        await next();
        return;
      }

      const buttonTexts = ['🛒 Магазин', '💰 Партнёрка', '⭐ Отзывы', 'ℹ️ О нас', 'Меню', 'Главное меню', 'Назад'];
      if (buttonTexts.includes(messageText)) {
        await next();
        return;
      }

      // Check for native reply (reply_to_message)
      if (ctx.message && 'reply_to_message' in ctx.message && ctx.message.reply_to_message) {
        const replyTo = ctx.message.reply_to_message as any;
        console.log('🔍 Checking reply_to_message:', JSON.stringify(replyTo.text).substring(0, 100));

        // Check if the message we are replying to has the user ID in it (from our template)
        // Template: 🆔 Telegram ID: <code>123456789</code>
        if (replyTo.text && (replyTo.text.includes('Telegram ID:') || replyTo.text.includes('ID:'))) {
          // Try multiple patterns
          // 1. "Telegram ID: 123456789"
          // 2. "ID: 123456789"
          // 3. "ID: <code>123456789</code>" (if HTML tags are stripped but content remains)
          const match = replyTo.text.match(/Telegram ID:\s*(\d+)/) ||
            replyTo.text.match(/ID:\s*(\d+)/) ||
            replyTo.text.match(/ID:.*?(\d+)/);

          if (match && match[1]) {
            const userTelegramId = match[1];
            console.log('✅ Found User ID in reply:', userTelegramId);

            const { getAdminChatIds } = await import('../../config/env.js');
            const adminIds = getAdminChatIds();
            if (adminIds.includes(ctx.from?.id?.toString() || '')) {
              // It is an admin replying to a support ticket notification
              // Fake the session context so the next block handles it
              if (!ctx.session) ctx.session = {};
              ctx.session.replyingTo = {
                userTelegramId,
                userName: 'Пользователь'
              };
              console.log('✅ Session context set for reply');
            } else {
              console.log('❌ User is not admin:', ctx.from?.id);
            }
          } else {
            console.log('❌ Could not extract ID from reply text. Text starts with:', replyTo.text.substring(0, 50));
          }
        }
      }

      // Check if this is an admin replying to a user
      const { getAdminChatIds } = await import('../../config/env.js');
      const adminIds = getAdminChatIds();

      if (adminIds.includes(ctx.from?.id?.toString() || '') && ctx.session?.replyingTo) {
        console.log('🧭 Navigation: Handling admin reply', JSON.stringify(ctx.session.replyingTo));
        const { userTelegramId, userName } = ctx.session.replyingTo;

        try {
          // Send admin's reply to the user
          await ctx.telegram.sendMessage(
            userTelegramId,
            `💬 <b>Ответ службы поддержки:</b>\n\n${messageText}`,
            { parse_mode: 'HTML' }
          );

          // Also store reply in DB so WebApp chat can display it
          try {
            const { prisma } = await import('../../lib/prisma.js');
            const user = await prisma.user.findUnique({
              where: { telegramId: userTelegramId.toString() },
              select: { id: true }
            });
            if (user) {
              await prisma.userHistory.create({
                data: {
                  userId: user.id,
                  action: 'support:webapp',
                  payload: { direction: 'admin', text: messageText }
                }
              });
            }
          } catch (dbErr) {
            console.error('Failed to log support reply for webapp:', dbErr);
          }

          // Confirm to admin
          await ctx.reply(
            `✅ <b>Ответ отправлен пользователю ${userName}</b>\n\n` +
            `💬 Ваше сообщение: "${messageText}"`,
            { parse_mode: 'HTML' }
          );

          // Clear the reply context
          delete ctx.session.replyingTo;
        } catch (error) {
          console.error('Failed to send admin reply to user:', error);
          await ctx.reply('❌ Не удалось отправить ответ пользователю. Возможно, пользователь заблокировал бота.');
        }
        return;
      }

      // Check if this looks like a support message (not a short response to bot)
      if (messageText.length > 3) {
        await handleSupportMessage(ctx);
        return;
      }

      await next();
    });

  },
};
