'use strict';

const serverModule = require('../server/server');

const app =
  serverModule?.default ||
  serverModule?.app ||
  serverModule;

if (typeof app !== 'function') {
  console.error('[VERCEL] Invalid Express app export:', {
    type: typeof app,
    keys: Object.keys(serverModule || {}),
    defaultType: typeof serverModule?.default,
    appType: typeof serverModule?.app,
  });

  throw new Error('Express app could not be resolved from server/server.js');
}

module.exports = (req, res) => {
  return app(req, res);
};
