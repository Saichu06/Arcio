'use strict';

/**
 * ARCIO — Firebase Admin Service
 * Handles server-side ID token verification, Firestore Admin access,
 * and secure registration-number lookup.
 */

const path = require('path');
const fs = require('fs');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

let appInstance = null;
let authInstance = null;
let dbInstance = null;

function initAdmin() {
  if (appInstance) return appInstance;

  const existingApps = getApps();

  if (existingApps.length) {
    appInstance = existingApps[0];
    return appInstance;
  }

  const credentialsJson = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON;

  let serviceAccount = null;

  // Production / Vercel: credentials from environment variable
  if (credentialsJson) {
    try {
      serviceAccount = JSON.parse(credentialsJson);

      console.log('[FIREBASE ADMIN ENV]', {
        exists: true,
        projectId: serviceAccount.project_id || 'unknown',
        clientEmail: serviceAccount.client_email || 'unknown',
        hasPrivateKey: Boolean(serviceAccount.private_key),
      });
    } catch (err) {
      throw new Error(
        `Invalid FIREBASE_ADMIN_CREDENTIALS_JSON: ${err.message}`
      );
    }
  }

  // Local development fallback
  if (!serviceAccount) {
    const CRED_REL_PATH =
      process.env.FIREBASE_ADMIN_CREDENTIALS ||
      path.join('server', 'credentials', 'firebase-admin.json');

    const CREDENTIALS_PATH = path.isAbsolute(CRED_REL_PATH)
      ? CRED_REL_PATH
      : path.join(__dirname, '..', '..', CRED_REL_PATH);

    try {
      if (fs.existsSync(CREDENTIALS_PATH)) {
        serviceAccount = JSON.parse(
          fs.readFileSync(CREDENTIALS_PATH, 'utf8')
        );
      }
    } catch (err) {
      console.warn(
        '[FIREBASE ADMIN] Could not load service account JSON file:',
        err.message
      );
    }
  }

  try {
    if (serviceAccount) {
      appInstance = initializeApp({
        credential: cert(serviceAccount),
      });

      console.log(
        `✓ Firebase Admin initialized for project: ${
          serviceAccount.project_id || 'arcio-srm'
        } using service account.`
      );
    } else {
      appInstance = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'arcio-srm',
      });

      console.log(
        `✓ Firebase Admin initialized for project: ${
          process.env.FIREBASE_PROJECT_ID || 'arcio-srm'
        }`
      );
    }
  } catch (err) {
    console.error('[FIREBASE ADMIN INIT ERROR]', err.message);
    throw err;
  }

  return appInstance;
}

function getAdminAuth() {
  if (!authInstance) {
    initAdmin();
    authInstance = getAuth(appInstance);
  }
  return authInstance;
}

function getAdminDb() {
  if (!dbInstance) {
    initAdmin();
    dbInstance = getFirestore(appInstance);
  }
  return dbInstance;
}



/**
 * Express middleware to verify Firebase ID token in Authorization header.
 * Header format: Authorization: Bearer <ID_TOKEN>
 */
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const hasAuthHeader = !!authHeader;
  const hasBearer = authHeader ? authHeader.startsWith('Bearer ') : false;

  if (!hasAuthHeader || !hasBearer) {
    console.warn('[AUTH VERIFY] Missing or invalid Authorization header format.', { hasAuthHeader, hasBearer });
    return res.status(401).json({ status: 401, error: 'Unauthorized: Missing or invalid token format.' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    
    // Diagnostic logging (safe, no tokens/secrets exposed)
    const tokenProjectId = decodedToken.aud;
    const issuer = decodedToken.iss;
    const authTime = decodedToken.auth_time;
    const exp = decodedToken.exp;
    const currentServerTime = Math.floor(Date.now() / 1000);

    console.log('[AUTH DIAGNOSTIC]', {
      uid: decodedToken.uid,
      aud: tokenProjectId,
      iss: issuer,
      auth_time: authTime,
      exp: exp,
      server_time: currentServerTime,
      token_valid: true
    });

    req.user = decodedToken; // decodedToken contains { uid, email, ... }
    next();
  } catch (err) {
    // Log exact Firebase Admin error details server-side while keeping client response clean
    console.error('[AUTH VERIFY ERROR]', {
      code: err.code || 'unknown',
      message: err.message,
      stack: err.stack ? err.stack.split('\n')[1] : null
    });

    let clientMsg = 'Unauthorized: Invalid or expired token.';
    if (err.code === 'auth/id-token-expired') {
      clientMsg = 'Unauthorized: Token expired. Please sign in again.';
    } else if (err.code === 'auth/id-token-revoked') {
      clientMsg = 'Unauthorized: Token revoked. Please sign in again.';
    }

    return res.status(401).json({ status: 401, error: clientMsg });
  }
}

/**
 * Safely resolves a normalized registration number to the user's registered email.
 */
async function resolveRegNoToEmail(regNo) {
  if (!regNo || typeof regNo !== 'string') return null;
  const normalized = regNo.trim().toUpperCase();
  const db = getAdminDb();
  const docRef = db.collection('reg_numbers').doc(normalized);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return null;
  }
  return snapshot.data().email || null;
}

/**
 * Server-side Registration Transaction:
 * Atomically checks & claims normalized registration number, creates users/{uid} profile document,
 * and sets reg_numbers/{regNo} mapping using Admin SDK privileges.
 */
async function registerStudentAccount({ uid, name, registerNo, email }) {
  if (!uid || !name || !registerNo || !email) {
    throw new Error('Missing required registration parameters.');
  }

  const normReg = registerNo.trim().toUpperCase();
  const normEmail = email.trim().toLowerCase();

  const db = getAdminDb();
  const regDocRef = db.collection('reg_numbers').doc(normReg);
  const userDocRef = db.collection('users').doc(uid);

  const userProfile = {
    uid,
    name: name.trim(),
    registerNo: normReg,
    email: normEmail,
    role: 'student',
    createdAt: new Date().toISOString(),
    certificate: {
      issued: false
    }
  };

  await db.runTransaction(async (transaction) => {
    const regSnap = await transaction.get(regDocRef);
    if (regSnap.exists) {
      throw new Error(`Registration number "${normReg}" is already registered to another account.`);
    }

    transaction.set(userDocRef, userProfile);
    transaction.set(regDocRef, {
      uid,
      email: normEmail,
      createdAt: new Date().toISOString()
    });
  });

  return userProfile;
}

/**
 * Fetches user profile from Firestore using Admin SDK.
 */
async function getUserProfile(uid) {
  if (!uid) return null;
  const db = getAdminDb();
  const docRef = db.collection('users').doc(uid);
  const snap = await docRef.get();
  if (snap.exists) {
    return snap.data();
  }
  return null;
}

module.exports = {
  get auth() { return getAdminAuth(); },
  get db() { return getAdminDb(); },
  verifyFirebaseToken,
  resolveRegNoToEmail,
  registerStudentAccount,
  getUserProfile,
};
