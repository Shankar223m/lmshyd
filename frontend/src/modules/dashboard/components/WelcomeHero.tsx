import type { ReactNode } from "react";

import { Icon } from "@/shared/ui";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Ace-style welcome banner — GenZ brand green, real date + optional progress line. */
export function WelcomeHero({
  firstName,
  subtitle,
  tagline,
  progressLabel,
  actions,
}: {
  firstName: string;
  subtitle?: string;
  /** One-line product pitch for this role (shown under institution name). */
  tagline?: string;
  /** Optional progress line under the greeting (e.g. student weekly goal). */
  progressLabel?: string;
  actions?: ReactNode;
}) {
  const now = new Date();
  const today = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <section className="relative mb-6 overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-brand-700 via-brand-600 to-navy-800 px-6 py-7 text-white shadow-brand sm:px-8 sm:py-8">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-48 w-48 rounded-full bg-white/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-accent-500/20"
        aria-hidden="true"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          <p className="text-sm font-medium text-white/80">{today}</p>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-tight sm:text-[32px]">
            {greeting(now.getHours())}, {firstName}
          </h1>
          {subtitle ? <p className="mt-1.5 text-[15px] font-medium text-white/90">{subtitle}</p> : null}
          {tagline ? <p className="mt-2 text-sm text-white/80">{tagline}</p> : null}
          {progressLabel ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white">
              <Icon name="check" size={14} />
              {progressLabel}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          <div
            className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/25 sm:flex"
            aria-hidden="true"
          >
            <Icon name="graduation" size={44} className="text-white" />
          </div>
        </div>
      </div>
    </section>
  );
}
