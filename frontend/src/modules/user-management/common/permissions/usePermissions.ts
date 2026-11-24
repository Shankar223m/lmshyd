import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { useGetMyPermissionsQuery } from "@/modules/user-management/common/permissions/permissionsApi";
import type { MenuKey, Permissions, Section } from "@/modules/user-management/common/permissions/types";
import type { AdminScope } from "@/modules/user-management/common/types";

const ALL_ADMIN_SCOPES: AdminScope[] = [
  "accounts.manage",
  "careers.manage",
  "content.author",
  "content.review",
  "exams.manage",
  "support.manage",
  "ai.manage",
  "analytics.view",
  "billing.manage",
];

const EMPTY: Permissions = {
  role: "student",
  organization_type: null,
  scopes: [],
  permissions: [],
  sections: [],
  menu: [],
  users: {
    view_roles: [],
    create_roles: [],
    can_import: false,
    can_export: false,
    filter_statuses: [],
    filter_by_institution: false,
  },
  admins: { view: false, create: false },
  institutions: { create: false, export: false, filter_statuses: [], filter_by_admin: false, reassign_admin: false },
  employers: { create: false, export: false, filter_statuses: [], filter_by_admin: false, reassign_admin: false },
  admin_scopes: [],
  audit_logs: { view: false },
  academics: { view: false, manage: false },
};

const SUPER_ADMIN_PERMISSIONS: Permissions = {
  role: "super_admin",
  organization_type: null,
  scopes: ALL_ADMIN_SCOPES,
  permissions: ALL_ADMIN_SCOPES,
  sections: [
    "dashboard", "admins", "permissions", "institutions", "employers", "hierarchy",
    "academics", "users", "downloads", "audit_logs", "catalog", "subscriptions",
    "learning", "code_execution", "assessments", "proctoring", "certificates",
    "ai_tutor", "support", "career", "job_portal", "ai_interview", "notifications",
    "analytics", "billing", "ai_gateway", "profile", "security"
  ],
  menu: [
    "batches", "courses", "learning_paths", "media_library", "course_requests",
    "subscriptions", "problems", "compiler", "ai_tutor", "question_bank",
    "tests", "attempts", "grading", "proctoring", "certificates", "support",
    "career", "jobs", "ai_interviews", "analytics", "billing", "ai_settings"
  ],
  users: {
    view_roles: ["institution_head", "staff", "student", "employer_admin", "recruiter"],
    create_roles: ["institution_head", "staff", "student"],
    can_import: true,
    can_export: true,
    filter_statuses: ["active", "suspended", "deleted"],
    filter_by_institution: true,
  },
  admins: { view: true, create: true },
  institutions: { create: true, export: true, filter_statuses: ["active", "suspended", "deleted"], filter_by_admin: true, reassign_admin: true },
  employers: { create: true, export: true, filter_statuses: ["active", "suspended", "deleted"], filter_by_admin: true, reassign_admin: true },
  admin_scopes: ALL_ADMIN_SCOPES,
  audit_logs: { view: true },
  academics: { view: true, manage: true },
};

/**
 * What the signed-in person may do. Super admin always holds every permission.
 */
export function usePermissions(): { permissions: Permissions; isLoading: boolean; can: (section: Section) => boolean; canOpen: (entry: MenuKey) => boolean } {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const { data, isLoading, isFetching, isUninitialized } = useGetMyPermissionsQuery(undefined, {
    skip: !user,
  });

  const fallback = isSuperAdmin ? SUPER_ADMIN_PERMISSIONS : EMPTY;
  const permissions = data ?? fallback;
  const loading = !data && (isLoading || isFetching || isUninitialized);

  return {
    permissions,
    isLoading: loading,
    can: (section) => (isSuperAdmin ? true : permissions.sections.includes(section)),
    canOpen: (entry) => (isSuperAdmin ? true : permissions.menu.includes(entry)),
  };
}
