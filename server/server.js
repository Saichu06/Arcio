'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  ARCIO — Express Backend
//  Serves all static assets and exposes a secure REST API for experiment data.
// ─────────────────────────────────────────────────────────────────────────────

const path    = require('path');
const fs      = require('fs');

// Load .env from the server/ directory before any other module reads env vars
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const morgan     = require('morgan');

// ── Constants ─────────────────────────────────────────────────────────────────
const PORT         = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV     = process.env.NODE_ENV || 'development';
const IS_PROD      = NODE_ENV === 'production';
const STATIC_ROOT  = path.join(__dirname, '..'); // project root — serves index.html etc.
const DATA_FILE    = path.join(STATIC_ROOT, 'experiments.json');

// Allowed CORS origins (comma-separated in .env)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// ── Load experiment data once at startup ──────────────────────────────────────
let EXPERIMENTS_DATA = null;

function loadExperiments() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    EXPERIMENTS_DATA = JSON.parse(raw);
    console.log(`✓ Experiments loaded: ${EXPERIMENTS_DATA.experiments.length} labs`);
  } catch (err) {
    console.error(`✗ Failed to load experiments.json: ${err.message}`);
    process.exit(1);
  }
}

loadExperiments();

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();

// ── Security: Helmet (HTTP headers) ──────────────────────────────────────────
app.use(
  helmet({
    // Content-Security-Policy — tightened for ARCIO's known external resources
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      [
          "'self'",
          "'unsafe-inline'",          // inline <script> blocks in existing HTML
          'https://cdn.jsdelivr.net', // canvas-confetti
          'https://cdnjs.cloudflare.com',
          'https://unpkg.com',
        ],
        styleSrc:       [
          "'self'",
          "'unsafe-inline'",          // inline <style> blocks in existing HTML
          'https://fonts.googleapis.com',
        ],
        fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
        imgSrc:         ["'self'", 'data:', 'https:'],
        connectSrc:     [
          "'self'",
          'https://nominatim.openstreetmap.org',  // geocoding in advance pages
          'https://api.open-meteo.com',            // weather API
          'https://air-quality-api.open-meteo.com',
        ],
        frameSrc:       ["'none'"],
        objectSrc:      ["'none'"],
        upgradeInsecureRequests: IS_PROD ? [] : null,
      },
    },
    // Prevent browsers from caching sensitive responses
    crossOriginEmbedderPolicy: false, // needed for external CDN scripts to load
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: IS_PROD
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

// ── Security: CORS ────────────────────────────────────────────────────────────
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (e.g. curl, Postman, same-origin pages)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin "${origin}" not permitted`));
    },
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    maxAge: 600, // pre-flight cache: 10 minutes
  })
);

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan(IS_PROD ? 'combined' : 'dev'));

// ── Body parsing (minimal — API is read-only) ─────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Rate limiting — applies only to API routes ────────────────────────────────
const apiLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              200,             // max 200 requests per window per IP
  standardHeaders:  true,           // Return RateLimit-* headers (RFC 6585)
  legacyHeaders:    false,
  message: {
    status:  429,
    error:   'Too many requests — please try again later.',
  },
});

// ── Helper: sanitize experiment ID ───────────────────────────────────────────
const EXP_ID_PATTERN = /^exp-\d{3}$/;

function findExperiment(id) {
  if (!EXP_ID_PATTERN.test(id)) return null;
  return EXPERIMENTS_DATA.experiments.find(e => e.id === id) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  API Routes
// ─────────────────────────────────────────────────────────────────────────────
const api = express.Router();

// Apply rate limiter to all API routes
api.use(apiLimiter);

// GET /api/health
api.get('/health', (_req, res) => {
  res.json({
    status:      'ok',
    timestamp:   new Date().toISOString(),
    environment: NODE_ENV,
    experiments: EXPERIMENTS_DATA.experiments.length,
  });
});

// GET /api/experiments  — returns the full list
api.get('/experiments', (_req, res) => {
  res.json(EXPERIMENTS_DATA);
});

// GET /api/experiments/:id  — returns a single experiment
api.get('/experiments/:id', (req, res) => {
  const { id } = req.params;
  const experiment = findExperiment(id);

  if (!experiment) {
    return res.status(404).json({
      status: 404,
      error:  `Experiment "${id}" not found.`,
    });
  }

  res.json(experiment);
});

// Mount API router
app.use('/api', api);

// ── Static files (serve ARCIO project root) ───────────────────────────────────
app.use(
  express.static(STATIC_ROOT, {
    // Don't expose .env or server/ directory internals
    dotfiles: 'deny',
    // Cache static assets for 1 hour in production, no cache in dev
    maxAge: IS_PROD ? '1h' : 0,
    // Set proper index
    index: 'index.html',
  })
);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  // Return JSON for API requests, HTML for everything else
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ status: 404, error: 'Endpoint not found.' });
  }
  res.status(404).sendFile(path.join(STATIC_ROOT, 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // CORS errors get a 403
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ status: 403, error: err.message });
  }

  console.error('[ERROR]', err.message);

  res.status(err.status || 500).json({
    status: err.status || 500,
    // Never expose stack traces or internal messages in production
    error: IS_PROD ? 'Internal server error.' : err.message,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Start
// ─────────────────────────────────────────────────────────────────────────────
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

module.exports = app; // for testing
