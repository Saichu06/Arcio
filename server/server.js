'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// ARCIO — Express Backend
// Serves all static assets and exposes a secure REST API for experiment data.
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const fs = require('fs');

// Load .env from the server/ directory before any other module reads env vars
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// ── Constants ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

const STATIC_ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(STATIC_ROOT, 'experiments.json');

// Allowed CORS origins (comma-separated in .env)
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:3000'
)
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// ── Load experiment data once at startup ──────────────────────────────────────

let EXPERIMENTS_DATA = null;

function loadExperiments() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');

    EXPERIMENTS_DATA = JSON.parse(raw);

    console.log(
      `✓ Experiments loaded: ${EXPERIMENTS_DATA.experiments.length} labs`
    );
  } catch (err) {
    console.error(
      `✗ Failed to load experiments.json: ${err.message}`
    );

    process.exit(1);
  }
}

loadExperiments();

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();

// ── Security: Helmet ──────────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
          'https://unpkg.com',
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
        ],

        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com',
        ],

        imgSrc: [
          "'self'",
          'data:',
          'https:',
        ],

        connectSrc: [
          "'self'",
          'https://nominatim.openstreetmap.org',
          'https://api.open-meteo.com',
          'https://air-quality-api.open-meteo.com',
        ],

        frameSrc: ["'none'"],

        objectSrc: ["'none'"],

        upgradeInsecureRequests: IS_PROD ? [] : null,
      },
    },

    crossOriginEmbedderPolicy: false,

    crossOriginResourcePolicy: {
      policy: 'same-origin',
    },

    hsts: IS_PROD
      ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      }
      : false,
  })
);

// ── Security: CORS ────────────────────────────────────────────────────────────

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, Postman, same-origin pages)
      if (!origin) {
        return callback(null, true);
      }

      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      callback(
        new Error(`CORS: origin "${origin}" not permitted`)
      );
    },

    methods: ['GET', 'OPTIONS'],

    allowedHeaders: [
      'Content-Type',
      'Accept',
    ],

    maxAge: 600,
  })
);

// ── Logging ───────────────────────────────────────────────────────────────────

app.use(
  morgan(
    IS_PROD
      ? 'combined'
      : 'dev'
  )
);

// ── Body parsing ──────────────────────────────────────────────────────────────

app.use(
  express.json({
    limit: '10kb',
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 200,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    status: 429,
    error: 'Too many requests — please try again later.',
  },
});

// ── Helper: sanitize experiment ID ────────────────────────────────────────────

const EXP_ID_PATTERN = /^exp-\d{3}$/;

function findExperiment(id) {
  if (!EXP_ID_PATTERN.test(id)) {
    return null;
  }

  return (
    EXPERIMENTS_DATA.experiments.find(
      experiment => experiment.id === id
    ) || null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────────────────────────────────────

const api = express.Router();

// Apply rate limiter to all API routes
api.use(apiLimiter);

// GET /api/health
api.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    experiments: EXPERIMENTS_DATA.experiments.length,
  });
});

// GET /api/experiments
api.get('/experiments', (_req, res) => {
  res.json(EXPERIMENTS_DATA);
});

// GET /api/experiments/:id
api.get('/experiments/:id', (req, res) => {
  const { id } = req.params;

  const experiment = findExperiment(id);

  if (!experiment) {
    return res.status(404).json({
      status: 404,
      error: `Experiment "${id}" not found.`,
    });
  }

  res.json(experiment);
});

// Mount API router
app.use('/api', api);

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN PAGE ROUTES
// ─────────────────────────────────────────────────────────────────────────────
//
// These routes hide .html from user-facing URLs.
//
// /dashboard
// /exp/exp1
// /exp/exp2
// ...
// /advance/env_advisor
//
// The physical .html files remain unchanged.
// ─────────────────────────────────────────────────────────────────────────────

// ── Legacy .html redirects ────────────────────────────────────────────────────

