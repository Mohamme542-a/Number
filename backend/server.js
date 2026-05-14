require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Server } = require('socket.io');
const db = require('./db');
const log = require('../utils/logger');
const TgBot = require('../telegram/bot');
const Scraper = require('../automation/scraper');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use('/api/', rateLimit({ windowMs: 60_000, max: 120 }));

// Simple password gate for the dashboard API
app.use('/api/', (req, res, next) => {
  const pwd = req.headers['x-dashboard-password'];
  if (!process.env.DASHBOARD_PASSWORD || pwd === process.env.DASHBOARD_PASSWORD) return next();
  res.status(401).json({ error: 'unauthorized' });
});

const telegram = new TgBot({ db });
const scraper = new Scraper({ db, io, telegram });

app.get('/api/messages', (req, res) => {
  const { q, otp, limit } = req.query;
  res.json(db.list({ q, otpOnly: otp === '1', limit: parseInt(limit||'100',10) }));
});
app.get('/api/stats', (_, res) => res.json(db.stats()));
app.get('/api/status', (_, res) => res.json({ ...scraper.status, running: scraper.running }));
app.post('/api/start', async (_, res) => { await scraper.start(); res.json({ ok: true }); });
app.post('/api/stop',  async (_, res) => { await scraper.stop();  res.json({ ok: true }); });
app.get('/api/export.csv', (_, res) => {
  const rows = db.list({ limit: 100000 });
  const head = 'id,number,sender,message,otp,received_at\n';
  const body = rows.map(r => [r.id, r.number, r.sender, JSON.stringify(r.message||''), r.otp, r.received_at].join(',')).join('\n');
  res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition','attachment; filename=messages.csv');
  res.send(head + body);
});

// Serve built frontend
const dist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(dist));
app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html')));

io.on('connection', s => log.info(`Socket connected: ${s.id}`));

const port = parseInt(process.env.PORT || '3000', 10);
server.listen(port, () => {
  log.info(`Server listening on :${port}`);
  scraper.start().catch(e => log.error(e.message));
});

process.on('SIGINT', async () => { await scraper.close(); process.exit(0); });
