import { Markup, Telegraf } from 'telegraf';
import { Context } from '../../bot/context.js';
import { BotModule } from '../../bot/types.js';
import { ensureUser, logUserAction } from '../../services/user-history.js';
import { getActiveCategories, getCategoryById, getProductById, getProductsByCategory } from '../../services/shop-service.js';
import { addProductToCart, cartItemsToText, getCartItems } from '../../services/cart-service.js';
import { createOrderRequest } from '../../services/order-service.js';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';

const CATEGORY_ACTION_PREFIX = 'shop:cat:';
const PRODUCT_MORE_PREFIX = 'shop:prod:more:';
const PRODUCT_CART_PREFIX = 'shop:prod:cart:';
const PRODUCT_BUY_PREFIX = 'shop:prod:buy:';
const PRODUCT_INSTRUCTION_PREFIX = 'shop:prod:instruction:';
const REGION_SELECT_PREFIX = 'shop:region:';

export async function showRegionSelection(ctx: Context) {
  await logUserAction(ctx, 'shop:region_selection');

  await ctx.reply(
    '🌍 Выберите ваш регион для просмотра доступных товаров:',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🇷🇺 Россия', `${REGION_SELECT_PREFIX}RUSSIA`),
        Markup.button.callback('🇮🇩 Бали', `${REGION_SELECT_PREFIX}BALI`)
      ]
    ])
  );
}

