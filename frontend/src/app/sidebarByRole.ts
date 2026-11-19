import type { NavItem, NavSubItem } from "@/app/navigation";
import type { IconName } from "@/shared/ui";
import type { Role } from "@/modules/user-management/common/types";
import type { MenuKey, Section } from "@/modules/user-management/common/permissions/types";

const home: NavItem = {
  section: "dashboard",
  label: "Dashboard",
  icon: "dashboard",
  to: "/",
  group: "home",
  hint: "Overview and quick links",
};

function item(
  opts: {
    label: string;
    to: string;
    icon: IconName;
    group: NavItem["group"];
    hint: string;
    children?: NavSubItem[];
  } & ({ menu: MenuKey; section?: never } | { section: Section; menu?: never }),
): NavItem {
  return { ...opts };
}

const jobsStudentChildren: NavSubItem[] = [
  { label: "Find jobs", to: "/jobs/student/jobs", icon: "search" },
  { label: "Applications", to: "/jobs/student/applications", icon: "fileText" },
  { label: "Campus interviews", to: "/jobs/student/interviews", icon: "calendar" },
  { label: "AI mock interviews", to: "/interviews", icon: "video" },
  { label: "Offers & placement", to: "/jobs/student/offers", icon: "check" },
  { label: "Résumé & career profile", to: "/jobs/student/profile", icon: "user" },
];

const jobsModeratorChildren: NavSubItem[] = [
  { label: "Postings", to: "/jobs/admin/postings", icon: "briefcase" },
  { label: "Create job", to: "/jobs/admin/jobs/new", icon: "plus" },
  { label: "Review inbox", to: "/jobs/admin/review", icon: "fileText" },
  { label: "Hiring companies", to: "/employers", icon: "building" },
  { label: "Activity", to: "/jobs/admin/audit", icon: "search" },
];

const jobsEmployerChildren: NavSubItem[] = [
  { label: "All jobs", to: "/jobs/employer/jobs", icon: "briefcase" },
  { label: "Create job", to: "/jobs/employer/jobs/new", icon: "plus" },
];

const placementsHeadChildren: NavSubItem[] = [
  { label: "Companies", to: "/employers", icon: "building" },
  { label: "Jobs", to: "/jobs/institution/placements", icon: "briefcase" },
  { label: "Campus posting", to: "/jobs/institution/jobs/new", icon: "plus" },
  { label: "Student applications", to: "/jobs/institution/students", icon: "fileText" },
  { label: "Placement stats", to: "/jobs/institution/analytics", icon: "chart" },
];

export type SidebarOptions = {
  /** LMS admin with careers.manage (JCMS moderation). */
  jobsModerator?: boolean;
};

function studentNav(): NavItem[] {
  return [
    home,
    item({
      menu: "my_learning",
      label: "My courses",
      icon: "graduation",
      to: "/courses/my",
      group: "learn",
      hint: "Enrolled courses and progress",
    }),
    item({
      menu: "my_tests",
      label: "Tests & certificates",
      icon: "fileText",
      to: "/my-tests",
      group: "exams",
      hint: "Tests, results and credentials",
      children: [
        { label: "Tests", to: "/my-tests", icon: "fileText" },
        { label: "Results", to: "/results", icon: "chart" },
        { label: "Certificates", to: "/certificates", icon: "award" },
      ],
    }),
    item({
      menu: "problems",
      label: "Coding practice",
      icon: "terminal",
      to: "/problems",
      group: "learn",
      hint: "Problems, submissions and compiler",
      children: [
        { label: "Problems", to: "/problems", icon: "terminal" },
        { label: "My submissions", to: "/submissions", icon: "upload" },
        { label: "Compiler", to: "/compiler", icon: "play" },
      ],
    }),
    item({
      menu: "jobs",
      label: "Jobs & career",
      icon: "briefcase",
      to: "/jobs/student/dashboard",
      group: "careers",
      hint: "Discover roles, apply and track placement",
      children: jobsStudentChildren,
    }),
  ];
}

