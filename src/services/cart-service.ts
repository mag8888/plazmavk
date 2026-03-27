import { prisma } from '../lib/prisma.js';

export async function getCartItems(userId: string) {
  try {
    const items = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            summary: true,
            description: true,
            isActive: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Фильтруем и удаляем товары, которые были удалены или деактивированы
    const validItems = [];
    const invalidItemIds = [];

    for (const item of items) {
      if (item.product && item.product.isActive) {
        validItems.push(item);
      } else {
        invalidItemIds.push(item.id);
      }
    }

    // Удаляем невалидные товары из корзины
    if (invalidItemIds.length > 0) {
      try {
        await prisma.cartItem.deleteMany({
          where: {
            id: { in: invalidItemIds }
          }
        });
        console.log(`🧹 Removed ${invalidItemIds.length} invalid cart items`);
      } catch (deleteError) {
        console.error('Error removing invalid cart items:', deleteError);
        // Продолжаем даже если не удалось удалить
      }
    }

    return validItems;
  } catch (error: any) {
    console.error('❌ Error in getCartItems:', error);
    if (error?.code === 'P2031' || error?.message?.includes('replica set')) {
      console.warn('⚠️  MongoDB replica set not configured');
      return [];
    }
    throw error;
  }
}

export async function addProductToCart(userId: string, productId: string) {
  // REFACTOR: Explicit check to avoid "Replica Set" transaction requirement
  const existing = await prisma.cartItem.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: { increment: 1 } },
    });
  } else {
    return prisma.cartItem.create({
      data: {
        userId,
        productId,
        quantity: 1,
      },
    });
  }
}

export async function clearCart(userId: string) {
  await prisma.cartItem.deleteMany({ where: { userId } });
}

export async function increaseProductQuantity(userId: string, productId: string) {
  // REFACTOR: Explicit check to avoid "Replica Set" transaction requirement
  const existing = await prisma.cartItem.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: { increment: 1 } },
    });
  } else {
    return prisma.cartItem.create({
      data: {
        userId,
        productId,
        quantity: 1,
      },
    });
  }
}

export async function decreaseProductQuantity(userId: string, productId: string) {
  const item = await prisma.cartItem.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  if (!item) {
    return null;
  }

  if (item.quantity <= 1) {
    // Remove item if quantity becomes 0 or less
    await prisma.cartItem.delete({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
    return null;
  }

  return prisma.cartItem.update({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
    data: {
      quantity: {
        decrement: 1,
      },
    },
  });
}

export async function removeProductFromCart(userId: string, productId: string) {
  return prisma.cartItem.delete({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });
}

export function cartItemsToText(
  items: Array<{ product: { title: string; price: number }; quantity: number }>,
  { isPartner = false }: { isPartner?: boolean } = {}
) {
  if (items.length === 0) {
    return 'Корзина пуста.';
  }

  // price in DB is stored in PZ, 1 PZ = 100 ₽
  const toRub = (pz: number) => pz * 100;
  const fmt = (rub: number) => `${rub.toFixed(0)} ₽`;

  const lines: string[] = items.map((item, i) => {
    const pz = Number(item.product.price);
    const priceRub = toRub(pz);
    const totalRub = priceRub * item.quantity;
    return `${i + 1}. ${item.product.title} — ${item.quantity} шт. × ${fmt(priceRub)} = ${fmt(totalRub)}`;
  });

  const totalPz = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const totalRub = toRub(totalPz);

  lines.push('');
  lines.push(`💰 Итого: ${fmt(totalRub)}`);

  if (isPartner) {
    const bonus = totalRub * 0.1;
    const toPay = totalRub - bonus;
    lines.push(`🤝 Партнёрский бонус (10%): ${fmt(bonus)}`);
    lines.push(`💳 К оплате: ${fmt(toPay)}`);
  }

  return lines.join('\n');
}

