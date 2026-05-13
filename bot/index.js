const TelegramBot = require('node-telegram-bot-api');
const cfg = require('../config');
const log = require('../utils/logger');
const db = require('../db');
const { t } = require('../locales');

const bot = new TelegramBot(cfg.telegram.token, { polling: true });

// ---------- helpers ----------
function getUser(chatId) {
  let u = db.prepare('SELECT * FROM users WHERE chat_id=?').get(chatId);
  if (!u) {
    db.prepare('INSERT INTO users(chat_id, lang, created_at) VALUES (?,?,?)').run(chatId, 'ar', Date.now());
    u = db.prepare('SELECT * FROM users WHERE chat_id=?').get(chatId);
  }
  return u;
}
function setLang(chatId, lang) {
  db.prepare('UPDATE users SET lang=? WHERE chat_id=?').run(lang, chatId);
}
function langKb() {
  return { reply_markup: { inline_keyboard: [[
    { text: '🇸🇦 العربية', callback_data: 'lang:ar' },
    { text: '🇬🇧 English', callback_data: 'lang:en' },
  ]]}};
}
function mainKb(lang) {
  return { reply_markup: { inline_keyboard: [
    [{ text: t(lang,'menu_telegram'), callback_data: 'svc:telegram' }],
    [{ text: t(lang,'menu_whatsapp'), callback_data: 'svc:whatsapp' }],
    [{ text: t(lang,'menu_facebook'), callback_data: 'svc:facebook' }],
    [{ text: t(lang,'menu_change_lang'), callback_data: 'changelang' }],
  ]}};
}
function numberKb(lang, service) {
  return { reply_markup: { inline_keyboard: [
    [{ text: t(lang,'btn_change'), callback_data: `new:${service}` }],
    [{ text: t(lang,'btn_back'), callback_data: 'back' }],
  ]}};
}

/** Get next number for user using round-robin cursor */
function nextNumber(chatId, service) {
  const list = db.prepare('SELECT id, number FROM numbers WHERE service=? AND active=1 ORDER BY id').all(service);
  if (!list.length) return null;
  const row = db.prepare('SELECT cursor FROM user_cursor WHERE chat_id=? AND service=?').get(chatId, service);
  const cur = row ? row.cursor : 0;
  const pick = list[cur % list.length];
  const next = (cur + 1) % list.length;
  db.prepare('INSERT INTO user_cursor(chat_id,service,cursor) VALUES(?,?,?) ON CONFLICT(chat_id,service) DO UPDATE SET cursor=excluded.cursor')
    .run(chatId, service, next);
  return pick;
}
function releaseUserActive(chatId) {
  db.prepare('UPDATE reservations SET released_at=? WHERE chat_id=? AND released_at IS NULL').run(Date.now(), chatId);
}
function reserve(chatId, number, service) {
  releaseUserActive(chatId);
  db.prepare('INSERT INTO reservations(chat_id,number,service,reserved_at) VALUES(?,?,?,?)').run(chatId, number, service, Date.now());
}

// ---------- handlers ----------
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  getUser(chatId);
  bot.sendMessage(chatId, t('ar','choose_lang'), langKb());
});

bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id;
  const u = getUser(chatId);
  const data = q.data;
  try {
    if (data.startsWith('lang:')) {
      const lang = data.split(':')[1];
      setLang(chatId, lang);
      await bot.answerCallbackQuery(q.id, { text: t(lang,'lang_set') });
      await bot.sendMessage(chatId, t(lang,'welcome'), mainKb(lang));
      return;
    }
    if (data === 'changelang') {
      await bot.sendMessage(chatId, t(u.lang,'choose_lang'), langKb());
      return;
    }
    if (data === 'back') {
      releaseUserActive(chatId);
      await bot.sendMessage(chatId, t(u.lang,'back_menu'), mainKb(u.lang));
      return;
    }
    if (data.startsWith('svc:') || data.startsWith('new:')) {
      const service = data.split(':')[1];
      const pick = nextNumber(chatId, service);
      if (!pick) {
        await bot.answerCallbackQuery(q.id);
        await bot.sendMessage(chatId, t(u.lang,'no_numbers'), mainKb(u.lang));
        return;
      }
      reserve(chatId, pick.number, service);
      await bot.answerCallbackQuery(q.id);
      await bot.sendMessage(chatId, t(u.lang,'your_number',{ number: pick.number }), { parse_mode:'HTML', ...numberKb(u.lang, service) });
      return;
    }
  } catch (e) {
    log.error({ e: e.message }, 'callback_query error');
  }
});

// ---------- forwarding ----------
function forwardMessage({ number, text, otp }) {
  // Send to every user actively reserving this number
  const rows = db.prepare('SELECT DISTINCT chat_id FROM reservations WHERE number=? AND released_at IS NULL').all(number);
  for (const r of rows) {
    const u = getUser(r.chat_id);
    const key = otp ? 'otp_received' : 'msg_received';
    const html = t(u.lang, key, { number, otp: otp || '', text });
    bot.sendMessage(r.chat_id, html, { parse_mode: 'HTML' }).catch(()=>{});
  }
  // Admin alerts
  for (const adminId of cfg.telegram.adminChatIds) {
    bot.sendMessage(adminId, `📥 ${number}\n${otp ? '🔑 '+otp+'\n' : ''}${text}`).catch(()=>{});
  }
}

module.exports = { bot, forwardMessage };
