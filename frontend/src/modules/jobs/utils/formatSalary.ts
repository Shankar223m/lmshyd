/** Human-readable CTC for job cards; no placeholder ranges when data is missing. */
export function formatSalaryRange(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const minL = min ? (min / 100_000).toFixed(min >= 1_000_000 ? 1 : 0) : null;
  const maxL = max ? (max / 100_000).toFixed(max >= 1_000_000 ? 1 : 0) : null;
  if (minL && maxL) return `₹${minL}–₹${maxL} LPA`;
  if (minL) return `From ₹${minL} LPA`;
  if (maxL) return `Up to ₹${maxL} LPA`;
  return null;
}

export const SALARY_DISCLOSURE = "Compensation shared during process";

/** Compact annual range for list cards (e.g. ₹18L – ₹32L). */
export function formatSalaryCompact(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `₹${(n / 100_000).toFixed(n >= 1_000_000 ? 1 : 0)}L`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

export function formatPostedAgo(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  return `${weeks} weeks ago`;
}