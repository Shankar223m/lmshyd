import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { cn } from "@/core/lib/cn";
import { Icon, type IconName } from "@/shared/ui";

export type WorkflowTab = { label: string; to: string; icon?: IconName; badge?: number };

/** @deprecated Funnel steps are no longer rendered. */
export type WorkflowStep = {
  label: string;
  to: string;
  match: string[];
};

type WorkflowShellProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  tabs: WorkflowTab[];
  steps?: WorkflowStep[];
  actions?: ReactNode;
};

/**
 * Minimal section chrome: optional short title + tabs + optional primary action.
 */
export function WorkflowShell({ title, tabs, actions }: WorkflowShellProps) {
  if (!tabs.length && !actions && !title) return null;

  return (
    <div className="workflow-shell mb-5 space-y-3">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title ? <h1 className="text-lg font-bold tracking-tight text-slate-900">{title}</h1> : <span />}
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {tabs.length > 0 && (
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <nav
            className="inline-flex min-w-full gap-0.5 rounded-xl border border-slate-200 bg-white p-1 sm:min-w-0"
            aria-label="Section tabs"
          >
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to.endsWith("/dashboard")}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    isActive
                      ? "bg-[#635BFF] text-white shadow-xs font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {tab.icon ? <Icon name={tab.icon} size={15} className="shrink-0 opacity-80" /> : null}
                    {tab.label}
                    {typeof tab.badge === "number" && tab.badge > 0 ? (
                      <span
                        className={cn(
                          "ml-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                          isActive ? "bg-white/25 text-white" : "bg-[#635BFF] text-white",
                        )}
                      >
                        {tab.badge > 99 ? "99+" : tab.badge}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
