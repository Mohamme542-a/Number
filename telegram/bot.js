const TelegramBot = require('node-telegram-bot-api');
const log = require('../utils/logger');

class TgBot {
  constructor({ db }) {
    this.db = db;
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatIds = (process.env.TELEGRAM_CHAT_IDS || '').split(',').map(s=>s.trim()).filter(Boolean);
    if (!this.token) { log.warn('TELEGRAM_BOT_TOKEN not set; Telegram disabled'); return; }
    this.bot = new TelegramBot(this.token, { polling: true });
    this.bot.onText(/\/latest(?:\s+(\d+))?/, (msg, m) => {
      const n = Math.min(parseInt(m[1]||'5',10), 20);
      const rows = this.db.latest(n);
      if (!rows.length) return this.bot.sendMessage(msg.chat.id, 'No messages yet.');
      for (const r of rows) this.bot.sendMessage(msg.chat.id, this.format(r), { parse_mode: 'HTML' });
    });
    this.bot.onText(/\/start/, msg => this.bot.sendMessage(msg.chat.id,
      `Hello! Your chat id is <code>${msg.chat.id}</code>\nAdd it to TELEGRAM_CHAT_IDS in .env\nUse /latest [n] to fetch recent SMS.`,
      { parse_mode: 'HTML' }));
    log.info(`Telegram bot ready; notifying ${this.chatIds.length} chat(s)`);
  }

  format(r) {
    return `📩 <b>New SMS Received</b>\n\n` +
      `📱 <b>Number:</b> ${r.number || '-'}\n` +
      `👤 <b>Sender:</b> ${r.sender || '-'}\n` +
      `💬 <b>Message:</b> ${this.escape(r.message || '')}\n` +
      (r.otp ? `🔑 <b>OTP:</b> <code>${r.otp}</code>\n` : '') +
      `🕒 <b>Time:</b> ${r.received_at || ''}`;
  }

  escape(s){ return String(s).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])); }

  async notify(r) {
    if (!this.bot) return;
    const text = this.format(r);
    for (const id of this.chatIds) {
      try { await this.bot.sendMessage(id, text, { parse_mode: 'HTML' }); }
      catch (e) { log.error(`TG send to ${id} failed: ${e.message}`); }
    }
  }
}
module.exports = TgBot;
