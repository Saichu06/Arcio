// =============================================================================
// ARCIO — Centralized Frontend Configuration
// =============================================================================

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE FORM CONFIGURATION PLACEHOLDER:
 * Replace the string below with your actual Google Form URL when ready.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const FEEDBACK_FORM_URL = "YOUR_GOOGLE_FORM_URL_HERE";

// Global window exposure for non-module scripts
if (typeof window !== 'undefined') {
  window.ARCIO_FEEDBACK_FORM_URL = FEEDBACK_FORM_URL;
}
