import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Card, DataTable, EmptyState, SearchInput, Select, Spinner } from "@/shared/ui";
import type { Column } from "@/shared/ui/DataTable";
import { RoleBadge, StatusBadge } from "@/modules/user-management/common/components/UserBadges";
import { ROLE_LABELS } from "@/modules/user-management/common/labels";
import type { ManagedRole, Role, UserStatus } from "@/modules/user-management/common/types";
import { useListAdminsQuery, useListUsersQuery } from "@/modules/user-management/users/api/usersApi";
import { PersonPermissionsCard } from "@/modules/user-management/permissions/components/PersonPermissionsCard";
import { useListRbacAuditLogsQuery } from "@/modules/user-management/audit-logs/api/rbacAuditApi";

export interface SelectedPerson {
  user_id: string;
  full_name: string;
  email: string | null;
  username: string;
  role: Role;
  status: UserStatus;
  institutionName?: string;
}

const ROLE_OPTIONS = [
  { value: "all", label: "All roles" },
  { value: "admin", label: "Admin" },
  { value: "institution_head", label: "Institution head" },
  { value: "staff", label: "Staff" },
  { value: "student", label: "Student" },
];

export function IndividualPermissionsWorkspace({
  initialUserId,
  onBackToRoles,
}: {
  initialUserId?: string;
  onBackToRoles?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<SelectedPerson | null>(null);

  // Queries for real users
  const isAllOrAdmin = roleFilter === "all" || roleFilter === "admin";
  const managedRole = roleFilter !== "all" && roleFilter !== "admin" ? (roleFilter as ManagedRole) : undefined;

  const { data: usersData, isLoading: loadingUsers } = useListUsersQuery({
    search_text: search.trim() || undefined,
    role: managedRole,
    page: 1,
    per_page: 50,
  });

  const { data: adminsData, isLoading: loadingAdmins } = useListAdminsQuery(
    {
      search_text: search.trim() || undefined,
      page: 1,
      per_page: 50,
    },
    { skip: !isAllOrAdmin }
  );

  // Combined real user items
  const combinedUsers = useMemo<SelectedPerson[]>(() => {
    const list: SelectedPerson[] = [];

    if (isAllOrAdmin && adminsData?.items) {
      for (const a of adminsData.items) {
        list.push({
          user_id: String(a.user_id),
          full_name: a.full_name,
          email: a.email,
          username: a.username,
          role: a.role,
          status: a.status,
          institutionName: a.institution?.name,
        });
      }
    }

    if (roleFilter !== "admin" && usersData?.items) {
      for (const u of usersData.items) {
        list.push({
          user_id: String(u.user_id),
          full_name: u.full_name,
          email: u.email,
          username: u.username,
          role: u.role,
          status: u.status,
          institutionName: u.institution?.name,
        });
      }
    }

    return list;
  }, [adminsData, usersData, isAllOrAdmin, roleFilter]);

  // Pre-select initial user if provided
  useEffect(() => {
    if (initialUserId && !selectedUser && combinedUsers.length > 0) {
      const match = combinedUsers.find((u) => u.user_id === initialUserId);
      if (match) setSelectedUser(match);
    }
  }, [initialUserId, combinedUsers, selectedUser]);

  const isLoading = loadingUsers || (isAllOrAdmin && loadingAdmins);

  const columns: Column<SelectedPerson>[] = [
    {
      key: "user",
      header: "User",
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.full_name} size="sm" />
          <div>
            <div className="font-medium text-slate-900">{u.full_name}</div>
            <div className="text-xs text-slate-500">{u.email || `@${u.username}`}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (u) => <RoleBadge role={u.role} />,
    },
    {
      key: "institution",
      header: "Institution",
      render: (u) => <span className="text-sm text-slate-600">{u.institutionName || "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: "actions",
      header: null,
      render: (u) => (
        <Button size="sm" variant="secondary" onClick={() => setSelectedUser(u)}>
          Configure Permissions
        </Button>
      ),
    },
  ];

  if (selectedUser) {
    return (
      <div className="space-y-6">
        {/* Selected Person Banner */}
        <Card bodyClassName="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={selectedUser.full_name} size="md" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-slate-900">{selectedUser.full_name}</span>
                  <RoleBadge role={selectedUser.role} />
                  <StatusBadge status={selectedUser.status} />
                </div>
                <div className="text-xs text-slate-500">
                  {selectedUser.email && <span className="mr-3">{selectedUser.email}</span>}
                  <span>@{selectedUser.username}</span>
                  {selectedUser.institutionName && <span className="ml-3 font-medium text-slate-600">· {selectedUser.institutionName}</span>}
                </div>
              </div>
            </div>
            <Button variant="ghost" icon="chevronLeft" onClick={() => setSelectedUser(null)}>
              Choose another user
            </Button>
          </div>
        </Card>

        {/* Live Permission Editor */}
        <PersonPermissionsCard
          userId={selectedUser.user_id}
          role={selectedUser.role}
          name={selectedUser.full_name}
        />

        {/* Audit History for this person */}
        <UserAuditHistory targetUserId={Number(selectedUser.user_id)} userName={selectedUser.full_name} />
      </div>
    );
  }

  return (
    <Card
      title="Select an Individual User"
      description="Select any specific person to customize their permission overrides, review their effective permissions, or inspect their audit trail."
      actions={
        onBackToRoles ? (
          <Button size="sm" variant="ghost" icon="chevronLeft" onClick={onBackToRoles}>
            Back to Role Defaults
          </Button>
        ) : undefined
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email or username"
          className="w-full sm:w-80"
        />
        <div className="w-full sm:w-48">
          <Select
            options={ROLE_OPTIONS}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-500 sm:ml-auto">
          {isLoading ? "Loading users…" : `${combinedUsers.length} users found`}
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={combinedUsers}
        rowKey={(u) => u.user_id}
        loading={isLoading}
        onRowClick={(u) => setSelectedUser(u)}
        empty={
          <EmptyState
            icon="user"
            title="No users match your criteria"
            description="Try searching for another name, email or switching role filter."
          />
        }
      />
    </Card>
  );
}

function UserAuditHistory({ targetUserId, userName }: { targetUserId: number; userName: string }) {
  const { data: auditData, isLoading } = useListRbacAuditLogsQuery({
    target_user_id: targetUserId,
    page: 1,
    per_page: 20,
  });

  const logs = auditData?.items ?? [];

  return (
    <Card
      title={`Permission audit history for ${userName}`}
      description="Record of recent permission overrides, role delegations, and security modifications."
      bodyClassName="p-0"
    >
      {isLoading ? (
        <div className="p-6 text-center"><Spinner /></div>
      ) : logs.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">
          No permission changes recorded yet for this user.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {logs.map((log) => {
            const time = new Date(log.time).toLocaleString();
            const actorName = log.actor?.full_name || "System";
            const actorRole = log.actor?.role ? ROLE_LABELS[log.actor.role as Role] || log.actor.role : "";
            const details = log.details || {};
            const key = log.permission_key || (details.permission as string) || (details.key as string) || "Permission update";
            const outcome = log.outcome || "SUCCESS";

            return (
              <div key={log.audit_log_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-slate-800">
                    <span className="font-semibold">{key}</span> · {log.action}
                  </div>
                  <div className="text-xs text-slate-500">
                    By {actorName} {actorRole && `(${actorRole})`} on {time}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <span className={`inline-block rounded px-2 py-0.5 font-medium ${outcome === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {outcome}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
