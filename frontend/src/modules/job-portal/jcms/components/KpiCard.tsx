import type { ReactNode } from "react";

type KpiCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: "default" | "success" | "warning" | "indigo";
  icon?: ReactNode;
};

const accentMap: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  default: "text-slate-900",
  success: "text-emerald-700",
  warning: "text-amber-700",
  indigo: "text-brand-600",
};

export function KpiCard({ label, value, subtitle, accent = "default", icon }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all hover:shadow-card-hover">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className={`mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight ${accentMap[accent]}`}>
        {value}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}
