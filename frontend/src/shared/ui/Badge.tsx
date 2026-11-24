import type { ReactNode } from "react";

import { cn } from "@/core/lib/cn";

const tones = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  amber: "bg-amber-50 text-amber-700 ring-amber-200/70",
  orange: "bg-orange-50 text-orange-700 ring-orange-200/70",
  red: "bg-rose-50 text-rose-700 ring-rose-200/70",
  blue: "bg-sky-50 text-sky-700 ring-sky-200/70",
  indigo: "bg-sky-50 text-brand-600 ring-sky-200/70",
  purple: "bg-brand-50 text-brand-700 ring-brand-200/80",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "gray", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}
