/**
 * IVASMS Public Telegram Bot — entry point
 */
const cron = require('node-cron');
const cfg = require('./config');
const log = require('./utils/logger');
const db = require('./db');
const scraper = require('./automation/scraper');
const { bot, forwardMessage } = require('./bot');

async function syncNumbers(list) {
  const tx = db.transaction((items) => {
    db.prepare('UPDATE numbers SET active=0').run();
    const upsert = db.prepare(`
      INSERT INTO numbers(number, service, sender, country, last_seen, active)
      VALUES (?,?,?,?,?,1)
      ON CONFLICT(number, service) DO UPDATE SET sender=excluded.sender, country=excluded.country, last_seen=excluded.last_seen, active=1
    `);
    for (const n of items) {
      if (n.service === 'other') continue;
      upsert.run(n.number, n.service, n.sender || '', n.country || '', Date.now());
    }
  });
  tx(list);
  log.info({ stored: list.filter(n=>n.service!=='other').length }, 'numbers synced');
}

function saveMessage(m) {
  try {
    db.prepare('INSERT OR IGNORE INTO messages(number, sender, text, otp, received_at, hash) VALUES (?,?,?,?,?,?)')
      .run(m.number, m.sender || '', m.text, m.otp || null, m.received_at, m.hash);
  } catch (e) { log.error({ e: e.message }, 'saveMessage'); }
}

(async () => {
  log.info('Booting IVASMS Public Bot...');
  await scraper.start();

  scraper.on('numbers', syncNumbers);
  scraper.on('message', (m) => {
    saveMessage(m);
    forwardMessage(m);
  });

  // Initial fetch
  await scraper.refreshNumbers();

  // Hourly numbers refresh
  cron.schedule(cfg.scraper.refreshCron, () => {
    log.info('Cron: refreshing numbers');
    scraper.refreshNumbers().catch(e=>log.error(e));
  });

  // Continuous SMS polling
  setInterval(() => scraper.pollMessages().catch(e=>log.error(e)), cfg.scraper.pollIntervalMs);

  log.info('Bot is running. Send /start in Telegram.');
})().catch(e => { log.error(e); process.exit(1); });

process.on('SIGINT', async () => { await scraper.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await scraper.stop(); process.exit(0); });
