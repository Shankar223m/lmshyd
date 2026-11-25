/** Product feature flags (no runtime env required for local defaults). */
export const PAYMENTS_ENABLED = false;

/** Self-registration for individual learners (removed; always off). */
export const SIGNUP_ENABLED = false;

/**
 * Show demo credential picker on login. Off unless `VITE_SHOW_DEMO_LOGIN=true`.
 */
export const SHOW_DEMO_LOGIN = import.meta.env.VITE_SHOW_DEMO_LOGIN === "true";
