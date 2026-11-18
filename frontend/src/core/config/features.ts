/** Product feature flags (no runtime env required for local defaults). */
export const PAYMENTS_ENABLED = false;

/** Self-registration for individual learners (`SIGNUP_ENABLED` on user-management). */
export const SIGNUP_ENABLED = import.meta.env.VITE_SIGNUP_ENABLED !== "false";

/** Show demo credential picker on login (never enable in production). */
export const SHOW_DEMO_LOGIN = import.meta.env.VITE_SHOW_DEMO_LOGIN === "true";
