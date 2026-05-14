const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'ivasms.db'));
db.pragma('journal_mode = WAL');
const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = {
  insertMessage(m) {
    const stmt = db.prepare(`INSERT OR IGNORE INTO messages
      (hash, number, sender, message, otp, received_at) VALUES (?,?,?,?,?,?)`);
    const r = stmt.run(m.hash, m.number, m.sender, m.message, m.otp, m.received_at);
    return r.changes > 0;
  },
  list({ q, otpOnly, limit = 100 } = {}) {
    let sql = 'SELECT * FROM messages WHERE 1=1';
    const params = [];
    if (q) { sql += ' AND (number LIKE ? OR sender LIKE ? OR message LIKE ?)';
      params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    if (otpOnly) sql += ' AND otp IS NOT NULL';
    sql += ' ORDER BY id DESC LIMIT ?'; params.push(limit);
    return db.prepare(sql).all(...params);
  },
  latest(n = 5) { return db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT ?').all(n); },
  stats() {
    const total = db.prepare('SELECT COUNT(*) c FROM messages').get().c;
    const withOtp = db.prepare('SELECT COUNT(*) c FROM messages WHERE otp IS NOT NULL').get().c;
    const today = db.prepare("SELECT COUNT(*) c FROM messages WHERE date(received_at)=date('now')").get().c;
    const senders = db.prepare('SELECT sender, COUNT(*) c FROM messages GROUP BY sender ORDER BY c DESC LIMIT 5').all();
    return { total, withOtp, today, topSenders: senders };
  },
  setState(k,v){ db.prepare('INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,v); },
  getState(k){ const r = db.prepare('SELECT value FROM state WHERE key=?').get(k); return r ? r.value : null; }
};
