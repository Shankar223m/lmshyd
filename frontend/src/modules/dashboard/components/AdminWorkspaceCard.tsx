import { Link } from "react-router-dom";

import { PAYMENTS_ENABLED } from "@/core/config/features";
import { useNavItems } from "@/app/useNavItems";
import { ADMIN_SCOPE_LABELS } from "@/modules/user-management/common/labels";
import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";
import type { AdminScope } from "@/modules/user-management/common/types";
import { Alert, Icon } from "@/shared/ui";

const SCOPE_QUICK_LINKS: Partial<Record<AdminScope, { label: string; to: string }>> = {
  "accounts.manage": { label: "Batches & subscriptions", to: "/batches" },
  "careers.manage": { label: "Review inbox", to: "/jobs/admin/review" },
  "content.author": { label: "Courses", to: "/courses" },
  "content.review": { label: "Course catalog", to: "/courses" },
  "exams.manage": { label: "Grading queue", to: "/grading/queue" },
  "support.manage": { label: "Support queue", to: "/support/queue" },
  "ai.manage": { label: "AI settings", to: "/ai" },
  "analytics.view": { label: "Analytics", to: "/analytics" },
  "billing.manage": { label: "Billing", to: "/billing" },
};

/** Explains what a scoped admin can do and links to the first relevant workspace. */
export function AdminWorkspaceCard() {
  const { permissions } = usePermissions();
  const nav = useNavItems();
  if (permissions.role !== "admin") return null;

  const scopes = permissions.scopes;
  if (scopes.length === 0) {
    return (
      <Alert tone="info" title="No platform scopes yet" className="mb-6 rounded-2xl">
        Your admin account has no assigned scopes. A super admin can grant scopes under{" "}
        <Link to="/admins" className="font-semibold underline">
          Admins
        </Link>
        .
      </Alert>
    );
  }

  const links = scopes
    .filter((scope) => PAYMENTS_ENABLED || scope !== "billing.manage")
    .map((scope) => SCOPE_QUICK_LINKS[scope])
    .filter((x): x is { label: string; to: string } => Boolean(x))
    .filter((link, idx, arr) => arr.findIndex((l) => l.to === link.to) === idx);

  return (
    <section className="mb-8 rounded-2xl border border-slate-100 bg-white p-5 shadow-card" aria-labelledby="admin-workspace">
      <h2 id="admin-workspace" className="flex items-center gap-2 text-base font-bold text-navy-950">
        <Icon name="shield" size={18} className="text-brand-700" />
        Your platform responsibilities
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Menus below match your assigned scopes. You have {nav.length} workspace {nav.length === 1 ? "entry" : "entries"} in the sidebar.
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {scopes.map((scope) => (
          <li key={scope} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {ADMIN_SCOPE_LABELS[scope]}
          </li>
        ))}
      </ul>
      {links.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-3">
          {links.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="text-sm font-semibold text-brand-700 hover:underline">
                {link.label} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
