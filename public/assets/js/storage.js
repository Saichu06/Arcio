// ─────────────────────────────────────────────────────────────────────────────
// ARCIO — Per-User Storage Isolation Module
// Scopes experiment state to the authenticated Firebase User UID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the localStorage key for a given Firebase User UID.
 */
export function getExperimentStorageKey(uid) {
  if (!uid) return null;
  return `arcio_user_${uid}_experiments`;
}

/**
 * Returns clean default experiment state structure.
 */
export function getDefaultExperimentState() {
  return {
    labs: {},
    playground: {},
    inProgress: {},
    xp: 0,
    recent: [],
    favs: [],
    theme: 'light',
    notes: {},
    expTimes: {},
    expAttempts: {},
    completionDates: {},
    activities: [],
    username: 'Engineering Student',
    certStudentName: '',
    certDate: ''
  };
}

/**
 * Loads experiment state strictly scoped to the given Firebase User UID.
 * Does NOT read legacy un-isolated global keys to avoid cross-account leaks.
 */
export function loadUserExperimentState(uid) {
  if (!uid) return getDefaultExperimentState();
  const key = getExperimentStorageKey(uid);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return getDefaultExperimentState();
    const parsed = JSON.parse(raw);
    return {
      labs: parsed.labs || {},
      playground: parsed.playground || {},
      inProgress: parsed.inProgress || {},
      xp: parsed.xp || 0,
      recent: parsed.recent || [],
      favs: parsed.favs || [],
      theme: parsed.theme || 'light',
      notes: parsed.notes || {},
      expTimes: parsed.expTimes || {},
      expAttempts: parsed.expAttempts || {},
      completionDates: parsed.completionDates || {},
      activities: parsed.activities || [],
      username: parsed.username || 'Engineering Student',
      certStudentName: parsed.certStudentName || '',
      certDate: parsed.certDate || ''
    };
  } catch (e) {
    console.warn('[STORAGE] Failed to parse state for user:', uid, e);
    return getDefaultExperimentState();
  }
}

/**
 * Saves experiment state strictly scoped to the given Firebase User UID.
 */
export function saveUserExperimentState(uid, state) {
  if (!uid) {
    console.warn('[STORAGE] Cannot save state: No Firebase UID provided');
    return;
  }
  const key = getExperimentStorageKey(uid);
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.error('[STORAGE] Failed to save state for user:', uid, e);
  }
}

// Expose on window for global access
window.ARCIO_STORAGE = {
  getExperimentStorageKey,
  getDefaultExperimentState,
  loadUserExperimentState,
  saveUserExperimentState
};

