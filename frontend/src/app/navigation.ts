import { employersNavigation, userManagementNavigation } from "@/modules/user-management/navigation";
import type { MenuKey, Section } from "@/modules/user-management/common/permissions/types";
import type { ManagedRole } from "@/modules/user-management/common/types";
import { billingNavigation } from "@/modules/billing/navigation";
import { analyticsNavigation } from "@/modules/analytics/navigation";
import { aiInterviewNavigation } from "@/modules/ai-interview/navigation";
import { aiSettingsNavigation } from "@/modules/ai-settings/navigation";
import { aiTutorNavigation } from "@/modules/ai-tutor/navigation";
import { assessmentsNavigation } from "@/modules/assessments/navigation";
import { catalogNavigation } from "@/modules/catalog/navigation";
import { mediaNavigation } from "@/modules/media/navigation";
import { storeNavigation } from "@/modules/store/navigation";
import { certificatesNavigation } from "@/modules/certificates/navigation";
import { codeExecutionNavigation } from "@/modules/code-execution/navigation";
import { jobsNavigation } from "@/modules/jobs/navigation";
import { learningNavigation } from "@/modules/learning/navigation";
import { subscriptionsNavigation } from "@/modules/subscriptions/navigation";
import type { IconName } from "@/shared/ui";

/** Sidebar headings, in display order. A heading shows only when this person has something under it. */
export const NAV_GROUPS = [
  { key: "home", label: null },
  { key: "users", label: "User Management" },
  { key: "learn", label: "Academic Learning" },
  { key: "exams", label: "Exams & Certifications" },
  { key: "curriculum", label: "Curriculum & Authoring" },
  { key: "academics", label: "Batches & Institutions" },
  { key: "careers", label: "Career & Placements" },
  { key: "admin", label: "System Administration" },
] as const;

export type NavGroup = (typeof NAV_GROUPS)[number]["key"];

export type NavSubItem = {
  to: string;
  label: string;
  icon?: IconName;
  hint?: string;
  /** Optional count badge (actionable work). */
  badge?: number;
};

/**
 * One sidebar entry. Who sees it is the server's decision: a `menu` entry (feature level, `permissions.menu`) or,
 * for user-management's own screens, a `section` (`permissions.sections`). This only gives it a label, icon, place and path.
 */
export type NavItem = {
  to: string;
  label: string;
  icon: IconName;
  group: NavGroup;
  /** One plain line: what this screen is for (shown on the home page). */
  hint: string;
  /** A people screen of one role: shown only when the server lets this person see that role (`users.view_roles`). */
  viewRole?: ManagedRole;
  /** Nested sub-navigation items */
  children?: NavSubItem[];
} & ({ menu: MenuKey; section?: never } | { section: Section; menu?: never });

function asStudentAcademics(item: NavItem): NavItem {
  if (item.menu === "my_tests") return { ...item, group: "exams" };
  return { ...item, group: "learn" };
}

function asStudentCareers(item: NavItem): NavItem {
  return { ...item, group: "careers" };
}

/**
 * Student sidebar fallback — `sidebarByRole.ts` is used when signed in; this list remains for legacy callers.
 */
export const STUDENT_NAVIGATION: NavItem[] = [
  {
    section: "dashboard",
    label: "Dashboard",
    icon: "dashboard",
    to: "/",
    group: "home",
    hint: "Overview and daily learning progress",
  },
  ...learningNavigation.filter((i) => i.menu === "my_learning").map(asStudentAcademics),
  ...assessmentsNavigation.filter((i) => i.menu === "my_tests").map(asStudentAcademics),
  ...codeExecutionNavigation.map(asStudentAcademics),
  ...aiTutorNavigation.map(asStudentAcademics),
  ...certificatesNavigation.map(asStudentAcademics),
  {
    menu: "jobs",
    label: "Jobs & career",
    icon: "briefcase",
    to: "/jobs/student/dashboard",
    group: "careers",
    hint: jobsNavigation[0]?.hint ?? "Search, apply, and track placements",
  },
  ...aiInterviewNavigation.map(asStudentCareers),
  {
    menu: "my_learning",
    label: "Browse licensed courses",
    icon: "graduation",
    to: "/browse-courses",
    group: "learn",
    hint: "Courses your institution has licensed for students",
  },
];

/** Every entry, in display order within its group; each module contributes its own. */
export const NAVIGATION: NavItem[] = [
  { section: "dashboard", label: "Dashboard", icon: "dashboard", to: "/", group: "home", hint: "Platform overview and quick actions" },
  ...learningNavigation,
  ...catalogNavigation,
  ...mediaNavigation,
  ...storeNavigation,
  ...aiTutorNavigation,
  ...assessmentsNavigation,
  ...codeExecutionNavigation,
  ...certificatesNavigation,
  ...employersNavigation,
  ...jobsNavigation,
  ...aiInterviewNavigation,
  ...userManagementNavigation,
  ...subscriptionsNavigation,
  ...billingNavigation,
  ...analyticsNavigation,
  ...aiSettingsNavigation,
];
