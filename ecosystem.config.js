module.exports = {
  apps: [{
    name: 'ivasms-otp-bot',
    script: 'backend/server.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production' }
  }]
};
