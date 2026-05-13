module.exports = {
  apps: [{
    name: 'ivasms-public-bot',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production' },
  }],
};
