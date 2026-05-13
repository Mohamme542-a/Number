const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const cfg = require('../config');

const dir = path.dirname(cfg.app.dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const db = new Database(cfg.app.dbPath);
db.pragma('journal_mode = WAL');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

module.exports = db;
