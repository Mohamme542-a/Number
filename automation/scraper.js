/**
 * IVASMS Scraper
 * - Persistent login session (storageState)
 * - Two jobs:
 *   1) refreshNumbers(): list available numbers (called hourly)
 *   2) pollMessages(): poll incoming SMS every N seconds
 * - Emits events via EventEmitter: 'message', 'numbers'
 *
 * NOTE: Update the SELECTORS section if IVASMS changes their UI.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const cfg = require('../config');
const log = require('../utils/logger');
const { extractOTP } = require('../utils/otp');
const { classify } = require('../utils/classify');

const SESSION_PATH = path.join(__dirname, '..', 'db', 'session.json');

class Scraper extends EventEmitter {
  constructor() {
    super();
    this.browser = null;
    this.context = null;
    this.page = null;
    this.loggedIn = false;
    this.lastMessageHashes = new Set();
  }

  async start() {
    this.browser = await chromium.launch({ headless: cfg.scraper.headless, args: ['--no-sandbox'] });
    const ctxOpts = { viewport: { width: 1280, height: 800 } };
    if (fs.existsSync(SESSION_PATH)) ctxOpts.storageState = SESSION_PATH;
    this.context = await this.browser.newContext(ctxOpts);
    this.page = await this.context.newPage();
    await this._ensureLogin();
    log.info('Scraper started.');
  }

  async _ensureLogin() {
    try {
      await this.page.goto(cfg.ivasms.baseUrl + '/portal/sms/received', { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (this.page.url().includes('/login')) await this._login();
      else this.loggedIn = true;
    } catch (e) {
      log.warn({ e: e.message }, 'ensureLogin nav failed, attempting login');
      await this._login();
    }
  }

  async _login() {
    log.info('Logging into IVASMS...');
    await this.page.goto(cfg.ivasms.baseUrl + '/login', { waitUntil: 'domcontentloaded' });
    // SELECTORS — adjust if site changes
    await this.page.fill('input[name="email"]', cfg.ivasms.email);
    await this.page.fill('input[name="password"]', cfg.ivasms.password);
    await Promise.all([
      this.page.waitForLoadState('domcontentloaded'),
      this.page.click('button[type="submit"]'),
    ]);
    if (this.page.url().includes('/login')) {
      await this._screenshot('login_failed');
      throw new Error('Login failed — check credentials or selectors.');
    }
    await this.context.storageState({ path: SESSION_PATH });
    this.loggedIn = true;
    log.info('Login OK, session saved.');
  }

  async _screenshot(tag) {
    try {
      const dir = path.join(__dirname, '..', 'screenshots');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      await this.page.screenshot({ path: path.join(dir, `${tag}-${Date.now()}.png`), fullPage: true });
    } catch {}
  }

  /** Refresh available numbers list (hourly) */
  async refreshNumbers() {
    try {
      await this._ensureLogin();
      // Navigate to "My Numbers" / Test Numbers page — adjust path
      await this.page.goto(cfg.ivasms.baseUrl + '/portal/numbers', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(1500);
      const rows = await this.page.evaluate(() => {
        const out = [];
        document.querySelectorAll('table tr').forEach(tr => {
          const tds = [...tr.querySelectorAll('td')].map(td => td.innerText.trim());
          if (tds.length >= 2) out.push(tds);
        });
        return out;
      });
      const numbers = [];
      for (const r of rows) {
        // Heuristic: find a phone-looking cell and a sender/service cell
        const phone = r.find(c => /^\+?\d{6,15}$/.test(c.replace(/\s/g,'')));
        if (!phone) continue;
        const sender = r.find(c => /[a-zA-Z]{3,}/.test(c)) || '';
        const country = r.find(c => /^[A-Z]{2,3}$/.test(c)) || '';
        numbers.push({ number: phone.replace(/\s/g,''), sender, country, service: classify(sender) });
      }
      log.info({ count: numbers.length }, 'Numbers refreshed');
      this.emit('numbers', numbers);
      return numbers;
    } catch (e) {
      log.error({ e: e.message }, 'refreshNumbers failed');
      await this._screenshot('refresh_numbers_err');
      return [];
    }
  }

  /** Poll incoming SMS list */
  async pollMessages() {
    try {
      await this._ensureLogin();
      await this.page.goto(cfg.ivasms.baseUrl + '/portal/sms/received', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(1000);
      const rows = await this.page.evaluate(() => {
        const out = [];
        document.querySelectorAll('table tr').forEach(tr => {
          const tds = [...tr.querySelectorAll('td')].map(td => td.innerText.trim());
          if (tds.length >= 3) out.push(tds);
        });
        return out;
      });
      for (const r of rows) {
        const number = (r.find(c => /^\+?\d{6,15}$/.test(c.replace(/\s/g,''))) || '').replace(/\s/g,'');
        if (!number) continue;
        const text = r.find(c => c.length > 10 && /[a-zA-Z]/.test(c)) || r[r.length-1] || '';
        const sender = r.find(c => /^[A-Za-z][A-Za-z0-9 ]{2,}$/.test(c) && c !== text) || '';
        const hash = crypto.createHash('md5').update(number+'|'+text).digest('hex');
        if (this.lastMessageHashes.has(hash)) continue;
        this.lastMessageHashes.add(hash);
        if (this.lastMessageHashes.size > 5000) this.lastMessageHashes = new Set([...this.lastMessageHashes].slice(-2000));
        const otp = extractOTP(text);
        this.emit('message', { number, sender, text, otp, hash, received_at: Date.now() });
      }
    } catch (e) {
      log.error({ e: e.message }, 'pollMessages failed');
      await this._screenshot('poll_err');
      this.loggedIn = false;
    }
  }

  async stop() { try { await this.browser?.close(); } catch {} }
}

module.exports = new Scraper();