export async function showCategories(ctx: Context, region?: string) {
  // Регион больше не используется, всегда показываем все товары
  await logUserAction(ctx, 'shop:open');

  try {
    console.log('🛍️ Loading categories...');
    const categories = await getActiveCategories();
    console.log('🛍️ Found active categories:', categories.length);

    // Debug: also check all categories
    const allCategories = await prisma.category.findMany();
    console.log('🛍️ Total categories in DB:', allCategories.length);
    allCategories.forEach(cat => {
      console.log(`  - ${cat.name} (ID: ${cat.id}, Active: ${cat.isActive})`);
    });

    if (categories.length === 0) {
      console.log('🛍️ No active categories found, showing empty message');
      // Получаем баланс пользователя
      const user = await ensureUser(ctx);
      const userBalance = Number((user as any)?.balance || 0);

      await ctx.reply(`🛍️ Каталог товаров Plazma Water\n\n💰 Баланс: ${userBalance.toFixed(2)} PZ\n\nКаталог пока пуст. Добавьте категории и товары в админке.`);
      return;
    }

    // Get cart items count
    const user = await ensureUser(ctx);
    let cartItemsCount = 0;
    if (user) {
      try {
        const cartItems = await getCartItems(user.id);
        cartItemsCount = cartItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
      } catch (error) {
        console.warn('Failed to get cart items count:', error);
      }
    }

    const keyboard = [
      ...categories.map((category: any) => [
        {
          text: `📂 ${category.name}`,
          callback_data: `${CATEGORY_ACTION_PREFIX}${category.id}`,
        },
      ]),
      [
        {
          text: `🛒 Корзина${cartItemsCount > 0 ? ` (${cartItemsCount})` : ''}`,
          callback_data: 'shop:cart',
        },
      ]
    ];

    // Получаем баланс пользователя
    const userBalance = Number((user as any)?.balance || 0);

    await ctx.reply(`🛍️ Каталог товаров Plazma Water\n\n💰 Баланс: ${userBalance.toFixed(2)} PZ\n\nВыберите категорию:`, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    console.error('Error loading categories:', error);
    // Получаем баланс пользователя
    const user = await ensureUser(ctx);
    const userBalance = Number((user as any)?.balance || 0);

    await ctx.reply(`🛍️ Каталог товаров Plazma Water\n\n💰 Баланс: ${userBalance.toFixed(2)} PZ\n\n❌ Ошибка загрузки каталога. Попробуйте позже.`);
  }
}

function formatProductMessage(product: { title: string; summary: string; price: unknown }) {
  const pzPrice = Number(product.price);
  const rubPrice = (pzPrice * 100).toFixed(2);
  return `💧 ${product.title}\n${product.summary}\n\nЦена: ${rubPrice} ₽ / ${pzPrice} PZ`;
}

async function sendProductCards(ctx: Context, categoryId: string) {
  try {
    const category = await getCategoryById(categoryId);
    if (!category) {
      await ctx.reply('❌ Категория не найдена.');
      return;
    }

    const products = await getProductsByCategory(categoryId);

    if (products.length === 0) {
      await ctx.reply(`📂 ${category.name}\n\nВ этой категории пока нет товаров.`);
      return;
    }

    // Show category header
    await ctx.reply(`📂 ${category.name}\n\nТовары в категории:`);

    // Send products in a grid layout with delay between each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`🛍️ Product: ${product.title}, ImageUrl: ${product.imageUrl}`);

      const buttons = [];

      // Первая строка: Подробнее + Инструкция
      const firstRow = [];
      if (product.description) {
        firstRow.push(Markup.button.callback('📖 Подробнее', `${PRODUCT_MORE_PREFIX}${product.id}`));
      }
      if (product.instruction) {
        firstRow.push(Markup.button.callback('📋 Инструкция', `${PRODUCT_INSTRUCTION_PREFIX}${product.id}`));
      }
      if (firstRow.length > 0) {
        buttons.push(firstRow);
      }

      // Вторая строка: В корзину + Купить
      const secondRow = [];
      secondRow.push(Markup.button.callback('🛒 В корзину', `${PRODUCT_CART_PREFIX}${product.id}`));
      secondRow.push(Markup.button.callback('💳 Купить', `${PRODUCT_BUY_PREFIX}${product.id}`));
      buttons.push(secondRow);

      const message = formatProductMessage(product);

      if (product.imageUrl && product.imageUrl.trim() !== '') {
        console.log(`🛍️ Sending product with image: ${product.imageUrl}`);
        await ctx.replyWithPhoto(product.imageUrl, {
          caption: message,
          ...Markup.inlineKeyboard(buttons),
        });
      } else {
        console.log(`🛍️ Sending product without image (no imageUrl)`);
        await ctx.reply(message, Markup.inlineKeyboard(buttons));
      }

      // Add 1 second delay between products (except for the last one)
      if (i < products.length - 1) {
        console.log(`🛍️ Waiting 1 second before next product...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

  } catch (error) {
    console.error('Error loading products:', error);
    await ctx.reply('❌ Ошибка загрузки товаров. Попробуйте позже.');
  }
}

export async function handleAddToCart(ctx: Context, productId: string) {
  const user = await ensureUser(ctx);
  if (!user) {
    await ctx.reply('Не удалось определить пользователя. Попробуйте позже.');
    return;
  }

  const product = await getProductById(productId);
  if (!product) {
    await ctx.reply('Товар не найден.');
    return;
  }

  await addProductToCart(user.id, product.id);
  await logUserAction(ctx, 'shop:add-to-cart', { productId: product.id });
  await ctx.answerCbQuery('Добавлено в корзину ✅');

  // Get updated cart info for button
  const cartItems = await getCartItems(user.id);
  const totalQuantity = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalSum = cartItems.reduce((sum, item) => sum + ((item.product?.price || 0) * (item.quantity || 0)), 0);

  const cartButtonText = `🛒 Корзина (${totalQuantity} 💧, ${totalSum.toFixed(2)} PZ)`;

  await ctx.reply(`«${product.title}» добавлен(а) в корзину.`, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: cartButtonText,
            callback_data: 'shop:cart'
          }
        ]
      ]
    }
  });
}

async function handleProductMore(ctx: Context, productId: string) {
  const product = await getProductById(productId);
  if (!product || !product.description) {
    await ctx.answerCbQuery('Описание не найдено');
    return;
  }

  await logUserAction(ctx, 'shop:product-details', { productId });
  await ctx.answerCbQuery();

  // Создаем кнопки для действий с товаром
  const actionButtons = [
    [
      Markup.button.callback('🛒 В корзину', `${PRODUCT_CART_PREFIX}${product.id}`),
      Markup.button.callback('💳 Купить', `${PRODUCT_BUY_PREFIX}${product.id}`)
    ]
  ];

  await ctx.reply(`ℹ️ ${product.title}\n\n${product.description}`, Markup.inlineKeyboard(actionButtons));
}

async function handleProductInstruction(ctx: Context, productId: string) {
  const product = await getProductById(productId);
  if (!product || !product.instruction) {
    await ctx.answerCbQuery('Инструкция не найдена');
    return;
  }

  await logUserAction(ctx, 'shop:product-instruction', { productId });
  await ctx.answerCbQuery();

  // Создаем кнопки для действий с товаром
  const actionButtons = [
    [
      Markup.button.callback('🛒 В корзину', `${PRODUCT_CART_PREFIX}${product.id}`),
      Markup.button.callback('💳 Купить', `${PRODUCT_BUY_PREFIX}${product.id}`)
    ]
  ];

  await ctx.reply(`📋 Инструкция по применению\n\n${product.title}\n\n${product.instruction}`, Markup.inlineKeyboard(actionButtons));
}

export async function handleBuy(ctx: Context, productId: string) {
  const user = await ensureUser(ctx);
  if (!user) {
    await ctx.reply('Не удалось определить пользователя. Попробуйте позже.');
    return;
  }

  const product = await getProductById(productId);
  if (!product) {
    await ctx.reply('Товар не найден.');
    return;
  }

  const cartItems = await getCartItems(user.id);

  // Create full items list including main product
  const allItems = [...cartItems];
  allItems.push({
    product: {
      title: product.title,
      price: Number(product.price)
    },
    quantity: 1
  } as any);

  const summaryText = cartItemsToText(allItems);

  const lines = [
    '🛒 Запрос на покупку',
    `Пользователь: ${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
    user.username ? `@${user.username}` : undefined,
    `Telegram ID: ${user.telegramId}`,
    `Основной товар: ${product.title}`,
    '',
    'Корзина:',
    summaryText
  ].filter(Boolean);

  const message = lines.join('\n');

  const itemsPayload = cartItems.map((item: any) => ({
    productId: item.productId,
    title: item.product.title,
    price: Number(item.product.price),
    quantity: item.quantity,
  }));

  itemsPayload.push({
    productId: product.id,
    title: product.title,
    price: Number(product.price),
    quantity: 1,
  });

  console.log('🛒 SHOP: About to create order request for user:', user.id, user.firstName, user.username);

  const order = await createOrderRequest({
    userId: user.id,
    message: `Покупка через бота. Основной товар: ${product.title}`,
    items: itemsPayload,
  });

  console.log('✅ SHOP: Order request created successfully');

  await logUserAction(ctx, 'shop:buy', { productId });

  // Send order to specific admin with contact button
  const { getBotInstance } = await import('../../lib/bot-instance.js');
  const { getAdminChatIds } = await import('../../config/env.js');
  const bot = await getBotInstance();

  if (bot) {
    const adminIds = getAdminChatIds();
    const fullMessage = `${message}\n\nЗдравствуйте, хочу приобрести товар…`;

    // Send to all admins
    for (const adminId of adminIds) {
      try {
        await bot.telegram.sendMessage(adminId, fullMessage, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '💬 Написать пользователю',
                  callback_data: `order_confirm:${order.id}`
                }
              ],
              [
                {
                  text: '🤖 Писать через бот',
                  callback_data: `admin_reply:${user.telegramId}:${(user.firstName || 'User').slice(0, 20)}`
                }
              ]
            ]
          }
        });
        console.log(`✅ Order notification sent to admin: ${adminId}`);
      } catch (error: any) {
        console.error(`❌ Failed to send order notification to admin ${adminId}:`, error?.message || error);
      }
    }
  }

  await ctx.answerCbQuery();

  await ctx.reply(
    '📞 <b>В ближайшее время с вами свяжется менеджер.</b>\n\n' +
    'Вы можете написать менеджеру напрямую: @Aurelia_8888',
    {
      parse_mode: 'HTML'
    }
  );
}

