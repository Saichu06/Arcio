'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// ARCIO — Express Backend Application
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

const firebaseAdminService = require('./services/firebaseAdminService');
const firebaseService = firebaseAdminService?.default || firebaseAdminService;
const {
  auth,
  db,
  verifyFirebaseToken,
  resolveRegNoToEmail,
  registerStudentAccount,
  getUserProfile,
} = firebaseService;

console.log('[FIREBASE SERVICE]', {
  moduleType: typeof firebaseAdminService,
  defaultType: typeof firebaseAdminService?.default,
  verifyFirebaseToken: typeof verifyFirebaseToken,
});

const googleSheetsService = require('./services/googleSheetsService');

// ── Constants ─────────────────────────────────────────────────────────────────

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
          'https://www.gstatic.com',
          'https://apis.google.com',
        ],

        scriptSrcAttr: ["'self'", "'unsafe-inline'"],

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
          'https://*.firebaseio.com',
          'https://*.googleapis.com',
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          'https://www.gstatic.com',
        ],

        frameSrc: [
          "'self'",
          'https://*.firebaseapp.com',
          'https://accounts.google.com',
        ],

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

// GET /api/firebase-config
api.get('/firebase-config', (_req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyAERBBfEHv_cgf5D9mFYqHmu_e8uB6rExE",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "arcio-srm.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "arcio-srm",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "arcio-srm.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "109155134449",
    appId: process.env.FIREBASE_APP_ID || "1:109155134449:web:0784770662930dd70b3250"
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

// POST /api/auth/resolve-reg
api.post('/auth/resolve-reg', async (req, res) => {
  try {
    const { regNo } = req.body || {};
    if (!regNo) {
      return res.status(400).json({ status: 400, error: 'Registration number is required.' });
    }

    const email = await resolveRegNoToEmail(regNo);
    if (!email) {
      return res.status(404).json({ status: 404, error: 'Registration number not found.' });
    }

    res.json({ status: 200, email });
  } catch (err) {
    console.error('[API ERROR] resolve-reg:', err.message);
    res.status(500).json({ status: 500, error: 'Failed to resolve registration number.' });
  }
});

// POST /api/auth/register-profile (Protected with Firebase ID Token Verification)
api.post('/auth/register-profile', verifyFirebaseToken, async (req, res) => {
  try {
    const { name, registerNo, email } = req.body || {};
    const uid = req.user.uid;

    if (!name || !registerNo) {
      return res.status(400).json({ status: 400, error: 'Name and Registration Number are required.' });
    }

    const profile = await registerStudentAccount({
      uid,
      name,
      registerNo,
      email: email || req.user.email
    });

    res.json({ status: 200, message: 'Profile registered successfully.', profile });
  } catch (err) {
    console.error('[API ERROR] register-profile:', err.message);
    res.status(400).json({ status: 400, error: err.message || 'Failed to register student profile.' });
  }
});

// GET /api/auth/me (Protected with Firebase ID Token Verification)
api.get('/auth/me', verifyFirebaseToken, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.uid);
    if (!profile) {
      return res.status(404).json({ status: 404, error: 'User profile not found.' });
    }
    res.json({ status: 200, profile });
  } catch (err) {
    console.error('[API ERROR] auth/me:', err.message);
    res.status(500).json({ status: 500, error: 'Failed to fetch user profile.' });
  }
});

// POST /api/sync-student (Protected with Firebase ID token verification)
api.post('/sync-student', verifyFirebaseToken, async (req, res) => {
  try {
    const studentData = req.body || {};
    if (!studentData.email && req.user) {
      studentData.email = req.user.email;
    }

    const result = await googleSheetsService.syncStudentToSheet(studentData);
    res.json({ status: 200, message: 'Student synchronized successfully.', result });
  } catch (err) {
    console.error('[API ERROR] sync-student:', err.message);
    res.status(500).json({ status: 500, error: err.message || 'Failed to sync student data.' });
  }
});

// Mount API router
app.use('/api', api);

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN PAGE ROUTES
// ─────────────────────────────────────────────────────────────────────────────

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

app.use('/assets', express.static(path.join(STATIC_ROOT, 'assets')));
app.use('/playground/assets', express.static(path.join(STATIC_ROOT, 'playground', 'assets')));

app.use(
  express.static(STATIC_ROOT, {
    dotfiles: 'deny',
    maxAge: IS_PROD ? '1h' : 0,
    index: 'index.html',
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      status: 404,
      error: 'Endpoint not found.',
    });
  }

  res.status(404).sendFile(
    path.join(STATIC_ROOT, 'index.html')
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
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
    error: IS_PROD
      ? 'Internal server error.'
      : err.message,
  });
});

module.exports = app;
