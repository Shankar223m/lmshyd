import { Link, useNavigate } from "react-router-dom";

import { AdminWorkspaceCard } from "@/modules/dashboard/components/AdminWorkspaceCard";
import { StudentCareersStrip } from "@/modules/dashboard/components/StudentCareersStrip";
import { StudentLearningStrip } from "@/modules/dashboard/components/StudentLearningStrip";
import { RoleQuickActions } from "@/modules/dashboard/components/RoleQuickActions";
import { TodayCards } from "@/modules/dashboard/components/TodayCards";
import { WelcomeHero } from "@/modules/dashboard/components/WelcomeHero";
import { WorkspaceGrid } from "@/modules/dashboard/components/WorkspaceGrid";
import { heroCopyForRole } from "@/modules/dashboard/roleDashboardCopy";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";
import { useListEmployersQuery } from "@/modules/user-management/employers/api/employersApi";
import { useListInstitutionsQuery } from "@/modules/user-management/institutions/api/institutionsApi";
import { useListAdminsQuery, useListUsersQuery } from "@/modules/user-management/users/api/usersApi";
import type { Role } from "@/modules/user-management/common/types";
import { Alert, Button, StatTile } from "@/shared/ui";

function useCount(kind: "institutions" | "employers" | "admins" | "users", params: Record<string, string>, enabled: boolean) {
  const institutions = useListInstitutionsQuery({ per_page: 1, ...params }, { skip: !enabled || kind !== "institutions" });
  const employers = useListEmployersQuery({ per_page: 1, ...params }, { skip: !enabled || kind !== "employers" });
  const admins = useListAdminsQuery({ per_page: 1, ...params }, { skip: !enabled || kind !== "admins" });
  const users = useListUsersQuery({ per_page: 1, ...params }, { skip: !enabled || kind !== "users" });
  const context = { institutions, employers, admins, users }[kind].data?.pageContext;
  if (!context) return "…";
  return context.total_is_exact ? context.total_records : `${context.total_records.toLocaleString()}+`;
}

const PERSON_ADD = [
  { role: "institution_head", label: "New institution head", to: "/institution-heads?add=1" },
  { role: "staff", label: "New staff", to: "/staff?add=1" },
  { role: "student", label: "New student", to: "/students?add=1" },
] as const;

function showPlatformStats(role: Role | string | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

function showWorkspaceGrid(role: Role | string | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

function workspaceCap(role: Role | string | undefined): number {
  if (role === "super_admin") return 9;
  if (role === "admin") return 6;
  if (role === "institution_head") return 6;
  return 0;
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { permissions, can } = usePermissions();
  const viewRoles = permissions.users.view_roles;
  const firstPerson = PERSON_ADD.find((p) => permissions.users.create_roles.includes(p.role));

  const institutions = useCount("institutions", {}, can("institutions"));
  const employers = useCount("employers", {}, can("employers"));
  const admins = useCount("admins", {}, permissions.admins.view);
  const heads = useCount("users", { role: "institution_head" }, viewRoles.includes("institution_head"));
  const staff = useCount("users", { role: "staff" }, viewRoles.includes("staff"));
  const students = useCount("users", { role: "student" }, viewRoles.includes("student"));

  if (!user) return null;
  const role = user.role;
  const firstName = user.full_name.split(" ")[0];
  const { tagline, progressLabel } = heroCopyForRole(role);
  const hasTiles = showPlatformStats(role) && (viewRoles.length > 0 || can("institutions") || can("employers") || permissions.admins.view);
  const isStudent = role === "student";

  const create = [
    permissions.admins.create && { label: "New admin", to: "/admins?add=1" },
    permissions.institutions.create && { label: "New institution", to: "/institutions?add=1" },
    permissions.employers.create && { label: "New company", to: "/employers/new" },
    firstPerson && { label: firstPerson.label, to: firstPerson.to },
  ].filter((a): a is { label: string; to: string } => Boolean(a));

  return (
    <>
      <WelcomeHero
        firstName={firstName ?? user.full_name}
        subtitle={user.institution?.name ?? undefined}
        tagline={tagline}
        progressLabel={progressLabel}
        actions={
          create.length > 0
            ? create.map((a, i) => (
                <Button
                  key={a.to}
                  icon="plus"
                  variant={i === 0 ? "primary" : "secondary"}
                  className={
                    i === 0
                      ? "bg-white text-[#635BFF] hover:bg-indigo-50 shadow-none font-bold"
                      : "border-white/40 bg-white/10 text-white hover:bg-white/20"
                  }
                  onClick={() => navigate(a.to)}
                >
                  {a.label}
                </Button>
              ))
            : undefined
        }
      />

      {role === "admin" && <AdminWorkspaceCard />}

      {user.mfa_setup_required && (
        <Alert tone="info" title="Add two-factor authentication" className="mb-6 rounded-2xl">
          Protect your account with a code from your phone.{" "}
          <Link to="/account/security" className="font-medium underline">
            Set it up
          </Link>
        </Alert>
      )}

      {isStudent && (
        <>
          <StudentLearningStrip />
          <StudentCareersStrip />
        </>
      )}

      <RoleQuickActions />

      {hasTiles && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {permissions.admins.view && <StatTile icon="shield" label="Admins" value={admins} to="/admins" />}
          {can("institutions") && <StatTile icon="building" label="Institutions" value={institutions} to="/institutions" />}
          {can("employers") && <StatTile icon="briefcase" label="Companies" value={employers} to="/employers" />}
          {viewRoles.includes("institution_head") && (
            <StatTile icon="user" label="Institution heads" value={heads} to="/users?role=institution_head" />
          )}
          {viewRoles.includes("staff") && <StatTile icon="briefcase" label="Staff" value={staff} to="/users?role=staff" />}
          {viewRoles.includes("student") && (
            <StatTile icon="graduation" label="Students" value={students} to="/users?role=student" />
          )}
        </div>
      )}

      {(isStudent || role === "staff") && <TodayCards />}

      {showWorkspaceGrid(role) && workspaceCap(role) > 0 ? <WorkspaceGrid maxItems={workspaceCap(role)} /> : null}
      {role === "institution_head" && <WorkspaceGrid maxItems={6} />}
    </>
  );
}