function staffNav(): NavItem[] {
  return [
    home,
    item({
      menu: "batches",
      label: "Batches",
      icon: "layers",
      to: "/batches",
      group: "academics",
      hint: "Student groups and progress",
      children: [
        { label: "Students", to: "/batches", icon: "users" },
        { label: "Progress", to: "/academics/student-progress", icon: "chart" },
      ],
    }),
    item({
      menu: "courses",
      label: "Courses",
      icon: "fileText",
      to: "/courses",
      group: "curriculum",
      hint: "Catalogue, media and requests",
      children: [
        { label: "My courses", to: "/courses", icon: "graduation" },
        { label: "Media library", to: "/media-library", icon: "fileText" },
        { label: "Request a course", to: "/course-requests", icon: "mail" },
      ],
    }),
    item({
      menu: "tests",
      label: "Tests & grading",
      icon: "clipboardCheck",
      to: "/tests",
      group: "exams",
      hint: "Authoring, attempts and grading",
      children: [
        { label: "Tests", to: "/tests", icon: "fileText" },
        { label: "Question bank", to: "/questions", icon: "archive" },
        { label: "Attempts", to: "/attempts", icon: "users" },
        { label: "Grading queue", to: "/grading/queue", icon: "check" },
        { label: "Results", to: "/results", icon: "chart" },
      ],
    }),
    item({
      menu: "problems",
      label: "Coding practice",
      icon: "terminal",
      to: "/problems",
      group: "curriculum",
      hint: "Problem bank and review",
    }),
  ];
}

function institutionHeadNav(): NavItem[] {
  return [
    home,
    item({
      section: "users",
      label: "People",
      icon: "users",
      to: "/staff",
      group: "users",
      hint: "Staff and students in your institution",
      children: [
        { label: "Staff", to: "/staff", icon: "briefcase" },
        { label: "Students", to: "/students", icon: "graduation" },
      ],
    }),
    item({
      section: "academics",
      label: "Academics",
      icon: "layers",
      to: "/academics",
      group: "academics",
      hint: "Structure, batches and course requests",
      children: [
        { label: "Org structure", to: "/academics", icon: "layers" },
        { label: "Batches", to: "/batches", icon: "users" },
        { label: "Courses", to: "/courses", icon: "fileText" },
        { label: "Course requests", to: "/course-requests", icon: "mail" },
      ],
    }),
    item({
      menu: "analytics",
      label: "Results & analytics",
      icon: "chart",
      to: "/academics/outcomes",
      group: "exams",
      hint: "Outcomes, progress and exports",
      children: [
        { label: "Outcomes", to: "/academics/outcomes", icon: "chart" },
        { label: "Progress", to: "/academics/student-progress", icon: "activity" },
        { label: "Reports", to: "/analytics", icon: "fileText" },
        { label: "Exports", to: "/downloads", icon: "download" },
      ],
    }),
    item({
      menu: "jobs",
      label: "Placements",
      icon: "briefcase",
      to: "/jobs/institution/placements",
      group: "careers",
      hint: "Campus hiring and placement drives",
      children: placementsHeadChildren,
    }),
    item({
      menu: "certificates",
      label: "Certificates",
      icon: "award",
      to: "/certificates",
      group: "exams",
      hint: "Issued certificates",
    }),
  ];
}

function scopedAdminNav(): NavItem[] {
  return [
    home,
    item({
      section: "users",
      label: "Accounts",
      icon: "users",
      to: "/staff",
      group: "users",
      hint: "People and employers in your scope",
      children: [
        { label: "Staff", to: "/staff", icon: "briefcase" },
        { label: "Students", to: "/students", icon: "graduation" },
        { label: "Employers", to: "/employers", icon: "building" },
      ],
    }),
    item({
      menu: "batches",
      label: "Academics",
      icon: "layers",
      to: "/batches",
      group: "academics",
      hint: "Batches and course requests",
      children: [
        { label: "Batches", to: "/batches", icon: "layers" },
        { label: "Course requests", to: "/course-requests", icon: "mail" },
      ],
    }),
    item({
      menu: "analytics",
      label: "Analytics",
      icon: "chart",
      to: "/analytics",
      group: "admin",
      hint: "Dashboards in your scope",
    }),
  ];
}

function platformAdminJcmsNav(): NavItem[] {
  return [
    item({
      menu: "jobs",
      label: "Dashboard",
      icon: "dashboard",
      to: "/jobs/admin/dashboard",
      group: "home",
      hint: "Jobs KPIs and queue health",
    }),
    item({
      menu: "jobs",
      label: "Job postings",
      icon: "briefcase",
      to: "/jobs/admin/postings",
      group: "careers",
      hint: "Browse live campus postings",
      children: [
        { label: "Browse", to: "/jobs/admin/postings", icon: "search" },
        { label: "Create job", to: "/jobs/admin/jobs/new", icon: "plus" },
      ],
    }),
    item({
      menu: "jobs",
      label: "Review inbox",
      icon: "mail",
      to: "/jobs/admin/review",
      group: "careers",
      hint: "Jobs and employer verification",
    }),
    item({
      menu: "jobs",
      label: "Activity log",
      icon: "activity",
      to: "/jobs/admin/audit",
      group: "careers",
      hint: "Moderation audit trail",
    }),
  ];
}

