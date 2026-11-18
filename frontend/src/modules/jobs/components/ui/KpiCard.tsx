import type { ReactNode } from "react";

type KpiCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  iconBg?: string;
  accent?: "default" | "success" | "warning" | "brand" | "indigo";
};

export function KpiCard({
  label,
  value,
  subtitle,
  icon,
  iconBg = "bg-indigo-50 text-[#635BFF]",
}: KpiCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
      <div className="space-y-1">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="font-stat text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
      </div>
      {icon && (
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
      )}
    </div>
  );
}
