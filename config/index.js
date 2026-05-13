require('dotenv').config();
module.exports = {
  ivasms: {
    email: process.env.IVASMS_EMAIL,
    password: process.env.IVASMS_PASSWORD,
    baseUrl: process.env.IVASMS_BASE_URL || 'https://www.ivasms.com',
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    adminChatIds: (process.env.ADMIN_CHAT_IDS || '').split(',').map(s=>s.trim()).filter(Boolean),
  },
  scraper: {
    headless: (process.env.HEADLESS || 'true') === 'true',
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
    refreshCron: process.env.NUMBERS_REFRESH_CRON || '0 * * * *',
  },
  app: {
    dbPath: process.env.DB_PATH || './db/data.sqlite',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};
