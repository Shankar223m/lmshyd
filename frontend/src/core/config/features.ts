/** Product feature flags (no runtime env required for local defaults). */
export const PAYMENTS_ENABLED = false;

/** Self-registration for individual learners (removed; always off). */
export const SIGNUP_ENABLED = false;

/**
 * Show demo credential picker on login (never enable in production).
 * Dev: on by default (`VITE_SHOW_DEMO_LOGIN=false` to hide). Prod: only when explicitly `true`.
 */
export const SHOW_DEMO_LOGIN = import.meta.env.PROD
  ? import.meta.env.VITE_SHOW_DEMO_LOGIN === "true"
  : import.meta.env.VITE_SHOW_DEMO_LOGIN !== "false";
