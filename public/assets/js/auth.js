// ─────────────────────────────────────────────────────────────────────────────
// ARCIO — Auth & User Management Module
// Handles Registration, Login (Email/RegNo), Google Sign-In, Atomic Profile Sync,
// Token-authenticated backend calls, and Route Protection.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';

import {
  doc,
  getDoc,
  setDoc,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

import { auth, db, googleProvider, firebaseConfig } from './firebase-config.js';
import {
  getExperimentStorageKey,
  getDefaultExperimentState,
  loadUserExperimentState,
  saveUserExperimentState
} from './storage.js';

export {
  getExperimentStorageKey,
  getDefaultExperimentState,
  loadUserExperimentState,
  saveUserExperimentState
};

// Global state
window.ARCIO_USER = null;
window.ARCIO_PROFILE = null;

/**
 * Helper: Normalizes registration number (uppercase, trimmed)
 */
export function normalizeRegNo(regNo) {
  return (regNo || '').toString().trim().toUpperCase();
}

/**
 * Helper: Triggers backend Google Sheets sync using Firebase ID Token
 */
export async function syncStudentToBackend(user, profile) {
  try {
    const idToken = await user.getIdToken(true);
    const response = await fetch('/api/sync-student', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        registerNo: profile.registerNo,
        name: profile.name,
        email: profile.email,
        certificateStatus: profile.certificate && profile.certificate.issued ? 'Issued' : 'Not Issued',
        lastActive: new Date().toISOString().split('T')[0]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn('[SHEETS SYNC] Server response error:', errData.error || response.statusText);
    } else {
      const resData = await response.json();
      console.log('✓ Google Sheets sync successful:', resData);
    }
  } catch (err) {
    console.warn('[SHEETS SYNC] Sync request failed:', err.message);
  }
}

/**
 * Registers a new ARCIO user.
 * Enforces atomic registration-number uniqueness in Firestore and rollbacks Auth user on failure.
 */
export async function registerUser({ name, registerNo, email, password, confirmPassword }) {
  // Input validations
  if (!name || !name.trim()) throw new Error('Please enter your full name.');
  if (!registerNo || !registerNo.trim()) throw new Error('Please enter your registration number.');
  if (!email || !email.trim()) throw new Error('Please enter a valid email address.');
  if (!password) throw new Error('Please enter a password.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters long.');
  if (password !== confirmPassword) throw new Error('Passwords do not match.');

  const normReg = normalizeRegNo(registerNo);
  const normEmail = email.trim().toLowerCase();

  let userCredential = null;
  try {
    // 1. Create Firebase Auth account first
    userCredential = await createUserWithEmailAndPassword(auth, normEmail, password);
    const user = userCredential.user;

    console.log('[AUTH REQUEST]', {
      hasUser: !!user,
      uid: user?.uid,
      email: user?.email,
      projectId: firebaseConfig.projectId
    });

    const idToken = await user.getIdToken(true);

    console.log('[AUTH REQUEST] Fresh ID token obtained', {
      uid: user.uid,
      tokenLength: idToken?.length
    });

    // 2. Perform atomic profile registration & registration number claim via Admin SDK backend
    const response = await fetch('/api/auth/register-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        name: name.trim(),
        registerNo: normReg,
        email: normEmail
      })
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.error || 'Failed to complete account registration.');
    }

    const userProfile = resData.profile;
    window.ARCIO_PROFILE = userProfile;

    // 3. Trigger background Google Sheets sync
    syncStudentToBackend(user, userProfile);

    return { user, profile: userProfile };
  } catch (err) {
    // Rollback cleanup: delete Firebase auth user if profile creation failed
    if (userCredential && userCredential.user) {
      try {
        await userCredential.user.delete();
        console.log('[AUTH ROLLBACK] Deleted auth account following registration error.');
      } catch (delErr) {
        console.error('[AUTH ROLLBACK] Failed to delete auth user during rollback:', delErr.message);
      }
    }

    // Friendly error messaging
    if (err.code === 'auth/email-already-in-use') {
      throw new Error('This email address is already registered. Please sign in instead.');
    } else if (err.code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address.');
    } else if (err.code === 'auth/weak-password') {
      throw new Error('Password should be at least 6 characters.');
    }

    throw err;
  }
}

/**
 * Authenticates user via Email OR Registration Number.
 * Does NOT trigger Google Sheets sync on login.
 */
