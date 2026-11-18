import { useMemo, useState } from "react";
import { useListParams } from "@/core/hooks/useListParams";
import { formatDateTime } from "@/core/lib/format";
import { useListRbacAuditLogsQuery } from "@/modules/user-management/audit-logs/api/rbacAuditApi";
import type { RbacAuditLog, RbacAuditLogFilters } from "@/modules/user-management/audit-logs/api/rbacAuditApi";
import { ROLE_LABELS } from "@/modules/user-management/common/labels";
import type { Role } from "@/modules/user-management/common/types";
import { Card, type Column, DataTable, EmptyState, PageHeader, Pagination } from "@/shared/ui";
import { RbacAuditFilters } from "../components/RbacAuditFilters";
import { RbacAuditDetailDrawer } from "../components/RbacAuditDetailDrawer";

export function RbacAuditPage() {
  const { params, update, reset } = useListParams<RbacAuditLogFilters>({
    page: 1,
    per_page: 20,
  });
  const apiParams = params as RbacAuditLogFilters & { page: number; per_page: number };
  const { data, isFetching, isError, refetch } = useListRbacAuditLogsQuery(apiParams);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const columns = useMemo<Column<RbacAuditLog>[]>(
    () => [
      { key: "time", header: "When", render: (log) => <span className="whitespace-nowrap">{formatDateTime(log.time)}</span> },
      { key: "actor", header: "Actor", render: (log) =>
          log.actor ? (
            <div className="min-w-0">
              <p className="truncate text-slate-900">{log.actor.full_name}</p>
              <p className="truncate text-xs text-slate-500">{ROLE_LABELS[log.actor.role as Role] || log.actor.role}</p>
            </div>
          ) : (
            <span className="text-slate-500">System</span>
          )
        },
      { key: "actor_role", header: "Actor role", render: (log) => log.actor?.role ?? "—" },
      { key: "target", header: "Target", hideOnMobile: true, render: (log) => {
          if (!log.target) return "—";
          const pathMap: Record<string, string> = { user: "/users", institution: "/institutions", employer: "/employers" };
          const path = pathMap[log.target.type];
          const label = log.target.name ?? log.target.type;
          return path && log.target.id ? (
            <a className="text-brand-700 hover:underline" href={`${path}/${log.target.id}`}>{label}</a>
          ) : (
            <span>{label}</span>
          );
        } },
      { key: "institution", header: "Institution", hideOnMobile: true, render: (log) => log.institution?.name ?? "—" },
      { key: "action", header: "Action", render: (log) => <p className="font-medium text-slate-900" title={log.action}>{log.action}</p> },
      { key: "permission_key", header: "Permission key", render: (log) => (log as any).permission_key ?? "—" },
      { key: "outcome", header: "Outcome", render: (log) => (log as any).outcome ?? "—" },
    ],
    []
  );

  return (
    <>
      <PageHeader title="RBAC Audit" description="Audit trail for RBAC permission changes." />
      <Card bodyClassName="p-0">
        <RbacAuditFilters params={apiParams} update={update} reset={reset} />
        {isError ? (
          <EmptyState
            icon="alert"
            title="Could not load RBAC audit"
            description="Try again later."
            action={<button onClick={() => void refetch()}>Retry</button>}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.items ?? []}
              rowKey={(log: RbacAuditLog) => log.audit_log_id}
              loading={isFetching}
              empty={<EmptyState icon="search" title="No records" description="No audit events match the filters." />}
              onRowClick={(log) => setSelectedId(log.audit_log_id)}
            />
            <Pagination
              pageContext={data?.pageContext}
              disabled={isFetching}
              onPageChange={(next) => update({ page: next })}
              onPerPageChange={(next) => update({ per_page: next })}
            />
            <RbacAuditDetailDrawer
              auditId={selectedId}
              open={Boolean(selectedId)}
              onClose={() => setSelectedId(null)}
            />
          </>
        )}
      </Card>
    </>
  );
}