function superAdminNav(): NavItem[] {
  return [
    item({
      section: "dashboard",
      label: "Dashboard",
      icon: "dashboard",
      to: "/",
      group: "home",
      hint: "Platform overview",
      children: [
        { label: "Overview", to: "/", icon: "dashboard" },
        { label: "Analytics", to: "/analytics", icon: "chart" },
      ],
    }),
    item({
      section: "institutions",
      label: "People & organisations",
      icon: "building",
      to: "/institutions",
      group: "users",
      hint: "Users, institutions and employers",
      children: [
        { label: "Users", to: "/users", icon: "users" },
        { label: "Institutions", to: "/institutions", icon: "building" },
        { label: "Hierarchy", to: "/organisation", icon: "layers" },
        { label: "Employers", to: "/employers", icon: "briefcase" },
      ],
    }),
    item({
      menu: "courses",
      label: "Learning",
      icon: "graduation",
      to: "/courses",
      group: "learn",
      hint: "Courses, paths and batches",
      children: [
        { label: "Courses", to: "/courses", icon: "fileText" },
        { label: "Batches", to: "/batches", icon: "users" },
        { label: "Coding problems", to: "/problems", icon: "terminal" },
      ],
    }),
    item({
      menu: "tests",
      label: "Assessments",
      icon: "clipboardCheck",
      to: "/tests",
      group: "exams",
      hint: "Tests through certificates",
      children: [
        { label: "Tests", to: "/tests", icon: "fileText" },
        { label: "Question bank", to: "/questions", icon: "archive" },
        { label: "Grading queue", to: "/grading/queue", icon: "check" },
        { label: "Results", to: "/results", icon: "chart" },
        { label: "Certificates", to: "/certificates", icon: "award" },
      ],
    }),
    item({
      menu: "jobs",
      label: "Jobs moderation",
      icon: "briefcase",
      to: "/jobs/admin/dashboard",
      group: "careers",
      hint: "Postings, review and employers",
      children: jobsModeratorChildren,
    }),
    item({
      menu: "billing",
      label: "Billing & plans",
      icon: "fileText",
      to: "/course-requests",
      group: "admin",
      hint: "Requests, seats and invoices",
      children: [
        { label: "Course requests", to: "/course-requests", icon: "mail" },
        { label: "Seats", to: "/subscriptions", icon: "layers" },
        { label: "Quotes & invoices", to: "/billing", icon: "fileText" },
        { label: "Payments", to: "/billing", icon: "fileText" },
      ],
    }),
    item({
      section: "permissions",
      label: "System",
      icon: "key",
      to: "/permissions",
      group: "admin",
      hint: "RBAC, audit and settings",
      children: [
        { label: "Roles & permissions", to: "/permissions", icon: "key" },
        { label: "Audit logs", to: "/audit-logs", icon: "search" },
        { label: "Data exports", to: "/downloads", icon: "download" },
        { label: "Settings", to: "/ai", icon: "bot" },
      ],
    }),
  ];
}

function employerNav(): NavItem[] {
  return [
    home,
    item({
      menu: "jobs",
      label: "Jobs",
      icon: "briefcase",
      to: "/jobs/employer/jobs",
      group: "careers",
      hint: "Your open roles",
      children: jobsEmployerChildren,
    }),
    item({
      menu: "jobs",
      label: "Pipeline",
      icon: "layers",
      to: "/jobs/employer/pipeline",
      group: "careers",
      hint: "Pick a role, then manage its pipeline",
    }),
    item({
      menu: "jobs",
      label: "Interviews",
      icon: "calendar",
      to: "/jobs/employer/interviews",
      group: "careers",
      hint: "Schedules and feedback",
    }),
    item({
      menu: "jobs",
      label: "Company profile",
      icon: "building",
      to: "/jobs/employer/profile",
      group: "careers",
      hint: "Employer organisation profile",
    }),
  ];
}

/** Sidebar source per LMS role — filtered by permissions in `useNavItems`. */
export function sidebarItemsForRole(role: Role | undefined, options?: SidebarOptions): NavItem[] | null {
  if (!role) return null;

  if (role === "admin" && options?.jobsModerator) {
    return platformAdminJcmsNav();
  }

  switch (role) {
    case "student":
      return studentNav();
    case "staff":
      return staffNav();
    case "institution_head":
      return institutionHeadNav();
    case "admin":
      return scopedAdminNav();
    case "super_admin":
      return superAdminNav();
    case "employer_admin":
      return employerNav();
    case "recruiter":
      return employerNav();
    default:
      return null;
  }
}