import { Drawer, Badge, EmptyState, Spinner } from "@/shared/ui";
import { useGetRbacAuditByIdQuery } from "@/modules/user-management/audit-logs/api/rbacAuditApi";
import { formatDateTime } from "@/core/lib/format";
import { ROLE_LABELS } from "@/modules/user-management/common/labels";
import type { Role } from "@/modules/user-management/common/types";

export function RbacAuditDetailDrawer({
  auditId,
  open,
  onClose,
}: {
  auditId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isFetching, isError } = useGetRbacAuditByIdQuery(auditId ?? "", { skip: !auditId });

  if (!auditId || !open) return null;

  const renderBadge = (value: string) => (
    <Badge tone={value === "ALLOW" ? "green" : value === "DENY" ? "red" : "gray"}>
      {value}
    </Badge>
  );

  return (
    <Drawer onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold text-slate-900">Audit event details</h2>
      {isFetching && (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      )}
      {isError && (
        <EmptyState icon="alert" title="Failed to load" description="Cannot retrieve audit details." />
      )}
      {data && (
        <div className="space-y-4 text-sm">
          <div><strong>ID:</strong> {data.audit_log_id}</div>
          <div><strong>Timestamp (UTC):</strong> {formatDateTime(data.time)}</div>
          <div><strong>Actor:</strong> {data.actor ? data.actor.full_name : "System"} ({data.actor?.role && (ROLE_LABELS[data.actor.role as Role] || data.actor.role)})</div>
          <div><strong>Target:</strong> {data.target ? `${data.target.type} ${data.target.id ?? ""}` : "—"}</div>
          <div><strong>Institution:</strong> {data.institution?.name ?? "—"}</div>
          <div><strong>Action:</strong> {data.action}</div>
          <div><strong>Permission key:</strong> {(data as any).permission_key ?? "—"}</div>
          <div><strong>Outcome:</strong> {(data as any).outcome ?? "—"}</div>
          <div><strong>Delegation:</strong> {(data as any).delegation_capability ?? "—"}</div>
          <div className="flex items-center space-x-2"><strong>Previous:</strong> {renderBadge((data as any).previous ?? "—")}</div>
          <div className="flex items-center space-x-2"><strong>New:</strong> {renderBadge((data as any).new ?? "—")}</div>
          {data.details?.reason != null && (
            <div><strong>Reason:</strong> {String(data.details.reason)}</div>
          )}
        </div>
      )}
    </Drawer>
  );
}
