'use strict';

const app = require('./app');

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const path = require('path');
const STATIC_ROOT = path.join(__dirname, '..');

// Allowed CORS origins (comma-separated in .env)
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:3000'
)
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('');
    console.log('  ⚡  ARCIO Backend');
    console.log(`  ├── Environment : ${NODE_ENV}`);
    console.log(`  ├── Listening   : http://localhost:${PORT}`);
    console.log(`  ├── Static root : ${STATIC_ROOT}`);
    console.log(`  ├── API base    : http://localhost:${PORT}/api`);
    console.log(`  └── CORS allow  : ${ALLOWED_ORIGINS.join(', ')}`);
    console.log('');
  });
}

module.exports = app;