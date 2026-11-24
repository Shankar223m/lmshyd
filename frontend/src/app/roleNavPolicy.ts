import type { MenuKey, Section } from "@/modules/user-management/common/permissions/types";
import type { Role } from "@/modules/user-management/common/types";

/** Student-only feature menus — never shown to platform or institution staff in the sidebar. */
export const LEARNER_MENUS: ReadonlySet<MenuKey> = new Set([
  "my_learning",
  "my_tests",
  "my_submissions",
  "store",
]);

const INSTITUTION_LEARNER_MENUS: ReadonlySet<MenuKey> = LEARNER_MENUS;

/** Menus hiring personas need (whitelist); everything else is hidden even if the API grants it. */
export const EMPLOYER_MENUS: ReadonlySet<MenuKey> = new Set(["jobs", "support", "billing"]);

/** Platform operator menus institution staff should not see by default (server may still grant exceptions). */
const STAFF_HIDDEN_MENUS: ReadonlySet<MenuKey> = new Set([
  ...INSTITUTION_LEARNER_MENUS,
  "subscriptions",
  "course_requests",
  "billing",
  "analytics",
  "ai_settings",
  "ai_interviews",
  // `jobs` is not hard-hidden: server permissions.menu decides placement officer access.
]);

const HEAD_EXTRA_HIDDEN_MENUS: ReadonlySet<MenuKey> = new Set(["media_library"]);

const STAFF_HIDDEN_SECTIONS: ReadonlySet<Section> = new Set([
  "admins",
  "institutions",
  "employers",
  "hierarchy",
  "permissions",
  "downloads",
  "audit_logs",
]);

const EMPLOYER_HIDDEN_SECTIONS: ReadonlySet<Section> = new Set([
  "admins",
  "institutions",
  "employers",
  "hierarchy",
  "permissions",
  "downloads",
  "audit_logs",
  "academics",
  "users",
  "catalog",
  "learning",
  "assessments",
  "certificates",
  "ai_tutor",
  "ai_interview",
  "analytics",
  "billing",
  "ai_gateway",
  "store",
  "subscriptions",
  "code_execution",
  "proctoring",
  "career",
  "job_portal", // section still used for jobs routes; menu is jobs
  "notifications",
]);

export function menusHiddenForRole(role: Role | string | undefined): ReadonlySet<MenuKey> | null {
  if (!role) return null;
  switch (role) {
    case "super_admin":
    case "admin":
      return INSTITUTION_LEARNER_MENUS;
    case "institution_head":
      return new Set([...INSTITUTION_LEARNER_MENUS, ...HEAD_EXTRA_HIDDEN_MENUS]);
    case "staff":
      return STAFF_HIDDEN_MENUS;
    case "employer_admin":
    case "recruiter":
      return null; // whitelist handled separately
    default:
      return null;
  }
}

export function sectionsHiddenForRole(role: Role | string | undefined): ReadonlySet<Section> | null {
  if (!role) return null;
  switch (role) {
    case "staff":
      return STAFF_HIDDEN_SECTIONS;
    case "employer_admin":
    case "recruiter":
      return EMPLOYER_HIDDEN_SECTIONS;
    default:
      return null;
  }
}

export function isMenuAllowedForRole(role: Role | string | undefined, menu: MenuKey): boolean {
  if (role === "employer_admin" || role === "recruiter") {
    return EMPLOYER_MENUS.has(menu);
  }
  const hidden = menusHiddenForRole(role);
  if (hidden?.has(menu)) return false;
  return true;
}

export function isSectionAllowedForRole(role: Role | string | undefined, section: Section): boolean {
  if (role === "employer_admin" || role === "recruiter") {
    if (EMPLOYER_HIDDEN_SECTIONS.has(section)) return false;
    return section === "dashboard" || section === "profile" || section === "security" || section === "job_portal" || section === "support" || section === "notifications";
  }
  const hidden = sectionsHiddenForRole(role);
  if (hidden?.has(section)) return false;
  return true;
}
