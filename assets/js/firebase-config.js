// ─────────────────────────────────────────────────────────────────────────────
// ARCIO — Firebase Modular Web Configuration (v11/v12)
// Frontend initialization using official Firebase JS SDK via CDN
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

// Firebase project configuration (using project composite-watch-505307-g5)
const firebaseConfig = {
  apiKey: "AIzaSyAERBBfEHv_cgf5D9mFYqHmu_e8uB6rExE",
  authDomain: "arcio-srm.firebaseapp.com",
  projectId: "arcio-srm",
  storageBucket: "arcio-srm.firebasestorage.app",
  messagingSenderId: "109155134449",
  appId: "1:109155134449:web:0784770662930dd70b3250",
  measurementId: "G-46VK8FKXEG"
};

// Fetch runtime web config from Express backend if available
try {
  const res = await fetch('/api/firebase-config');
  if (res.ok) {
    const serverConfig = await res.json();
    if (serverConfig && serverConfig.apiKey && !serverConfig.apiKey.includes('ARCIO_FIREBASE_WEB_KEY')) {
      firebaseConfig = { ...firebaseConfig, ...serverConfig };
    }
  }
} catch (e) {
  // Fallback to static window config
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider, firebaseConfig };
