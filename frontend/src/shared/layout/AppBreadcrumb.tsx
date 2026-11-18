import { Link, useLocation } from "react-router-dom";

import { cn } from "@/core/lib/cn";
import { flowKind } from "@/core/lib/flowRoutes";
import { Icon } from "@/shared/ui";

const LABELS: Record<string, string> = {
  courses: "Courses",
  jobs: "Jobs & placements",
  grading: "Grading",
  academics: "Academics",
  support: "Support",
  batches: "Batches",
  institutions: "Institutions",
  permissions: "Permissions",
  analytics: "Analytics",
  tutor: "AI tutor",
  "my-tests": "My tests",
};

function segments(pathname: string): { label: string; to?: string }[] {
  if (pathname === "/") return [{ label: "Home" }];
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; to?: string }[] = [];
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    acc += `/${part}`;
    const staticLabel = LABELS[part];
    const looksLikeId = /^[0-9a-f-]{8,}$/i.test(part) || /^\d+$/.test(part);
    crumbs.push({
      label: staticLabel ?? (looksLikeId ? "Details" : part.replace(/-/g, " ")),
      to: i < parts.length - 1 ? acc : undefined,
    });
  }
  return crumbs;
}

/** Compact trail under the top bar — hidden on auth and immersive course player. */
export function AppBreadcrumb({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const kind = flowKind(pathname);
  if (kind === "course" && pathname.includes("/learn")) return null;

  const crumbs = segments(pathname);
  if (crumbs.length <= 1 && pathname === "/") return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex min-w-0 items-center gap-1 text-xs text-slate-500", className)}>
      <Link to="/" className="hidden shrink-0 items-center gap-1 rounded-lg px-1.5 py-0.5 font-medium text-slate-500 transition hover:bg-slate-100 hover:text-brand-800 sm:inline-flex">
        <Icon name="dashboard" size={14} />
      </Link>
      {crumbs.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
          {i > 0 && <Icon name="chevronRight" size={12} className="shrink-0 text-slate-300" />}
          {c.to ? (
            <Link to={c.to} className="truncate font-medium capitalize transition hover:text-brand-800">
              {c.label}
            </Link>
          ) : (
            <span className="truncate font-semibold capitalize text-navy-950">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