// /dashboard.html → /dashboard
app.get('/dashboard.html', (_req, res) => {
  res.redirect(301, '/dashboard');
});

// /exp/exp1.html → /exp/exp1
app.get('/exp/:id.html', (req, res) => {
  const { id } = req.params;

  // Only allow exp1 through exp10
  if (!/^exp([1-9]|10)$/.test(id)) {
    return res.status(404).send('Experiment not found.');
  }

  res.redirect(301, `/exp/${id}`);
});

// /advance/module.html → /advance/module
app.get('/advance/:module.html', (req, res) => {
  const { module } = req.params;

  // Allow only safe module names
  if (!/^[a-zA-Z0-9_-]+$/.test(module)) {
    return res.status(404).send('Module not found.');
  }

  const filePath = path.join(
    STATIC_ROOT,
    'advance',
    `${module}.html`
  );

  // Only redirect if the actual file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Module not found.');
  }

  res.redirect(301, `/advance/${module}`);
});

// ── Clean dashboard route ─────────────────────────────────────────────────────

app.get('/dashboard', (_req, res) => {
  res.sendFile(
    path.join(STATIC_ROOT, 'dashboard.html')
  );
});

// ── Clean experiment routes ──────────────────────────────────────────────────

app.get('/exp/:id', (req, res) => {
  const { id } = req.params;

  // Only allow exp1 through exp10
  if (!/^exp([1-9]|10)$/.test(id)) {
    return res.status(404).send('Experiment not found.');
  }

  const filePath = path.join(
    STATIC_ROOT,
    'exp',
    `${id}.html`
  );

  // Verify the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Experiment not found.');
  }

  res.sendFile(filePath);
});

// ── Clean advanced module routes ──────────────────────────────────────────────

app.get('/advance/:module', (req, res) => {
  const { module } = req.params;

  // Prevent path traversal / arbitrary filename access
  if (!/^[a-zA-Z0-9_-]+$/.test(module)) {
    return res.status(404).send('Module not found.');
  }

  const filePath = path.join(
    STATIC_ROOT,
    'advance',
    `${module}.html`
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Module not found.');
  }

  res.sendFile(filePath);
});

// ─────────────────────────────────────────────────────────────────────────────
// STATIC FILES
// ─────────────────────────────────────────────────────────────────────────────
//
// Keep this AFTER the clean routes so Express handles pretty URLs first.
// ─────────────────────────────────────────────────────────────────────────────

app.use(
  express.static(STATIC_ROOT, {
    // Don't expose .env or hidden files
    dotfiles: 'deny',

    // Cache static assets for 1 hour in production
    // No cache in development
    maxAge: IS_PROD ? '1h' : 0,

    // Default homepage
    index: 'index.html',
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  // API requests receive JSON
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      status: 404,
      error: 'Endpoint not found.',
    });
  }

  // Non-API requests return the ARCIO homepage
  res.status(404).sendFile(
    path.join(STATIC_ROOT, 'index.html')
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // CORS errors
  if (
    err.message &&
    err.message.startsWith('CORS')
  ) {
    return res.status(403).json({
      status: 403,
      error: err.message,
    });
  }

  console.error(
    '[ERROR]',
    err.message
  );

  res.status(err.status || 500).json({
    status: err.status || 500,

    // Never expose stack traces/internal messages in production
    error: IS_PROD
      ? 'Internal server error.'
      : err.message,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');

  console.log('  ⚡  ARCIO Backend');

  console.log(
    `  ├── Environment : ${NODE_ENV}`
  );

  console.log(
    `  ├── Listening   : http://localhost:${PORT}`
  );

  console.log(
    `  ├── Static root : ${STATIC_ROOT}`
  );

  console.log(
    `  ├── API base    : http://localhost:${PORT}/api`
  );

  console.log(
    `  └── CORS allow  : ${ALLOWED_ORIGINS.join(', ')}`
  );

  console.log('');
});

module.exports = app;