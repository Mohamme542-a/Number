const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const log = require('../utils/logger');
const { extractOtp } = require('../utils/otp');
const { hashMessage } = require('../utils/crypto');

const SESSION_DIR = path.join(__dirname, '..', 'sessions', 'chromium');
const SHOTS = path.join(__dirname, '..', 'screenshots');
[SESSION_DIR, SHOTS].forEach(d => fs.mkdirSync(d, { recursive: true }));

class IvasmsScraper {
  constructor({ db, io, telegram }) {
    this.db = db; this.io = io; this.telegram = telegram;
    this.context = null; this.page = null;
    this.running = false; this.timer = null;
    this.status = { loggedIn: false, lastPoll: null, lastError: null };
  }

  async _shot(name) {
    try { if (this.page) await this.page.screenshot({ path: path.join(SHOTS, `${name}-${Date.now()}.png`), fullPage: true }); } catch {}
  }

  async _launch() {
    this.context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: process.env.HEADLESS !== 'false',
      viewport: { width: 1366, height: 800 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    });
    this.page = this.context.pages()[0] || await this.context.newPage();
  }

  async _isLoggedIn() {
    try {
      await this.page.goto(process.env.IVASMS_INBOX_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const url = this.page.url();
      return !/login/i.test(url);
    } catch (e) { return false; }
  }

  async _login() {
    log.info('Logging in to IVASMS...');
    await this.page.goto(process.env.IVASMS_LOGIN_URL, { waitUntil: 'domcontentloaded' });
    // Robust selectors with fallbacks
    const emailSel = ['input[name="email"]','input[type="email"]','#email'];
    const passSel  = ['input[name="password"]','input[type="password"]','#password'];
    const subSel   = ['button[type="submit"]','button:has-text("Log in")','button:has-text("Login")'];
    const findFirst = async sels => { for (const s of sels) { const el = await this.page.$(s); if (el) return el; } return null; };
    const e = await findFirst(emailSel); const p = await findFirst(passSel); const b = await findFirst(subSel);
    if (!e || !p || !b) { await this._shot('login-selectors'); throw new Error('Login form selectors not found'); }
    await e.fill(process.env.IVASMS_EMAIL);
    await p.fill(process.env.IVASMS_PASSWORD);
    await Promise.all([ this.page.waitForLoadState('networkidle').catch(()=>{}), b.click() ]);
    await this.page.waitForTimeout(2000);
    if (!(await this._isLoggedIn())) { await this._shot('login-failed'); throw new Error('Login failed (still on login page)'); }
    log.info('Login OK');
  }

  async ensureSession() {
    if (!this.context) await this._launch();
    if (await this._isLoggedIn()) { this.status.loggedIn = true; return; }
    await this._login();
    this.status.loggedIn = true;
  }

  async _scrapeRows() {
    // Navigate to inbox and read the message table.
    await this.page.goto(process.env.IVASMS_INBOX_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1500);
    // Generic table parser – adjust selectors here if IVASMS changes layout.
    return await this.page.evaluate(() => {
      const out = [];
      const tables = document.querySelectorAll('table');
      for (const t of tables) {
        const rows = t.querySelectorAll('tbody tr');
        for (const r of rows) {
          const cells = [...r.querySelectorAll('td')].map(c => c.innerText.trim());
          if (cells.length < 3) continue;
          // Heuristic: find the cell most likely to be the message (longest)
          let msgIdx = 0; for (let i=0;i<cells.length;i++) if (cells[i].length > cells[msgIdx].length) msgIdx = i;
          const numIdx = cells.findIndex(c => /^\+?\d{6,}$/.test(c.replace(/\s/g,'')));
          const dateIdx = cells.findIndex(c => /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(c));
          out.push({
            number: numIdx >= 0 ? cells[numIdx] : null,
            sender: cells.find((c,i)=> i!==numIdx && i!==msgIdx && i!==dateIdx && c.length<32) || null,
            message: cells[msgIdx],
            received_at: dateIdx >= 0 ? cells[dateIdx] : new Date().toISOString()
          });
        }
      }
      return out;
    });
  }

  async pollOnce() {
    try {
      await this.ensureSession();
      const rows = await this._scrapeRows();
      let inserted = 0;
      for (const r of rows) {
        const otp = extractOtp(r.message);
        const hash = hashMessage(r);
        const ok = this.db.insertMessage({ ...r, otp, hash });
        if (ok) {
          inserted++;
          this.io.emit('new_message', { ...r, otp });
          if (this.telegram) await this.telegram.notify({ ...r, otp });
        }
      }
      this.status.lastPoll = new Date().toISOString();
      this.status.lastError = null;
      if (inserted) log.info(`Inserted ${inserted} new messages`);
    } catch (e) {
      this.status.lastError = e.message;
      log.error(`Poll failed: ${e.message}`);
      await this._shot('poll-error');
      // Try re-login next round
      this.status.loggedIn = false;
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    const tick = async () => {
      if (!this.running) return;
      await this.pollOnce();
      this.timer = setTimeout(tick, parseInt(process.env.POLL_INTERVAL_MS || '7000', 10));
    };
    tick();
    log.info('Scraper started');
  }

  async stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    log.info('Scraper stopped');
  }

  async close() {
    await this.stop();
    if (this.context) await this.context.close();
  }
}

module.exports = IvasmsScraper;
