import type { NavItem } from "@/app/navigation";
import { jobsNavigation } from "@/modules/jobs/navigation";
import type { Role } from "@/modules/user-management/common/types";
import { assessmentsNavigation } from "@/modules/assessments/navigation";
import { catalogNavigation } from "@/modules/catalog/navigation";
import { certificatesNavigation } from "@/modules/certificates/navigation";
import { codeExecutionNavigation } from "@/modules/code-execution/navigation";
import { learningNavigation } from "@/modules/learning/navigation";
import { aiTutorNavigation } from "@/modules/ai-tutor/navigation";
import { aiInterviewNavigation } from "@/modules/ai-interview/navigation";
import { subscriptionsNavigation } from "@/modules/subscriptions/navigation";
import { userManagementNavigation } from "@/modules/user-management/navigation";
import { PAYMENTS_ENABLED } from "@/core/config/features";

const homeDashboard: NavItem = {
  section: "dashboard",
  label: "Dashboard",
  icon: "dashboard",
  to: "/",
  group: "home",
  hint: "Overview and quick links for your role",
};

/** Institution teacher / faculty — learning ops + placements when LMS grants the jobs menu. */
export const STAFF_NAVIGATION: NavItem[] = [
  homeDashboard,
  ...userManagementNavigation.filter((i) => i.section === "my_organization"),
  ...learningNavigation.filter((i) => i.menu === "batches"),
  ...catalogNavigation,
  ...assessmentsNavigation.filter((i) => i.menu !== "my_tests"),
  ...codeExecutionNavigation.filter((i) => i.menu !== "my_submissions"),
  ...aiTutorNavigation,
  ...certificatesNavigation,
  ...jobsNavigation,
];

/** Institution head — runs the college: people, structure, batches, subscriptions, outcomes, placements. */
export const INSTITUTION_HEAD_NAVIGATION: NavItem[] = [
  homeDashboard,
  ...userManagementNavigation.filter((i) => {
    if (i.viewRole === "staff" || i.viewRole === "student") return true;
    const section = "section" in i ? i.section : undefined;
    return section === "my_organization" || section === "academics" || section === "audit_logs";
  }),
  ...subscriptionsNavigation,
  ...learningNavigation.filter((i) => i.menu === "batches"),
  ...catalogNavigation,
  ...assessmentsNavigation.filter((i) => i.menu !== "my_tests"),
  ...codeExecutionNavigation.filter((i) => i.menu !== "my_submissions"),
  ...aiTutorNavigation,
  ...certificatesNavigation,
  ...jobsNavigation,
  ...aiInterviewNavigation,
];

/** Employer / recruiter — hiring only. */
export const EMPLOYER_NAVIGATION: NavItem[] = [
  homeDashboard,
  ...jobsNavigation,
];

export function navigationBaseForRole(role: Role | string | undefined): "student" | "employer" | "staff" | "head" | "platform" {
  switch (role) {
    case "student":
      return "student";
    case "employer_admin":
    case "recruiter":
      return "employer";
    case "staff":
      return "staff";
    case "institution_head":
      return "head";
    default:
      return "platform";
  }
}

export function getRoleNavigationBase(kind: ReturnType<typeof navigationBaseForRole>, studentNav: NavItem[], platformNav: NavItem[]): NavItem[] {
  switch (kind) {
    case "student":
      return studentNav;
    case "employer":
      return EMPLOYER_NAVIGATION;
    case "staff":
      return STAFF_NAVIGATION;
    case "head":
      return INSTITUTION_HEAD_NAVIGATION;
    case "platform":
      return platformNav;
  }
}

/** Drop billing menu item when payments are disabled (heads may still have billing section server-side). */
export function stripDisabledProductMenus(items: NavItem[]): NavItem[] {
  if (PAYMENTS_ENABLED) return items;
  return items.filter((i) => i.menu !== "billing" && i.menu !== "store");
}
