import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

function generateReferralCode() {
  return `PW${randomBytes(3).toString('hex').toUpperCase()}`;
}

async function ensureReferralCode(): Promise<string> {
  // ensure uniqueness
  while (true) {
    const code = generateReferralCode();
    const exists = await prisma.partnerProfile.findFirst({ where: { referralCode: code } });
    if (!exists) {
      return code;
    }
  }
}

import { PartnerProgramType, TransactionType } from '@prisma/client';

export async function getOrCreatePartnerProfile(userId: string, programType: PartnerProgramType = PartnerProgramType.DIRECT) {
  const existing = await prisma.partnerProfile.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  const referralCode = await ensureReferralCode();
  return prisma.partnerProfile.create({
    data: {
      userId,
      programType,
      referralCode,
      isActive: false, // По умолчанию неактивен
    },
  });
}

export async function activatePartnerProfile(userId: string, activationType: 'PURCHASE' | 'ADMIN', months: number = 2) {
  const profile = await prisma.partnerProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new Error('Partner profile not found');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000); // Добавляем месяцы

  return prisma.partnerProfile.update({
    where: { userId },
    data: {
      isActive: true,
      activatedAt: now,
      expiresAt,
      activationType,
    },
  });
}

export async function checkPartnerActivation(userId: string): Promise<boolean> {
  const profile = await prisma.partnerProfile.findUnique({ where: { userId } });
  if (!profile) return false;

  // Проверяем, активен ли профиль и не истек ли срок
  if (!profile.isActive) return false;

  // КРИТИЧНО: Если активация от админа, не проверяем и не деактивируем по истечению срока
  // Админ имеет полный контроль через галочку в админ-панели
  if (profile.activationType === 'ADMIN') {
    return true;
  }

  // Для активаций через покупку проверяем срок действия
  if (profile.expiresAt && new Date() > profile.expiresAt) {
    // Автоматически деактивируем истекший профиль
    await prisma.partnerProfile.update({
      where: { userId },
      data: { isActive: false }
    });
    return false;
  }

  return true;
}

export function buildReferralLink(code: string, programType: 'DIRECT' | 'MULTI_LEVEL', _username?: string) {
  const botUsername = (env.botUsername || 'PLAZMA_test8_bot').replace(/^@/, '');
  const prefix = programType === 'DIRECT' ? 'ref_direct' : 'ref_multi';
  /** Ссылка с кодом реферала — при переходе бот получит start=ref_direct_PWXXX и засчитает приглашение */
  const main = `https://t.me/${botUsername}?start=${prefix}_${code}`;
  const webappBase = env.webappBaseUrl || 'https://plazma.up.railway.app/webapp';
  const webapp = `${webappBase.replace(/\/$/, '')}?ref=${code}`;
  return { main, webapp, old: main, new: main };
}

export async function extendPartnerProfile(userId: string, days: number = 30) {
  const profile = await prisma.partnerProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new Error('Partner profile not found');
  }

  const now = new Date();
  // Если профиль активен и срок не истек - добавляем к текущей дате окончания
  // Если профиль не активен или срок истек - добавляем к текущему моменту
  let newExpiresAt = profile.expiresAt && profile.isActive && profile.expiresAt > now
    ? new Date(profile.expiresAt.getTime() + days * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return prisma.partnerProfile.update({
    where: { userId },
    data: {
      isActive: true, // Ensure active
      expiresAt: newExpiresAt,
      // Если профиль был неактивен, обновляем дату активации
      activatedAt: (!profile.isActive) ? now : undefined,
    },
  });
}

/**
 * Check for partners expiring in specific day ranges (10, 3, 1)
 * Returns array of { userId, telegramId, daysLeft, expiresAt }
 */
