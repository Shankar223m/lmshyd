import { Link } from "react-router-dom";

import { NAV_GROUPS } from "@/app/navigation";
import { useNavItems } from "@/app/useNavItems";
import { cn } from "@/core/lib/cn";
import { Icon } from "@/shared/ui";

const TONES = [
  {
    chip: "from-brand-50 to-brand-100 text-brand-700 ring-brand-100",
    bar: "bg-brand-500",
    hover: "hover:border-brand-300",
  },
  {
    chip: "from-navy-50 to-navy-100 text-navy-800 ring-navy-100",
    bar: "bg-navy-700",
    hover: "hover:border-navy-300",
  },
  {
    chip: "from-accent-50 to-accent-100 text-accent-700 ring-accent-100",
    bar: "bg-accent-500",
    hover: "hover:border-accent-300",
  },
] as const;

type Props = { /** Cap tiles so home stays scannable; full list stays in the sidebar. */ maxItems?: number };

export function WorkspaceGrid({ maxItems }: Props) {
  const items = useNavItems().filter((i) => i.to !== "/");
  const groups = NAV_GROUPS.filter((g) => g.label && items.some((i) => i.group === g.key));

  const cap = maxItems ?? items.length;
  let shown = 0;

  if (groups.length === 0 && items.length > 0) {
    const tone = TONES[0];
    const entries = items.slice(0, cap);
    return (
      <div className="space-y-8">
        <section aria-labelledby="ws-student-quick-access">
          <h2 id="ws-student-quick-access" className="mb-3.5 flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.08em] text-slate-600">
            <span className={cn("h-4 w-1 rounded-full", tone.bar)} aria-hidden="true" />
            More workspaces
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{entries.map((item) => tile(item, tone))}</ul>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group, index) => {
        if (shown >= cap) return null;
        const tone = TONES[index % TONES.length] ?? TONES[0];
        const entries = items.filter((i) => i.group === group.key).slice(0, Math.max(0, cap - shown));
        shown += entries.length;
        if (entries.length === 0) return null;
        return (
          <section key={group.key} aria-labelledby={`ws-${group.key}`}>
            <h2 id={`ws-${group.key}`} className="mb-3.5 flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.08em] text-slate-600">
              <span className={cn("h-4 w-1 rounded-full", tone.bar)} aria-hidden="true" />
              {group.label}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{entries.map((item) => tile(item, tone))}</ul>
          </section>
        );
      })}
      {items.length > cap ? (
        <p className="text-center text-xs text-slate-500">Use the sidebar or search for every screen you have access to.</p>
      ) : null}
    </div>
  );
}

function tile(item: import("@/app/navigation").NavItem, tone: (typeof TONES)[number]) {
  return (
    <li key={item.to} className="group">
      <Link
        to={item.to}
        className={cn(
          "relative flex h-full items-center gap-4 rounded-[1.25rem] border border-slate-100 bg-white p-4 sm:p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift",
          tone.hover,
        )}
      >
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1", tone.chip)}>
          <Icon name={item.icon} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-navy-950 group-hover:text-brand-700">{item.label}</span>
          <span className="block truncate text-xs text-slate-500">{item.hint}</span>
        </span>
        <Icon name="chevronRight" size={18} className="shrink-0 text-slate-300 group-hover:text-brand-600" />
      </Link>
    </li>
  );
}
