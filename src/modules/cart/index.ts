import { Markup, Telegraf } from 'telegraf';
import { BotModule } from '../../bot/types.js';
import { Context } from '../../bot/context.js';
import { logUserAction, ensureUser } from '../../services/user-history.js';
import { getCartItems, cartItemsToText, clearCart, increaseProductQuantity, decreaseProductQuantity, removeProductFromCart } from '../../services/cart-service.js';
import { createOrderRequest } from '../../services/order-service.js';
import { getBotContent } from '../../services/bot-content-service.js';
import { prisma } from '../../lib/prisma.js';

export const cartModule: BotModule = {
  async register(bot: Telegraf<Context>) {
    // Handle "Корзина" button
    bot.hears(['🛍️ Корзина'], async (ctx) => {
      await logUserAction(ctx, 'menu:cart');
      await showCart(ctx);
    });

    // Handle text messages for delivery address input
    bot.on('text', async (ctx, next) => {
      const user = await ensureUser(ctx);
      if (!user) {
        await next();
        return;
      }

      const text = ctx.message?.text;
      if (!text) {
        await next();
        return;
      }

      // Check if user is waiting for address input
      if ((ctx as any).waitingForBaliAddress) {
        await handleDeliveryAddress(ctx, 'Бали', text);
        (ctx as any).waitingForBaliAddress = false;
        return;
      }

      if ((ctx as any).waitingForRussiaAddress) {
        await handleDeliveryAddress(ctx, 'Россия', text);
        (ctx as any).waitingForRussiaAddress = false;
        return;
      }

      if ((ctx as any).waitingForCustomAddress) {
        await handleDeliveryAddress(ctx, 'Произвольный', text);
        (ctx as any).waitingForCustomAddress = false;
        return;
      }

      await next();
    });
  },
};

export async function showCart(ctx: Context) {
  try {
    console.log('🛍️ Cart: Starting showCart function');

    // Get user from database to ensure we have the correct user ID format
    const user = await ensureUser(ctx);
    if (!user) {
      console.log('🛍️ Cart: Failed to ensure user');
      await ctx.reply('❌ Ошибка загрузки корзины. Попробуйте позже.');
      return;
    }

    const userId = user.id;
    console.log('🛍️ Cart: User ID:', userId);

    console.log('🛍️ Cart: Getting cart items for user:', userId);
    const cartItems = await getCartItems(userId);
    console.log('🛍️ Cart: Found cart items:', cartItems.length);

    if (cartItems.length === 0) {
      const emptyCartMessage = await getBotContent('cart_empty_message') || '🛍️ Ваша корзина пуста\n\nДобавьте товары из магазина!';
      await ctx.reply(emptyCartMessage, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🛒 Перейти в магазин',
                callback_data: 'cart:go_to_shop',
              },
            ],
          ],
        },
      });
      return;
    }

    // Send each cart item separately with quantity controls
    for (const item of cartItems) {
      const price = item.product.price;
      const priceRub = price * 100;
      const itemTotal = priceRub * item.quantity;
      const itemText = `🛍️ ${item.product.title}\n📦 Количество: ${item.quantity}\n💰 Цена: ${priceRub.toFixed(0)} ₽\n💵 Итого: ${itemTotal.toFixed(0)} ₽`;

      await ctx.reply(itemText, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '➖ Убрать 1',
                callback_data: `cart:decrease:${item.productId}`,
              },
              {
                text: '➕ Добавить 1',
                callback_data: `cart:increase:${item.productId}`,
              },
            ],
            [
              {
                text: '🗑️ Удалить товар',
                callback_data: `cart:remove:${item.productId}`,
              },
            ],
          ],
        },
      });
    }

    // Send total and action buttons
    const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    await ctx.reply(`💰 Итого к оплате: ${(total * 100).toFixed(0)} ₽`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '💳 Оформить заказ',
              callback_data: 'cart:checkout',
            },
          ],
          [
            {
              text: '🗑️ Очистить корзину',
              callback_data: 'cart:clear',
            },
          ],
          [
            {
              text: '🛒 Продолжить покупки',
              callback_data: 'cart:continue_shopping',
            },
          ],
        ],
      },
    });
  } catch (error) {
    console.error('🛍️ Cart: Error showing cart:', error);
    console.error('🛍️ Cart: Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    await ctx.reply('❌ Ошибка загрузки корзины. Попробуйте позже.');
  }
}

