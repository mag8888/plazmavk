import { Telegraf } from 'telegraf';
import { Context } from './context.js';
import { BotModule } from './types.js';
import { navigationModule } from '../modules/navigation/index.js';
import { shopModule } from '../modules/shop/index.js';
import { partnerModule } from '../modules/partner/index.js';
import { reviewsModule } from '../modules/reviews/index.js';
import { aboutModule } from '../modules/about/index.js';
import { adminModule } from '../modules/admin/index.js';
import { adminOrderModule } from '../modules/admin/admin-orders.js';
import { cartModule } from '../modules/cart/index.js';
import { audioModule } from '../modules/audio/index.js';
import { balanceModule } from '../modules/balance/index.js';
import { adminTopupsModule } from './admin-topups.js';
import { broadcastListenerModule } from '../modules/admin/broadcast-listener.js';

const modules: BotModule[] = [
  shopModule,        // Register shop module first to handle shop button
  cartModule,        // Register cart module to handle cart button
  balanceModule,     // Пополнение баланса
  audioModule,       // Register audio module to handle audio uploads
  navigationModule,
  partnerModule,
  reviewsModule,
  aboutModule,
  broadcastListenerModule, // Listen for admin forwards (register before admin to catch intents)
  adminModule,
  adminOrderModule,  // Admin order processing
  adminTopupsModule, // Admin topup confirmations
];

export async function applyBotModules(bot: Telegraf<Context>) {
  for (const module of modules) {
    await module.register(bot);
  }
}
