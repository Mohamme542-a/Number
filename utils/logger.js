const pino = require('pino');
const cfg = require('../config');
module.exports = pino({ level: cfg.app.logLevel, transport: { target: 'pino-pretty', options: { colorize: true } } });