// Handle cart actions
export function registerCartActions(bot: Telegraf<Context>) {
  // Go to shop
  bot.action('cart:go_to_shop', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'cart:go_to_shop');

    const user = await ensureUser(ctx);
    if (user && (user as any).selectedRegion) {
      // User has region selected, show categories directly
      const { showCategories } = await import('../shop/index.js');
      await showCategories(ctx, (user as any).selectedRegion);
    } else {
      // User needs to select region first
      const { showRegionSelection } = await import('../shop/index.js');
      await showRegionSelection(ctx);
    }
  });

  // Continue shopping
  bot.action('cart:continue_shopping', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'cart:continue_shopping');

    const user = await ensureUser(ctx);
    if (user && (user as any).selectedRegion) {
      // User has region selected, show categories directly
      const { showCategories } = await import('../shop/index.js');
      await showCategories(ctx, (user as any).selectedRegion);
    } else {
      // User needs to select region first
      const { showRegionSelection } = await import('../shop/index.js');
      await showRegionSelection(ctx);
    }
  });

  // Clear cart
  bot.action('cart:clear', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'cart:clear');

    const user = await ensureUser(ctx);
    if (!user) {
      await ctx.reply('❌ Ошибка загрузки корзины. Попробуйте позже.');
      return;
    }
    const userId = user.id;

    await clearCart(userId);
    await ctx.reply('🗑️ Корзина очищена');
  });

  // Checkout
  bot.action('cart:checkout', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'cart:checkout');

    const user = await ensureUser(ctx);
    if (!user) {
      await ctx.reply('❌ Ошибка загрузки корзины. Попробуйте позже.');
      return;
    }
    const userId = user.id;

    try {
      console.log('🛒 CART CHECKOUT: Starting checkout for user:', userId, user.firstName, user.username);

      const cartItems = await getCartItems(userId);

      if (cartItems.length === 0) {
        const emptyCartMessage = await getBotContent('cart_empty_message') || '🛍️ Ваша корзина пуста';
        await ctx.reply(emptyCartMessage);
        return;
      }

      console.log('🛒 CART CHECKOUT: Found cart items:', cartItems.length);

      // Create order in database
      const itemsPayload = cartItems.map((item: any) => ({
        productId: item.productId,
        title: item.product.title,
        price: Number(item.product.price),
        quantity: item.quantity,
      }));

      console.log('🛒 CART CHECKOUT: Creating order request...');
      const order = await createOrderRequest({
        userId: userId,
        message: `Заказ через корзину от ${user.firstName || 'Пользователь'}`,
        items: itemsPayload,
      });
      console.log('✅ CART CHECKOUT: Order request created successfully');

      // Check partner activation status
      const partnerProfile = await prisma.partnerProfile.findUnique({
        where: { userId },
        select: { isActive: true },
      });
      const isPartner = !!(partnerProfile?.isActive);

      const cartText = cartItemsToText(cartItems, { isPartner });

      // Get user data for phone and address
      const userData = await prisma.user.findUnique({
        where: { id: userId }
      });

      let contactInfo = `📞 Свяжитесь с покупателем: @${ctx.from?.username || 'нет username'}`;
      if (userData?.phone) {
        contactInfo += `\n📱 Телефон: ${userData.phone}`;
      }
      if (userData?.deliveryAddress) {
        contactInfo += `\n📍 Адрес доставки: ${userData.deliveryAddress}`;
      }

      const total = cartItems.reduce((sum: any, item: any) => sum + Number(item.product.price) * Number(item.quantity), 0);
      const totalRub = Math.round(total * 100);
      const orderText = `🛍️ Новый заказ от ${ctx.from?.first_name || 'Пользователь'}\n\n${cartText}\n\n💰 Итого: ${totalRub} ₽\n\n${contactInfo}`;

      // Send order to all admins with contact button
      const { getBotInstance } = await import('../../lib/bot-instance.js');
      const { getAdminChatIds } = await import('../../config/env.js');
      const bot = await getBotInstance();

      if (bot) {
        const adminIds = getAdminChatIds();

        const orderMessage = `🛍️ <b>Новый заказ от пользователя</b>\n\n${orderText}`;

        // Send to all admins
        for (const adminId of adminIds) {
          try {
            await bot.telegram.sendMessage(adminId, orderMessage, {
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
                      callback_data: `admin_reply:${ctx.from?.id}:${(ctx.from?.first_name || 'User').slice(0, 20)}`
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

      // Clear cart after successful order
      await clearCart(userId);

      const orderSuccessMessage = await getBotContent('order_success_message') || '✅ Заказ отправлен! Мы свяжемся с вами в ближайшее время.';
      await ctx.reply(orderSuccessMessage);

      // Check if user has phone and address
      if (userData?.phone && userData?.deliveryAddress) {
        // User has both phone and address - show confirmation
        await ctx.reply(`📍 Вам доставить на этот адрес?\n\n${userData.deliveryAddress}`, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ Да, доставить сюда',
                  callback_data: 'delivery:confirm_existing',
                },
              ],
              [
                {
                  text: '✏️ Изменить адрес',
                  callback_data: 'delivery:change',
                },
              ],
            ],
          },
        });
      } else if (userData?.phone) {
        // User has phone but no address - ask for address
        await ctx.reply('📍 Теперь укажите адрес доставки:', {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📍 Адрес доставки',
                  callback_data: 'delivery:address',
                },
              ],
            ],
          },
        });
      } else {
        // User has no phone - ask for contact first
        await ctx.reply('📞 Для быстрой связи поделитесь своим номером телефона:', {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📞 Поделиться контактом',
                  callback_data: 'contact:share',
                },
              ],
              [
                {
                  text: '⏭️ Пропустить',
                  callback_data: 'contact:skip',
                },
              ],
            ],
          },
        });
      }
    } catch (error) {
      console.error('❌ CART CHECKOUT: Error processing checkout:', error);
      await ctx.reply('❌ Ошибка оформления заказа. Попробуйте позже.');
    }
  });

  // Handle increase quantity
  bot.action(/^cart:increase:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'cart:increase');

    const match = ctx.match as RegExpExecArray;
    const productId = match[1];

    const user = await ensureUser(ctx);
    if (!user) {
      await ctx.reply('❌ Ошибка загрузки корзины. Попробуйте позже.');
      return;
    }
    const userId = user.id;

    try {
      await increaseProductQuantity(userId, productId);
      await ctx.reply('✅ Количество увеличено!');
      // Refresh cart display
      await showCart(ctx);
    } catch (error) {
      console.error('Error increasing quantity:', error);
      await ctx.reply('❌ Ошибка изменения количества. Попробуйте позже.');
    }
  });

  // Handle decrease quantity
  bot.action(/^cart:decrease:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'cart:decrease');

    const match = ctx.match as RegExpExecArray;
    const productId = match[1];

    const user = await ensureUser(ctx);
    if (!user) {
      await ctx.reply('❌ Ошибка загрузки корзины. Попробуйте позже.');
      return;
    }
    const userId = user.id;

    try {
      await decreaseProductQuantity(userId, productId);
      await ctx.reply('✅ Количество уменьшено!');
      // Refresh cart display
      await showCart(ctx);
    } catch (error) {
      console.error('Error decreasing quantity:', error);
      await ctx.reply('❌ Ошибка изменения количества. Попробуйте позже.');
    }
  });

  // Handle remove product
  bot.action(/^cart:remove:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'cart:remove');

    const match = ctx.match as RegExpExecArray;
    const productId = match[1];

    const user = await ensureUser(ctx);
    if (!user) {
      await ctx.reply('❌ Ошибка загрузки корзины. Попробуйте позже.');
      return;
    }
    const userId = user.id;

    try {
      await removeProductFromCart(userId, productId);
      await ctx.reply('✅ Товар удален из корзины!');
      // Refresh cart display
      await showCart(ctx);
    } catch (error) {
      console.error('Error removing product:', error);
      await ctx.reply('❌ Ошибка удаления товара. Попробуйте позже.');
    }
  });

  // Delivery address handlers
  bot.action('delivery:address', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'delivery:address');

    const user = await ensureUser(ctx);
    if (!user) {
      await ctx.reply('❌ Ошибка. Попробуйте позже.');
      return;
    }

    // Check if user already has a delivery address
    if ((user as any).deliveryAddress) {
      const [addressType, ...addressParts] = (user as any).deliveryAddress.split(': ');
      const address = addressParts.join(': ');

      await ctx.reply(`📍 Ваш текущий адрес доставки:\n\nТип: ${addressType}\nАдрес: ${address}`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✏️ Изменить адрес',
                callback_data: 'delivery:change',
              },
            ],
            [
              {
                text: '✅ Использовать этот адрес',
                callback_data: 'delivery:use_existing',
              },
            ],
          ],
        },
      });
    } else {
      await ctx.reply('📍 Выберите тип адреса доставки:', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🇮🇩 Бали - район и вилла',
                callback_data: 'delivery:bali',
              },
            ],
            [
              {
                text: '🇷🇺 РФ - город и адрес',
                callback_data: 'delivery:russia',
              },
            ],
            [
              {
                text: '✏️ Ввести свой вариант',
                callback_data: 'delivery:custom',
              },
            ],
          ],
        },
      });
    }
  });

  bot.action('delivery:bali', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'delivery:bali');

    await ctx.reply(
      '🇮🇩 Укажите адрес для Бали:\n\n' +
      'Напишите район и название виллы (например: "Семиньяк, Villa Seminyak Resort")\n\n' +
      'Или пришлите ссылку на Google Maps с адресом.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔙 Назад к выбору',
                callback_data: 'delivery:address',
              },
            ],
          ],
        },
      },
    );

    // Store state to wait for text input
    (ctx as any).waitingForBaliAddress = true;
  });

  bot.action('delivery:russia', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'delivery:russia');

    await ctx.reply(
      '🇷🇺 Укажите адрес для России:\n\n' +
      'Напишите ваш город и точный адрес (например: "Москва, ул. Тверская, д. 10, кв. 5")',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔙 Назад к выбору',
                callback_data: 'delivery:address',
              },
            ],
          ],
        },
      },
    );

    // Store state to wait for text input
    (ctx as any).waitingForRussiaAddress = true;
  });

  bot.action('delivery:custom', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'delivery:custom');

    await ctx.reply(
      '✏️ Введите свой вариант адреса:\n\n' +
      'Напишите полный адрес доставки в произвольной форме.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔙 Назад к выбору',
                callback_data: 'delivery:address',
              },
            ],
          ],
        },
      },
    );

    // Store state to wait for text input
    (ctx as any).waitingForCustomAddress = true;
  });

  bot.action('delivery:confirmed', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'delivery:confirmed');

    await ctx.reply('✅ Отлично! Ваш адрес доставки принят и сохранен.\n\n📦 Мы учтем его при отправке вашего заказа.\n\nСпасибо за предоставленную информацию!');
  });

  bot.action('delivery:change', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'delivery:change');

    await ctx.reply('📍 Выберите тип адреса доставки:', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🇮🇩 Бали - район и вилла',
              callback_data: 'delivery:bali',
            },
          ],
          [
            {
              text: '🇷🇺 РФ - город и адрес',
              callback_data: 'delivery:russia',
            },
          ],
          [
            {
              text: '✏️ Ввести свой вариант',
              callback_data: 'delivery:custom',
            },
          ],
        ],
      },
    });
  });

  bot.action('delivery:use_existing', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'delivery:use_existing');

    await ctx.reply('✅ Отлично! Будем использовать ваш сохраненный адрес доставки.');
  });

  bot.action('delivery:confirm_existing', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'delivery:confirm_existing');

    await ctx.reply('✅ Отлично! Заказ будет доставлен по указанному адресу.');
  });

  // Contact sharing handlers
  bot.action('contact:share', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'contact:share');

    await ctx.reply('📞 Нажмите кнопку ниже, чтобы поделиться своим номером телефона:', {
      reply_markup: {
        keyboard: [
          [
            {
              text: '📞 Поделиться номером телефона',
              request_contact: true,
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  });

  bot.action('contact:skip', async (ctx) => {
    await ctx.answerCbQuery();
    await logUserAction(ctx, 'contact:skip');

    await ctx.reply('✅ Хорошо, переходим к указанию адреса доставки.');

    // Ask for delivery address
    await ctx.reply('📍 Укажите адрес доставки:', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📍 Адрес доставки',
              callback_data: 'delivery:address',
            },
          ],
        ],
      },
    });
  });

  // Handle contact sharing
  bot.on('contact', async (ctx) => {
    await logUserAction(ctx, 'contact:received');

    const user = await ensureUser(ctx);
    if (!user) {
      await ctx.reply('❌ Ошибка обработки контакта. Попробуйте позже.');
      return;
    }

    const contact = ctx.message.contact;
    const phoneNumber = contact.phone_number;

    try {
      // Save phone number to user profile
      await prisma.user.update({
        where: { id: user.id },
        data: { phone: phoneNumber },
      });

      console.log(`📞 Contact received from user ${user.id}: ${phoneNumber}`);

      await ctx.reply('✅ Спасибо! Ваш номер телефона сохранен.');

      // Now ask for delivery address
      await ctx.reply('📍 Теперь укажите адрес доставки:', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📍 Адрес доставки',
                callback_data: 'delivery:address',
              },
            ],
          ],
        },
      });

    } catch (error) {
      console.error('❌ Error saving contact:', error);
      await ctx.reply('❌ Ошибка сохранения номера телефона. Попробуйте позже.');
    }
  });
}

