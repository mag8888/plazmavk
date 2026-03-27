import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}

export const env = {
  botToken: requireEnv('BOT_TOKEN'),
  botUsername: process.env.BOT_USERNAME || 'iplazmabot',
  botWebhookUrl: process.env.BOT_WEBHOOK_URL,
  botWebhookSecret: process.env.BOT_WEBHOOK_SECRET,
  adminChatId: process.env.ADMIN_CHAT_ID,
  databaseUrl: process.env.DATABASE_URL || process.env.MONGO_URL || undefined,
  adminEmail: requireEnv('ADMIN_EMAIL'),
  adminPassword: requireEnv('ADMIN_PASSWORD'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
  webappUrl: (() => {
    const u = process.env.WEBAPP_URL || process.env.PUBLIC_BASE_URL || 'https://plazma.up.railway.app';
    return /example\.(com|org)/i.test(u) ? 'https://plazma.up.railway.app' : u;
  })(),
  webappBaseUrl: (() => {
    const u = process.env.WEBAPP_BASE_URL || process.env.WEBAPP_URL || process.env.PUBLIC_BASE_URL || 'https://plazma.up.railway.app/webapp';
    return /example\.(com|org)/i.test(u) ? 'https://plazma.up.railway.app/webapp' : (u.endsWith('/webapp') ? u : `${u.replace(/\/$/, '')}/webapp`);
  })(),
  videoUrl: process.env.VIDEO_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  plazmaApiKey: process.env.PLAZMA_API_KEY || process.env.EXTERNAL_API_KEY || '',
  plazmaApiUrl: process.env.PLAZMA_API_URL || process.env.PUBLIC_BASE_URL || process.env.WEBAPP_BASE_URL || 'https://plazma.up.railway.app',
  /** Папка в Cloudinary с аудио для «Звуковые матрицы» (если в БД нет записей) */
  cloudinaryAudioFolder: process.env.CLOUDINARY_AUDIO_FOLDER || 'plazma',
};

// Helper function to get all admin chat IDs
export function getAdminChatIds(): string[] {
  if (!env.adminChatId) return [];
  return env.adminChatId.split(',').map(id => id.trim()).filter(id => id);
}

// Helper function to send message to all admins
export async function sendToAllAdmins(bot: any, message: string): Promise<void> {
  const adminIds = getAdminChatIds();

  for (const chatId of adminIds) {
    try {
      await bot.telegram.sendMessage(chatId, message);
      console.log(`Message sent to admin: ${chatId}`);
    } catch (error) {
      console.error(`Failed to send message to admin ${chatId}:`, error);
    }
  }
}
