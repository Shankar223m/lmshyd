import { Link } from "react-router-dom";

import { quickActionGroupsForRole } from "@/modules/dashboard/roleDashboardCopy";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { useNavItems } from "@/app/useNavItems";
import { cn } from "@/core/lib/cn";
import { Icon } from "@/shared/ui";

/** Pinned shortcuts on the home page — only links the person can already open in the sidebar. */
export function RoleQuickActions() {
  const { user } = useAuth();
  const nav = useNavItems();
  const groups = quickActionGroupsForRole(user?.role);
  const allowed = new Set(nav.flatMap((i) => [i.to, ...(i.children?.map((c) => c.to) ?? [])]));

  const filterVisible = (actions: typeof groups[0]["actions"]) =>
    actions.filter(
      (a) => allowed.has(a.to) || [...allowed].some((path) => a.to.startsWith(`${path}/`) || path.startsWith(a.to)),
    );

  const visibleGroups = groups
    .map((g) => ({ ...g, actions: filterVisible(g.actions) }))
    .filter((g) => g.actions.length > 0);
  if (visibleGroups.length === 0) return null;

  return (
    <div className="mb-8 space-y-6">
      {visibleGroups.map((group) => (
        <section key={group.title} aria-labelledby={`dash-quick-${group.title.replace(/\s+/g, "-").toLowerCase()}`}>
          <h2
            id={`dash-quick-${group.title.replace(/\s+/g, "-").toLowerCase()}`}
            className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-slate-600"
          >
            {group.title}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {group.actions.map((action) => (
              <li key={action.to}>
                <Link
                  to={action.to}
                  className={cn(
                    "group flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-card transition",
                    "hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift",
                  )}
                >
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <Icon name={action.icon} size={20} />
                  </span>
                  <span className="font-semibold text-navy-950 group-hover:text-brand-800">{action.label}</span>
                  <span className="mt-1 text-xs text-slate-500">{action.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
