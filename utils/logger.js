const winston = require('winston');
const path = require('path');
const fs = require('fs');
const dir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
module.exports = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(dir, 'app.log') }),
    new winston.transports.File({ filename: path.join(dir, 'error.log'), level: 'error' })
  ]
});
