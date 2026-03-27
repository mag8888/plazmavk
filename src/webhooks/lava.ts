import express from 'express';
import { lavaService } from '../services/lava-service.js';
import { prisma } from '../lib/prisma.js';
import { PaymentStatus } from '@prisma/client';

const router = express.Router();

// Webhook для получения уведомлений о платежах
router.post('/webhook/lava', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-signature'] as string;
    const payload = req.body.toString();

    console.log('🔥 Lava webhook received:', { signature, payload: payload.substring(0, 200) + '...' });

    // Проверяем подпись
    if (!lavaService.verifyWebhookSignature(payload, signature)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const data = JSON.parse(payload);
    console.log('📊 Lava webhook data:', data);

    // Обрабатываем уведомление о платеже
    if (data.type === 'invoice_paid') {
      const { invoiceId, orderId } = data.data;

      console.log(`💰 Processing payment: invoiceId=${invoiceId}, orderId=${orderId}`);

      // Находим платеж в БД
      const payment = await prisma.payment.findFirst({
        where: { invoiceId }
      });

      if (payment && payment.status === 'PENDING') {
        console.log(`✅ Found pending payment: ${payment.id}`);

        // Обновляем статус платежа
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.PAID }
        });

        const isBalanceTopUp = payment.orderId.startsWith('BALANCE-');

        let userTelegramId: number | null = null;
        let notificationText = '';

        if (isBalanceTopUp) {
          const updatedUser = await prisma.user.update({
            where: { id: payment.userId },
            data: {
              balance: {
                increment: payment.amount,
              },
            },
            select: {
              telegramId: true,
              balance: true,
              firstName: true,
            },
          });

          if (updatedUser?.telegramId) {
            userTelegramId = Number(updatedUser.telegramId);
          }

          notificationText =
            '🎉 <b>Баланс пополнен!</b>\n\n' +
            `💰 Сумма: ${payment.amount.toFixed(2)} ₽\n` +
            `💳 Текущий баланс: ${updatedUser.balance.toFixed(2)} ₽`;
        } else {
          // Обновляем статус заказа
          await prisma.orderRequest.updateMany({
            where: { id: payment.orderId },
            data: { status: 'COMPLETED' }
          });

          const user = await prisma.user.findUnique({
            where: { id: payment.userId },
            select: { telegramId: true }
          });

          if (user?.telegramId) {
            userTelegramId = Number(user.telegramId);
          }

          notificationText =
            '🎉 <b>Платеж успешно оплачен!</b>\n\n' +
            `💰 Сумма: ${payment.amount} ₽\n` +
            `📋 Заказ: #${payment.orderId}\n\n` +
            'Ваш заказ будет обработан в ближайшее время.';
        }

        const { getBotInstance } = await import('../lib/bot-instance.js');
        const bot = await getBotInstance();

        if (bot && userTelegramId) {
          try {
            await bot.telegram.sendMessage(
              userTelegramId,
              notificationText,
              { parse_mode: 'HTML' }
            );
            console.log(`📱 Notification sent to user ${userTelegramId}`);
          } catch (error) {
            console.error('❌ Failed to send notification:', error);
          }
        }

        console.log(`✅ Payment ${payment.id} marked as paid`);
      } else {
        console.log(`⚠️ Payment not found or already processed: ${invoiceId}`);
      }
    } else if (data.type === 'invoice_failed') {
      console.log(`❌ Payment failed: ${data.data.invoiceId}`);

      // Обновляем статус на FAILED
      await prisma.payment.updateMany({
        where: { invoiceId: data.data.invoiceId },
        data: { status: 'FAILED' }
      });
    } else if (data.type === 'invoice_cancelled') {
      console.log(`🚫 Payment cancelled: ${data.data.invoiceId}`);

      // Обновляем статус на CANCELLED
      await prisma.payment.updateMany({
        where: { invoiceId: data.data.invoiceId },
        data: { status: 'CANCELLED' }
      });
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
