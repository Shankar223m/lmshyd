import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, RotateCw, X, AlertCircle, Lock, Download } from "lucide-react";
import { apiFetch, type ApiResponse } from "../../../services/api";

type AuditRow = {
  id: string;
  actor_name: string;
  actor_email?: string;
  actor_role?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  created_at?: string;
  ip_address?: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "SY";
}

function formatWhen(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AdminAuditPage() {
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditRow | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", action, resourceType],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (action) params.set("action", action);
      if (resourceType) params.set("resource_type", resourceType);
      return apiFetch<ApiResponse<AuditRow[]>>(`/admin/audit-logs?${params}`);
    },
  });

  const rawLogs = data?.data || [];
  const logs = rawLogs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.actor_name.toLowerCase().includes(q) ||
      (l.actor_email || "").toLowerCase().includes(q) ||
      l.resource_id.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q)
    );
  });

  const clearFilters = () => {
    setAction("");
    setResourceType("");
    setSearch("");
  };

  return (
    <div className="flex w-full flex-col space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-tight text-slate-900">Activity log</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rawLogs.length} records · read-only audit trail
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
            <Lock className="h-3.5 w-3.5" /> Immutable
          </span>
          <button
            type="button"
            onClick={() => {
              const header = "time,actor,email,action,resource_type,resource_id\n";
              const rows = logs
                .map(
                  (l) =>
                    `"${l.created_at || ""}","${l.actor_name}","${l.actor_email || ""}","${l.action}","${l.resource_type}","${l.resource_id}"`,
                )
                .join("\n");
              const blob = new Blob([header + rows], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "activity-log.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor, action, or resource ID…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#7DC8F7] focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="">All actions</option>
            <option value="job.create">job.create</option>
            <option value="job.submit">job.submit</option>
            <option value="job.moderate">job.moderate</option>
            <option value="application.submit">application.submit</option>
            <option value="application.withdraw">application.withdraw</option>
            <option value="interview.schedule">interview.schedule</option>
            <option value="offer.respond">offer.respond</option>
            <option value="organization.verify">organization.verify</option>
          </select>
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="">All resources</option>
            <option value="job">job</option>
            <option value="application">application</option>
            <option value="interview">interview</option>
            <option value="offer">offer</option>
            <option value="organization">organization</option>
            <option value="user">user</option>
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={() => void refetch()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7DC8F7] border-t-transparent" />
          <p className="text-xs text-slate-500">Loading activity…</p>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Failed to load activity log. Please try again.</span>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 font-medium text-slate-500">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">
                      No activity events match current criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatWhen(l.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7DC8F7]/10 text-[10px] font-bold text-[#7DC8F7]">
                            {initials(l.actor_name || "System")}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-900">{l.actor_name || "System"}</div>
                            <div className="text-[11px] text-slate-400">{l.actor_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-[#7DC8F7]">
                          {l.action}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-medium text-slate-700">{l.resource_type}</span>
                        <span className="ml-1 text-slate-400">#{l.resource_id.slice(0, 8)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(l)}
                          className="font-semibold text-[#7DC8F7] hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {logs.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              Showing 1–{logs.length} of {rawLogs.length}
            </div>
          )}
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Event details</h3>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
              <div>
                <span className="block font-medium text-slate-400">Action</span>
                <span className="font-semibold text-slate-900">{selectedLog.action}</span>
              </div>
              <div>
                <span className="block font-medium text-slate-400">Timestamp</span>
                <span className="font-semibold text-slate-900">
                  {selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="block font-medium text-slate-400">Actor</span>
                <span className="font-semibold text-slate-900">{selectedLog.actor_name}</span>
                <span className="block text-[11px] text-slate-500">{selectedLog.actor_email}</span>
              </div>
              <div>
                <span className="block font-medium text-slate-400">Resource</span>
                <span className="font-semibold text-slate-900">
                  {selectedLog.resource_type} #{selectedLog.resource_id.slice(0, 8)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500">Audit records cannot be edited or deleted.</p>

            <div className="flex justify-end border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
