// =============================================================================
// ARCIO — Centralized Frontend Configuration
// =============================================================================

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE FORM CONFIGURATION PLACEHOLDER:
 * Replace the string below with your actual Google Form URL when ready.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const FEEDBACK_FORM_URL = "https://forms.gle/6z8yy9o4Q2sQtRRR7";

// Global window exposure for non-module scripts
if (typeof window !== 'undefined') {
  window.ARCIO_FEEDBACK_FORM_URL = FEEDBACK_FORM_URL;
}