export const shopModule: BotModule = {
  async register(bot: Telegraf<Context>) {
    console.log('🛍️ Registering shop module...');

    // Handle shop command - open webapp directly
    bot.command('shop', async (ctx) => {
      await logUserAction(ctx, 'command:shop');
      const webappUrl = env.webappUrl;
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

    bot.hears(['Магазин', 'Каталог'], async (ctx) => {
      console.log('🛍️ Shop button pressed by user:', ctx.from?.id);
      await logUserAction(ctx, 'menu:shop');
      const webappUrl = env.webappUrl;
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

    // Handle region selection
    bot.action(new RegExp(`^${REGION_SELECT_PREFIX}(.+)$`), async (ctx) => {
      const match = ctx.match as RegExpExecArray;
      const regionOrAction = match[1];
      await ctx.answerCbQuery();

      if (regionOrAction === 'change') {
        await showRegionSelection(ctx);
        return;
      }

      // Save region to user and show categories
      const user = await ensureUser(ctx);
      if (user && (regionOrAction === 'RUSSIA' || regionOrAction === 'BALI')) {
        await prisma.user.update({
          where: { id: user.id },
          data: { selectedRegion: regionOrAction as any } as any
        });
        await logUserAction(ctx, 'shop:region_selected', { region: regionOrAction });
        await showCategories(ctx, regionOrAction);
      }
    });

    bot.action(new RegExp(`^${CATEGORY_ACTION_PREFIX}(.+)$`), async (ctx) => {
      const match = ctx.match as RegExpExecArray;
      const categoryId = match[1];
      await ctx.answerCbQuery();

      await logUserAction(ctx, 'shop:category', { categoryId });
      await sendProductCards(ctx, categoryId);
    });

    bot.action(new RegExp(`^${PRODUCT_MORE_PREFIX}(.+)$`), async (ctx) => {
      const match = ctx.match as RegExpExecArray;
      const productId = match[1];
      await handleProductMore(ctx, productId);
    });

    bot.action(new RegExp(`^${PRODUCT_INSTRUCTION_PREFIX}(.+)$`), async (ctx) => {
      const match = ctx.match as RegExpExecArray;
      const productId = match[1];
      await handleProductInstruction(ctx, productId);
    });

    bot.action(new RegExp(`^${PRODUCT_CART_PREFIX}(.+)$`), async (ctx) => {
      const match = ctx.match as RegExpExecArray;
      const productId = match[1];
      await handleAddToCart(ctx, productId);
    });

    bot.action(new RegExp(`^${PRODUCT_BUY_PREFIX}(.+)$`), async (ctx) => {
      const match = ctx.match as RegExpExecArray;
      const productId = match[1];
      await handleBuy(ctx, productId);
    });

    // Handle cart button from shop
    bot.action('shop:cart', async (ctx) => {
      await ctx.answerCbQuery();
      await logUserAction(ctx, 'shop:cart');
      const { showCart } = await import('../cart/index.js');
      await showCart(ctx);
    });

    // Handle payment methods
    bot.action('payment:card', async (ctx) => {
      await ctx.answerCbQuery();
      await logUserAction(ctx, 'payment:card');
      // TODO: Implement card payment
      await ctx.reply('💳 Оплата картой будет доступна в ближайшее время');
    });

    bot.action('payment:crypto', async (ctx) => {
      await ctx.answerCbQuery();
      await logUserAction(ctx, 'payment:crypto');
      // TODO: Implement crypto payment
      await ctx.reply('₿ Криптовалютная оплата будет доступна в ближайшее время');
    });

    bot.action('payment:mobile', async (ctx) => {
      await ctx.answerCbQuery();
      await logUserAction(ctx, 'payment:mobile');
      // TODO: Implement mobile payment
      await ctx.reply('📱 Мобильная оплата будет доступна в ближайшее время');
    });

    // Handle payment status checks
    bot.action(/^payment:check:(.+)$/, async (ctx) => {
      const match = ctx.match as RegExpExecArray;
      const paymentId = match[1];
      const { checkPaymentStatus } = await import('../payment/index.js');
      await checkPaymentStatus(ctx, paymentId);
    });

    // Handle payment cancellation
    bot.action(/^payment:cancel:(.+)$/, async (ctx) => {
      const match = ctx.match as RegExpExecArray;
      const paymentId = match[1];
      const { cancelPayment } = await import('../payment/index.js');
      await cancelPayment(ctx, paymentId);
    });

  },
};
