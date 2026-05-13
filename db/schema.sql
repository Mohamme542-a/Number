CREATE TABLE IF NOT EXISTS users (
  chat_id INTEGER PRIMARY KEY,
  username TEXT,
  lang TEXT DEFAULT 'ar',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL,
  service TEXT NOT NULL,            -- telegram | whatsapp | facebook | other
  sender TEXT,
  country TEXT,
  last_seen INTEGER NOT NULL,
  active INTEGER DEFAULT 1,
  UNIQUE(number, service)
);
CREATE INDEX IF NOT EXISTS idx_numbers_service ON numbers(service, active);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL,
  sender TEXT,
  text TEXT NOT NULL,
  otp TEXT,
  received_at INTEGER NOT NULL,
  hash TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_messages_number ON messages(number, received_at DESC);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  number TEXT NOT NULL,
  service TEXT NOT NULL,
  reserved_at INTEGER NOT NULL,
  released_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_res_active ON reservations(number, released_at);
CREATE INDEX IF NOT EXISTS idx_res_user ON reservations(chat_id, released_at);

CREATE TABLE IF NOT EXISTS user_cursor (
  chat_id INTEGER NOT NULL,
  service TEXT NOT NULL,
  cursor INTEGER DEFAULT 0,
  PRIMARY KEY (chat_id, service)
);
