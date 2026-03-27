import type { Context as TelegrafContext } from 'telegraf';

export interface SessionData {
  currentCategoryId?: number | null;
  lastProductId?: number | null;
  uiMode?: 'classic' | 'app';
  replyingTo?: {
    userTelegramId: string;
    userName: string;
  };
  addBalanceFlow?: {
    awaitingAmount: boolean;
  };
}

export interface Context extends TelegrafContext {
  session: SessionData;
}