export async function loginUser({ identifier, password }) {
  if (!identifier || !identifier.trim()) throw new Error('Please enter your email or registration number.');
  if (!password) throw new Error('Please enter your password.');

  let targetEmail = identifier.trim();

  // If identifier is not an email address, resolve Registration Number via server
  if (!targetEmail.includes('@')) {
    const normReg = normalizeRegNo(targetEmail);
    try {
      const response = await fetch('/api/auth/resolve-reg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regNo: normReg })
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Registration number "${normReg}" is not registered.`);
        }
        throw new Error('Unable to resolve registration number. Please try using your email.');
      }

      const data = await response.json();
      targetEmail = data.email;
    } catch (err) {
      if (err.message.includes('not registered')) throw err;
      throw new Error('Network error resolving registration number. Please check connection.');
    }
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
    const profile = await fetchUserProfile(userCredential.user.uid);
    window.ARCIO_PROFILE = profile;
    return { user: userCredential.user, profile };
  } catch (err) {
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      throw new Error('Invalid credentials. Please check your email/registration number and password.');
    } else if (err.code === 'auth/user-not-found') {
      throw new Error('No account found with these details.');
    } else if (err.code === 'auth/too-many-requests') {
      throw new Error('Access to this account has been temporarily disabled due to many failed login attempts.');
    }
    throw err;
  }
}

/**
 * Signs in with Google popup.
 * Returns { user, profile, isNewUser }
 */
export async function loginWithGoogle() {
  try {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const user = userCredential.user;

    // Check if Firestore user profile exists
    let profile = await fetchUserProfile(user.uid);

    if (!profile) {
      return { user, profile: null, isNewUser: true };
    }

    window.ARCIO_PROFILE = profile;
    return { user, profile, isNewUser: false };
  } catch (err) {
    console.error('[GOOGLE AUTH]', {
      code: err?.code,
      message: err?.message,
      projectId: firebaseConfig?.projectId,
      authDomain: firebaseConfig?.authDomain
    });

    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-In cancelled: Popup was closed before completing.');
    } else if (err.code === 'auth/popup-blocked') {
      throw new Error('Sign-In blocked: Please allow popups for this site in your browser.');
    } else if (err.code === 'auth/account-exists-with-different-credential') {
      throw new Error('An account already exists with the same email address using different sign-in credentials.');
    } else if (err.code === 'auth/network-request-failed') {
      throw new Error('Network error: Unable to connect to authentication server. Please check your internet connection.');
    } else if (err.code === 'auth/unauthorized-domain') {
      throw new Error('Domain unauthorized: This domain is not authorized in Firebase Console for OAuth redirect.');
    } else if (err.code === 'auth/operation-not-allowed') {
      throw new Error('Google Sign-In is not enabled in Firebase Console. Please enable Google under Authentication > Sign-in method.');
    } else if (err.code === 'auth/api-key-not-valid' || err.code === 'auth/invalid-api-key') {
      throw new Error('Firebase configuration error: Invalid API key. Please check server environment configuration.');
    }
    throw new Error(err.message || 'Google Sign-In failed. Please try again.');
  }
}

/**
 * Completes ARCIO profile for Google-authenticated users missing registration number.
 */
export async function completeGoogleProfile(user, { name, registerNo }) {
  if (!name || !name.trim()) throw new Error('Please enter your full name.');
  if (!registerNo || !registerNo.trim()) throw new Error('Please enter your registration number.');

  const normReg = normalizeRegNo(registerNo);

  console.log('[AUTH REQUEST]', {
    hasUser: !!user,
    uid: user?.uid,
    email: user?.email,
    projectId: firebaseConfig.projectId
  });

  const idToken = await user.getIdToken(true);

  console.log('[AUTH REQUEST] Fresh ID token obtained', {
    uid: user.uid,
    tokenLength: idToken?.length
  });

  const response = await fetch('/api/auth/register-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      name: name.trim(),
      registerNo: normReg,
      email: user.email.toLowerCase()
    })
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData.error || 'Failed to complete profile.');
  }

  const userProfile = resData.profile;
  window.ARCIO_PROFILE = userProfile;

  // Sync to Google Sheets upon initial profile completion
  syncStudentToBackend(user, userProfile);

  return userProfile;
}

/**
 * Fetches user profile from Firestore `users/{uid}`
 */
export async function fetchUserProfile(uid) {
  try {
    const userDocRef = doc(db, 'users', uid);
    const snapshot = await getDoc(userDocRef);
    if (snapshot.exists()) {
      return snapshot.data();
    }
  } catch (err) {
    console.warn('[FIRESTORE] Direct client profile read blocked/failed, trying token API:', err.message);
  }

  // Fallback to backend Admin API using Firebase ID token
  try {
    const user = auth.currentUser;
    if (user) {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data.profile;
      }
    }
  } catch (apiErr) {
    console.error('[AUTH API] Failed to fetch profile via backend API:', apiErr.message);
  }

  return null;
}

/**
 * Logs out current user.
 */
export async function logoutUser() {
  await signOut(auth);
  window.ARCIO_USER = null;
  window.ARCIO_PROFILE = null;
  window.location.href = '/';
}

/**
 * Initializes Auth State Observer.
 * Enforces route protection on protected pages (/dashboard, /exp/*, /advance/*).
 */
export function initAuthObserver(onStateChanged) {
  return onAuthStateChanged(auth, async (user) => {
    window.ARCIO_USER = user;
    if (user) {
      if (!window.ARCIO_PROFILE) {
        window.ARCIO_PROFILE = await fetchUserProfile(user.uid);
      }
    } else {
      window.ARCIO_PROFILE = null;
    }

    const currentPath = window.location.pathname;

    // Check if on a protected page
    const isProtectedPage = currentPath.includes('/dashboard') || 
                            currentPath.includes('/exp/') || 
                            currentPath.includes('/advance/');

    if (!user && isProtectedPage) {
      console.warn('[AUTH GATE] Unauthenticated access to protected page. Redirecting to home...');
      window.location.href = '/?auth=required';
      return;
    }

    if (onStateChanged) {
      onStateChanged(user, window.ARCIO_PROFILE);
    }
  });
}
