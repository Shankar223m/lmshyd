import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, ShieldAlert, Briefcase, Users, Clock } from "lucide-react";
import { apiFetch, type ApiResponse } from "../../../services/api";

type ModerationJob = {
  id: string;
  title: string;
  organization_name?: string;
  location?: string;
  work_mode?: string;
  employment_type?: string;
  openings?: number;
  created_at?: string;
  status: string;
};

type AuditRow = {
  id: string;
  actor_name: string;
  action: string;
  resource_type: string;
  resource_id: string;
  created_at?: string;
};

function daysWaiting(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function formatShortDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatActivityWhen(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function activityLabel(row: AuditRow): string {
  const a = row.action.toLowerCase();
  if (a.includes("application") && a.includes("submit")) return `${row.actor_name} applied`;
  if (a.includes("job") && a.includes("submit")) return `${row.actor_name} submitted a job`;
  if (a.includes("moderate") || a.includes("approve")) return `${row.actor_name} moderated a job`;
  if (a.includes("verify")) return `${row.actor_name} verified an organisation`;
  return `${row.actor_name} · ${row.action}`;
}

export function AdminDashboardPage() {
  const { data: statsData, isLoading, isError } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch<ApiResponse<Record<string, number>>>("/admin/stats"),
  });
  const stats = statsData?.data || {};

  const { data: queueData } = useQuery({
    queryKey: ["admin-jobs", "queue"],
    queryFn: () => apiFetch<ApiResponse<ModerationJob[]>>("/admin/jobs?tab=queue"),
  });
  const pendingJob = (queueData?.data || [])[0];

  const { data: activityData } = useQuery({
    queryKey: ["audit-logs", "overview"],
    queryFn: () => apiFetch<ApiResponse<AuditRow[]>>("/admin/audit-logs?limit=8"),
  });
  const activity = activityData?.data || [];

  const pendingOrgs = stats.pending_organizations ?? 0;
  const pendingJobs = stats.pending_jobs ?? 0;
  const activeJobs = stats.active_jobs ?? 0;
  const totalApplications = stats.total_applications ?? 0;
  const statusTotal = activeJobs + pendingJobs;
  const livePct = statusTotal ? Math.round((activeJobs / statusTotal) * 100) : 0;
  const reviewPct = statusTotal ? 100 - livePct : 0;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-tight text-slate-900">Jobs &amp; Placements</h1>
          <p className="mt-1 text-sm text-slate-500">Recruitment operations · {today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/jobs/admin/review"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Review inbox
            {pendingJobs + pendingOrgs > 0 && (
              <span className="ml-2 rounded-full bg-[#7DC8F7] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {pendingJobs + pendingOrgs}
              </span>
            )}
          </Link>
          <Link
            to="/jobs/admin/jobs/new"
            className="inline-flex items-center rounded-xl bg-[#7DC8F7] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#5CB8EC]"
          >
            Create job
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading overview…</p>}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load overview metrics.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {pendingJob && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                      Awaiting moderation
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800/80">
                      <Clock className="h-3.5 w-3.5" />
                      Waiting {daysWaiting(pendingJob.created_at)} days
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-bold text-slate-900">{pendingJob.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {pendingJob.organization_name || "Employer"}
                    <span className="text-slate-400"> · </span>
                    {pendingJob.location || "Remote"} · {(pendingJob.work_mode || "").replace(/_/g, " ")}
                    {pendingJob.created_at ? ` · Submitted ${formatShortDate(pendingJob.created_at)}` : ""}
                  </p>
                </div>
                <Link
                  to={`/jobs/admin/review?job=${pendingJob.id}`}
                  className="shrink-0 rounded-xl bg-[#7DC8F7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5CB8EC]"
                >
                  Review
                </Link>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Organisations to verify"
              value={pendingOrgs}
              hint={pendingOrgs ? "Open queue" : "None waiting"}
              to="/jobs/admin/review?tab=orgs"
              icon={<Building2 className="h-4 w-4 text-[#7DC8F7]" />}
              iconBg="bg-[#7DC8F7]/10"
            />
            <KpiCard
              label="Jobs to review"
              value={pendingJobs}
              hint="Open queue"
              to="/jobs/admin/review?tab=jobs"
              icon={<ShieldAlert className="h-4 w-4 text-amber-600" />}
              iconBg="bg-amber-50"
            />
            <KpiCard
              label="Active job postings"
              value={activeJobs}
              hint="Live now"
              to="/jobs/admin/postings"
              icon={<Briefcase className="h-4 w-4 text-emerald-600" />}
              iconBg="bg-emerald-50"
            />
            <KpiCard
              label="Total applications"
              value={totalApplications}
              hint="View activity"
              to="/jobs/admin/audit"
              icon={<Users className="h-4 w-4 text-slate-500" />}
              iconBg="bg-slate-100"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Job postings by status</h2>
              <span className="text-xs font-medium text-slate-500">{statusTotal} jobs</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="flex h-full w-full">
                <div className="h-full bg-emerald-500" style={{ width: `${livePct}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${reviewPct}%` }} />
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <StatusRow color="bg-emerald-500" label="Live" count={activeJobs} pct={livePct} />
              <StatusRow color="bg-amber-400" label="Under review" count={pendingJobs} pct={reviewPct} />
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Shows Live and Under review postings only.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <QuickAction to="/jobs/admin/jobs/new" title="Create a job" />
            <QuickAction to="/jobs/admin/review" title="Open review inbox" />
            <QuickAction to="/jobs/admin/audit" title="View activity log" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
              <Link to="/jobs/admin/audit" className="text-sm font-semibold text-[#7DC8F7] hover:underline">
                View all
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.slice(0, 6).map((row) => (
                  <li key={row.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7DC8F7]/15 text-xs font-bold text-[#5CB8EC]">
                      {initials(row.actor_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{activityLabel(row)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {row.resource_type} #{row.resource_id?.slice(0, 8)}
                        {row.created_at ? ` · ${formatActivityWhen(row.created_at)}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  to,
  icon,
  iconBg,
}: {
  label: string;
  value: number;
  hint: string;
  to: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50/60"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${iconBg}`}>{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </Link>
  );
}

function StatusRow({
  color,
  label,
  count,
  pct,
}: {
  color: string;
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="inline-flex items-center gap-2 text-slate-700">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-semibold text-slate-900">
        {count} <span className="font-normal text-slate-400">· {pct}%</span>
      </span>
    </div>
  );
}

function QuickAction({ to, title }: { to: string; title: string }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-800 transition hover:border-[#7DC8F7]/40 hover:text-[#5CB8EC]"
    >
      {title} →
    </Link>
  );
}