// Handle delivery address input
async function handleDeliveryAddress(ctx: Context, addressType: string, address: string) {
  try {
    const user = await ensureUser(ctx);
    if (!user) {
      await ctx.reply('❌ Ошибка. Попробуйте позже.');
      return;
    }

    // Save address to database
    const { prisma } = await import('../../lib/prisma.js');
    const fullAddress = `${addressType}: ${address}`;

    await prisma.user.update({
      where: { id: user.id },
      data: { deliveryAddress: fullAddress }
    });

    const addressText = `✅ Ваш адрес принят!\n\n📍 Адрес доставки:\nТип: ${addressType}\nАдрес: ${address}`;

    await ctx.reply(addressText, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '✅ Адрес принят',
              callback_data: 'delivery:confirmed',
            },
          ],
          [
            {
              text: '✏️ Изменить адрес',
              callback_data: 'delivery:address',
            },
          ],
        ],
      },
    });

    // Send address to admins
    const adminMessage = `📍 НОВЫЙ АДРЕС ДОСТАВКИ\n\n👤 Пользователь: ${user.firstName || 'Без имени'} ${user.lastName || ''} (@${user.username || 'нет username'})\n📱 Telegram ID: ${user.telegramId}\n\n📍 Адрес доставки:\nТип: ${addressType}\nАдрес: ${address}\n\n✅ Адрес принят и сохранен в системе`;

    const { sendToAllAdmins } = await import('../../config/env.js');
    await sendToAllAdmins(ctx, adminMessage);

    await logUserAction(ctx, `delivery:address_saved:${addressType}`);
  } catch (error) {
    console.error('❌ Error handling delivery address:', error);
    await ctx.reply('❌ Ошибка сохранения адреса. Попробуйте позже.');
  }
}
