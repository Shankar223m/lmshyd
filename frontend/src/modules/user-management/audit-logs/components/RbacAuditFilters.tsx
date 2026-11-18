import { useState } from "react";
import { FilterBar, FilterSelect, FilterDate, FilterText } from "@/shared/ui";
import type { RbacAuditLogFilters } from "@/modules/user-management/audit-logs/api/rbacAuditApi";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "institution_head", label: "Institution Head" },
];

const OUTCOME_OPTIONS = [
  { value: "SUCCESS", label: "Success" },
  { value: "FAILURE", label: "Failure" },
];

const DELEGATION_OPTIONS = [
  { value: "INHERIT", label: "Inherit" },
  { value: "ALLOW", label: "Allow" },
  { value: "DENY", label: "Deny" },
];

export function RbacAuditFilters({
  params,
  update,
  reset,
}: {
  params: RbacAuditLogFilters & { page: number; per_page: number };
  update: (changes: Partial<RbacAuditLogFilters>) => void;
  reset: () => void;
}) {
  const { user } = useAuth();
  const institutionSelectEnabled = user?.role === "super_admin";

  const [search, setSearch] = useState("");

  const activeCount = Object.values(params).filter(
    (v) => v !== undefined && v !== ""
  ).length;

  return (
    <FilterBar
      search={search}
      onSearch={setSearch}
      activeCount={activeCount}
      onReset={reset}
      primary={
        <>
          <FilterText
            label="Actor ID"
            value={params.actor_user_id ? String(params.actor_user_id) : ""}
            onChange={(v) => update({ actor_user_id: v ? Number(v) : undefined })}
          />
          <FilterText
            label="Target User ID"
            value={params.target_user_id ? String(params.target_user_id) : ""}
            onChange={(v) => update({ target_user_id: v ? Number(v) : undefined })}
          />
          {institutionSelectEnabled && (
            <FilterText
              label="Institution ID"
              value={params.institution_id ? String(params.institution_id) : ""}
              onChange={(v) => update({ institution_id: v ? Number(v) : undefined })}
            />
          )}
          <FilterSelect
            label="Actor Role"
            options={ROLE_OPTIONS}
            value={params.actor_role ?? ""}
            onChange={(v) => update({ actor_role: v || undefined })}
          />
        </>
      }
      more={
        <>
          <FilterText
            label="Permission Key"
            value={params.permission_key ?? ""}
            onChange={(v) => update({ permission_key: v || undefined })}
          />
          <FilterSelect
            label="Delegation"
            options={DELEGATION_OPTIONS}
            value={params.delegation_capability ?? ""}
            onChange={(v) => update({ delegation_capability: v || undefined })}
          />
          <FilterSelect
            label="Outcome"
            options={OUTCOME_OPTIONS}
            value={params.outcome ?? ""}
            onChange={(v) => update({ outcome: v || undefined })}
          />
          <FilterDate
            label="From (UTC)"
            value={params.created_from ?? ""}
            onChange={(v) => update({ created_from: v || undefined })}
          />
          <FilterDate
            label="To (UTC)"
            value={params.created_to ?? ""}
            onChange={(v) => update({ created_to: v || undefined })}
          />
        </>
      }
    />
  );
}