export async function checkExpiringPartners() {
  const now = new Date();

  // Find active partners with expiration date
  const partners = await prisma.partnerProfile.findMany({
    where: {
      isActive: true,
      expiresAt: {
        gt: now, // Not yet expired
      }
    },
    include: {
      user: true
    }
  });

  const notifications = [];

  for (const p of partners) {
    if (!p.expiresAt) continue;

    const diffTime = p.expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Check for exact days match (10, 3, 1) to send notification
    if ([10, 3, 1].includes(diffDays)) {
      notifications.push({
        userId: p.userId,
        telegramId: p.user?.telegramId,
        daysLeft: diffDays,
        expiresAt: p.expiresAt
      });
    }
  }

  return notifications;
}

export async function getPartnerDashboard(userId: string) {
  const profile = await prisma.partnerProfile.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      referrals: true,
    },
  });

  if (!profile) return null;

  const partners = await prisma.partnerReferral.count({ where: { profileId: profile.id } });

  return {
    profile,
    stats: {
      partners,
      directPartners: await prisma.partnerReferral.count({ where: { profileId: profile.id, level: 1 } }),
      multiPartners: await prisma.partnerReferral.count({ where: { profileId: profile.id, level: 2 } }),
    },
  };
}

export async function getPartnerList(userId: string) {
  const profile = await prisma.partnerProfile.findUnique({
    where: { userId },
  });

  if (!profile) return null;

  // Get direct partners (level 1) - users who were referred by this partner
  const directReferrals = await prisma.partnerReferral.findMany({
    where: {
      profileId: profile.id,
      level: 1
    },
    include: {
      profile: {
        include: {
          user: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Get multi-level partners (level 2 and 3) - users referred by direct partners
  const multiReferrals = await prisma.partnerReferral.findMany({
    where: {
      profileId: profile.id,
      level: { gt: 1 }
    },
    include: {
      profile: {
        include: {
          user: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Get actual users who were referred with their referral data
  const directPartnerData = directReferrals
    .filter(ref => ref.referredId)
    .map(ref => ({
      user: null as any, // Will be filled below
      level: ref.level,
      joinedAt: ref.createdAt
    }));

  const multiPartnerData = multiReferrals
    .filter(ref => ref.referredId)
    .map(ref => ({
      user: null as any, // Will be filled below
      level: ref.level,
      joinedAt: ref.createdAt
    }));

  // Get users for direct partners
  const directUserIds = directReferrals.map(ref => ref.referredId).filter(Boolean) as string[];
  const directUsers = await prisma.user.findMany({
    where: { id: { in: directUserIds } }
  });

  // Get users for multi-level partners
  const multiUserIds = multiReferrals.map(ref => ref.referredId).filter(Boolean) as string[];
  const multiUsers = await prisma.user.findMany({
    where: { id: { in: multiUserIds } }
  });

  // Combine user data with referral data, removing duplicates
  const directPartnersMap = new Map();
  directReferrals
    .filter(ref => ref.referredId)
    .forEach(ref => {
      const user = directUsers.find(u => u.id === ref.referredId);
      if (user && !directPartnersMap.has(user.id)) {
        directPartnersMap.set(user.id, {
          id: user.id,
          firstName: user.firstName || 'Пользователь',
          username: user.username,
          telegramId: user.telegramId,
          level: ref.level,
          joinedAt: ref.createdAt
        });
      }
    });

  const multiPartnersMap = new Map();
  multiReferrals
    .filter(ref => ref.referredId)
    .forEach(ref => {
      const user = multiUsers.find(u => u.id === ref.referredId);
      if (user && !multiPartnersMap.has(user.id)) {
        multiPartnersMap.set(user.id, {
          id: user.id,
          firstName: user.firstName || 'Пользователь',
          username: user.username,
          telegramId: user.telegramId,
          level: ref.level,
          joinedAt: ref.createdAt
        });
      }
    });

  const directPartners = Array.from(directPartnersMap.values());
  const multiPartners = Array.from(multiPartnersMap.values());

  return {
    directPartners,
    multiPartners
  };
}

export async function recordPartnerTransaction(profileId: string, amount: number, description: string, type: TransactionType = TransactionType.CREDIT) {
  // Get partner profile to access userId
  const profile = await prisma.partnerProfile.findUnique({
    where: { id: profileId },
    select: { userId: true }
  });

  if (!profile) {
    throw new Error(`Partner profile not found: ${profileId}`);
  }

  // Create transaction
  const transaction = await prisma.partnerTransaction.create({
    data: {
      profileId,
      amount,
      description,
      type,
    },
  });

  // Update user balance if this is a CREDIT transaction
  if (type === TransactionType.CREDIT) {
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        balance: {
          increment: amount
        }
      }
    });
    console.log(`✅ Incremented user ${profile.userId} balance by ${amount} PZ`);
  } else if (type === 'DEBIT') {
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        balance: {
          decrement: amount
        }
      }
    });
    console.log(`✅ Decremented user ${profile.userId} balance by ${amount} PZ`);
  }

  // Recalculate total bonus and balance from all transactions (only for PartnerProfile, not User)
  await recalculatePartnerBonuses(profileId);

  return transaction;
}

export async function recalculatePartnerBonuses(profileId: string) {
  console.log(`🔄 Starting bonus recalculation for profile ${profileId}...`);

  const allTransactions = await prisma.partnerTransaction.findMany({
    where: { profileId }
  });

  console.log(`📊 Found ${allTransactions.length} transactions for profile ${profileId}`);

  const totalBonus = allTransactions.reduce((sum, tx) => {
    const amount = tx.type === TransactionType.CREDIT ? tx.amount : -tx.amount;
    console.log(`  - Transaction: ${tx.type} ${tx.amount} PZ (${tx.description})`);
    return sum + amount;
  }, 0);

  console.log(`💰 Total calculated bonus: ${totalBonus} PZ`);

  // Update both balance and bonus fields in PartnerProfile
  const updatedProfile = await prisma.partnerProfile.update({
    where: { id: profileId },
    data: {
      balance: totalBonus,  // Balance = total bonuses
      bonus: totalBonus     // Bonus = total bonuses (for display)
    }
  });

  // NOTE: We do NOT update user.balance here to avoid overwriting it
  // user.balance should be managed separately (increments/decrements)
  // partnerProfile.balance is only for partner program display

  // Get current user balance for logging
  const currentUser = await prisma.user.findUnique({
    where: { id: updatedProfile.userId },
    select: { balance: true }
  });

  console.log(`✅ Updated profile ${profileId}: balance = ${updatedProfile.balance} PZ, bonus = ${updatedProfile.bonus} PZ`);
  console.log(`✅ User ${updatedProfile.userId} current balance: ${currentUser?.balance || 0} PZ (not overwritten)`);
  return totalBonus;
}

// Функция для поиска всей цепочки партнеров
async function findAllPartnerChain(orderUserId: string) {
  const allReferrals = [];

  // Ищем прямых партнеров (уровень 1)
  const level1Referrals = await prisma.partnerReferral.findMany({
    where: { referredId: orderUserId },
    include: {
      profile: {
        include: { user: true }
      }
    }
  });

  for (const referral of level1Referrals) {
    allReferrals.push({
      ...referral,
      level: 1
    });

    // Ищем партнеров 2-го уровня (партнеры партнера)
    const level2Referrals = await prisma.partnerReferral.findMany({
      where: { referredId: referral.profile.userId },
      include: {
        profile: {
          include: { user: true }
        }
      }
    });

    for (const level2Referral of level2Referrals) {
      allReferrals.push({
        ...level2Referral,
        level: 2
      });

      // Ищем партнеров 3-го уровня (партнеры партнера партнера)
      const level3Referrals = await prisma.partnerReferral.findMany({
        where: { referredId: level2Referral.profile.userId },
        include: {
          profile: {
            include: { user: true }
          }
        }
      });

      for (const level3Referral of level3Referrals) {
        allReferrals.push({
          ...level3Referral,
          level: 3
        });
      }
    }
  }

  return allReferrals;
}

// Новая функция для расчета бонусов по двойной системе
export async function calculateDualSystemBonuses(orderUserId: string, orderAmount: number, orderId?: string) {
  console.log(`🎯 Calculating dual system bonuses for order ${orderAmount} PZ by user ${orderUserId}`);

  // Проверяем, не были ли уже начислены бонусы за этот заказ
  if (orderId) {
    // Ищем все записи о бонусах для этого пользователя
    const existingBonuses = await prisma.userHistory.findMany({
      where: {
        userId: orderUserId,
        action: 'REFERRAL_BONUS'
      }
    });

    // Проверяем, есть ли уже бонусы за этот заказ
    const hasExistingBonus = existingBonuses.some(bonus => {
      try {
        const payload = bonus.payload as any;
        return payload && payload.orderId === orderId;
      } catch (e) {
        return false;
      }
    });

    if (hasExistingBonus) {
      console.log(`⚠️ Bonuses already distributed for order ${orderId}, skipping...`);
      return [];
    }
  }

  // Находим всех партнеров в цепочке, которые могут получить бонусы
  const allPartnerReferrals = await findAllPartnerChain(orderUserId);

  if (allPartnerReferrals.length === 0) {
    console.log(`❌ No partner referrals found for user ${orderUserId}`);
    return;
  }

  console.log(`🔍 Found ${allPartnerReferrals.length} partners in chain for user ${orderUserId}`);

  const bonuses = [];

  for (const referral of allPartnerReferrals) {
    const partnerProfile = referral.profile;

    // Проверяем, активен ли партнерский профиль
    const isActive = await checkPartnerActivation(partnerProfile.userId);

    let bonusAmount = 0;
    let description = '';

    if (referral.level === 1) {
      // Прямой реферал: 0% для неактивных (только уведомление), 15% для активных
      if (!isActive) {
        bonusAmount = 0;
      } else {
        bonusAmount = orderAmount * 0.15;
        description = `Бонус за заказ прямого реферала (${orderAmount} PZ) - 15%`;
      }
    } else if (referral.level === 2) {
      // Уровень 2: только для Супер партнёров — 10%
      if (!isActive) {
        console.log(`ℹ️ Level 2 skip: partner not active`);
        continue;
      }
      // Check if this partner is a super partner
      const fullProfile = await prisma.partnerProfile.findUnique({
        where: { id: partnerProfile.id },
        select: { isSuperPartner: true }
      });
      if (!fullProfile?.isSuperPartner) {
        console.log(`ℹ️ Level 2 skip: not a super partner`);
        continue;
      }
      bonusAmount = orderAmount * 0.10;
      description = `Бонус за заказ реферала 2-го уровня (${orderAmount} PZ) - 10% (Супер партнёр)`;
    } else {
      // Уровни 3+ отключены
      console.log(`ℹ️ Level ${referral.level} bonus skipped`);
      continue;
    }

    if (bonusAmount > 0) {
      // Добавляем бонус партнеру
      await recordPartnerTransaction(
        partnerProfile.id,
        bonusAmount,
        description,
        'CREDIT'
      );

      // Добавляем запись в историю пользователя
      await prisma.userHistory.create({
        data: {
          userId: partnerProfile.userId,
          action: 'REFERRAL_BONUS',
          payload: {
            amount: bonusAmount,
            orderAmount,
            level: referral.level,
            referredUserId: orderUserId,
            orderId: orderId || null,
            type: 'DUAL_SYSTEM'
          }
        }
      });

      bonuses.push({
        partnerId: partnerProfile.userId,
        partnerName: partnerProfile.user.firstName || 'Партнер',
        level: referral.level,
        amount: bonusAmount,
        description
      });

      console.log(`✅ Added ${bonusAmount} PZ bonus to partner ${partnerProfile.userId} (level ${referral.level})`);

      // Отправляем уведомление партнеру о пополнении баланса
      try {
        const { getBotInstance } = await import('../lib/bot-instance.js');
        const bot = await getBotInstance();

        // Проверяем, активна ли партнерка
        const isPartnerActive = await checkPartnerActivation(partnerProfile.userId);
        let notificationMessage = '';

        if (isPartnerActive) {
          // Если партнерка активна - показываем 15%
          notificationMessage = `🎉 Ваш счет пополнен на сумму ${bonusAmount.toFixed(2)} PZ (15%) от покупки вашего реферала!`;
          await bot.telegram.sendMessage(partnerProfile.user.telegramId, notificationMessage);
          console.log(`📱 Notification sent to partner ${partnerProfile.userId} about ${bonusAmount.toFixed(2)} PZ bonus`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to send notification to partner ${partnerProfile.userId}:`, error);
      }
    } else if (!isActive && referral.level === 1) {
      // INACTIVE PARTNER NOTIFICATION
      try {
        const { getBotInstance } = await import('../lib/bot-instance.js');
        const bot = await getBotInstance();

        // Calculate potential missed bonus (15%)
        const potentialBonus = orderAmount * 0.15;

        const msg = `⚠️ Вы пропустили бонус от заказа вашего партнера, так как ваша партнёрская программа не активна.\n\n` +
          `💡 Для получения бонусов от ваших партнеров активируйте партнёрскую программу — сделайте заказ на 12 000 ₽.\n\n` +
          `(При активной партнёрской программе ваш сегодняшний бонус мог бы составить ${potentialBonus.toLocaleString('ru-RU')} PZ)`;

        await bot.telegram.sendMessage(partnerProfile.user.telegramId, msg);
        console.log(`📱 Sent MISSED bonus notification to ${partnerProfile.userId} (potential: ${potentialBonus} PZ)`);
      } catch (e) {
        console.error('Failed to send missed bonus notification', e);
      }
    }
  }

  console.log(`🎉 Total bonuses distributed: ${bonuses.length} partners, ${bonuses.reduce((sum, b) => sum + b.amount, 0)} PZ`);
  return bonuses;
}

export async function createPartnerReferral(profileId: string, level: number, referredId?: string, contact?: string, referralType: 'DIRECT' | 'MULTI_LEVEL' = 'DIRECT') {
  // Check for self-referral if referredId is provided
  if (referredId) {
    const profile = await prisma.partnerProfile.findUnique({
      where: { id: profileId },
      select: { userId: true }
    });

    if (profile && profile.userId === referredId) {
      console.warn(`⚠️ Attempted self-referral blocked: profileId=${profileId}, userId=${profile.userId}, referredId=${referredId}`);
      return null;
    }

    // Check if referral already exists
    const existingReferral = await prisma.partnerReferral.findFirst({
      where: {
        profileId,
        referredId,
        level
      }
    });

    if (existingReferral) {
      console.log(`🔄 Referral already exists: profileId=${profileId}, referredId=${referredId}`);
      return existingReferral;
    }
  }

  return prisma.partnerReferral.create({
    data: {
      profileId,
      level,
      referredId,
      contact,
      referralType,
    },
  });
}

export async function upsertPartnerReferral(profileId: string, level: number, referredId?: string, contact?: string, referralType: 'DIRECT' | 'MULTI_LEVEL' = 'DIRECT') {
  // Check for self-referral if referredId is provided
  if (referredId) {
    const profile = await prisma.partnerProfile.findUnique({
      where: { id: profileId },
      select: { userId: true }
    });

    if (profile && profile.userId === referredId) {
      console.warn(`⚠️ Attempted self-referral blocked in upsert: profileId=${profileId}, userId=${profile.userId}, referredId=${referredId}`);
      return null;
    }
  }

  // Check if referral already exists
  const existingReferral = await prisma.partnerReferral.findFirst({
    where: {
      profileId,
      referredId,
      level
    }
  });

  if (existingReferral) {
    console.log(`🔄 Referral already exists for profileId: ${profileId}, referredId: ${referredId}, level: ${level}`);
    return existingReferral;
  }

  // Create new referral if it doesn't exist
  return prisma.partnerReferral.create({
    data: {
      profileId,
      level,
      referredId,
      contact,
      referralType,
    },
  });
}
