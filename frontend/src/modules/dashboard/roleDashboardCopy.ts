import type { Role } from "@/modules/user-management/common/types";
import type { IconName } from "@/shared/ui";

export type QuickAction = { label: string; to: string; icon: IconName; hint: string };

const STUDENT_LEARNING_ACTIONS: QuickAction[] = [
  { label: "Continue learning", to: "/courses/my", icon: "graduation", hint: "Pick up your enrolled courses" },
  { label: "My tests", to: "/my-tests", icon: "fileText", hint: "Open or scheduled assessments" },
  { label: "AI tutor", to: "/tutor", icon: "helpCircle", hint: "Ask questions about your lessons" },
  { label: "Certificates", to: "/certificates", icon: "award", hint: "Download earned credentials" },
];

const STUDENT_CAREERS_ACTIONS: QuickAction[] = [
  { label: "Careers dashboard", to: "/jobs/student/dashboard", icon: "dashboard", hint: "Applications, interviews, offers" },
  { label: "Find jobs", to: "/jobs/student/jobs", icon: "search", hint: "Browse open roles" },
  { label: "Career profile", to: "/jobs/student/profile", icon: "user", hint: "Profile employers see" },
  { label: "Placement", to: "/jobs/student/placement", icon: "graduation", hint: "Campus placement status" },
];

const STAFF_ACTIONS: QuickAction[] = [
  { label: "Grading queue", to: "/grading/queue", icon: "check", hint: "Answers waiting for marks" },
  { label: "Academic outcomes", to: "/academics/outcomes", icon: "chart", hint: "Marks, progress and attempts" },
  { label: "Courses", to: "/courses", icon: "fileText", hint: "Catalog and learning content" },
  { label: "Support", to: "/support", icon: "mail", hint: "Help requests from students" },
];

const HEAD_ACTIONS: QuickAction[] = [
  { label: "Batches", to: "/batches", icon: "layers", hint: "Enrolments and groups" },
  { label: "Course requests", to: "/course-requests", icon: "upload", hint: "Request new catalog courses" },
  { label: "Academic outcomes", to: "/academics/outcomes", icon: "chart", hint: "Cohort performance" },
  { label: "Placements", to: "/jobs/institution/placements", icon: "building", hint: "Campus hiring status" },
];

const EMPLOYER_ACTIONS: QuickAction[] = [
  { label: "Open roles", to: "/jobs/employer/jobs", icon: "briefcase", hint: "Manage job posts" },
  { label: "Hiring pipeline", to: "/jobs/employer/pipeline", icon: "layers", hint: "Candidates in progress" },
  { label: "Interviews", to: "/jobs/employer/interviews", icon: "calendar", hint: "Schedule and outcomes" },
  { label: "Company profile", to: "/jobs/employer/profile", icon: "building", hint: "How candidates see you" },
];

const RECRUITER_ACTIONS: QuickAction[] = [
  { label: "Screening", to: "/jobs/recruiter/screening", icon: "users", hint: "Review applicants" },
  { label: "Interviews", to: "/jobs/recruiter/interviews", icon: "calendar", hint: "Upcoming conversations" },
  { label: "Support", to: "/support", icon: "mail", hint: "Get help from the platform team" },
];

const ADMIN_ACTIONS: QuickAction[] = [
  { label: "Institutions", to: "/institutions", icon: "building", hint: "Colleges you operate" },
  { label: "Batches", to: "/batches", icon: "layers", hint: "Cross-institution enrolments" },
  { label: "Support queue", to: "/support/queue", icon: "mail", hint: "Tickets needing a response" },
  { label: "Analytics", to: "/analytics", icon: "chart", hint: "Platform trends" },
];

const SUPER_ADMIN_ACTIONS: QuickAction[] = [
  { label: "Roles & permissions", to: "/permissions", icon: "key", hint: "Who can do what" },
  { label: "Organisation tree", to: "/organisation", icon: "layers", hint: "Hierarchy across tenants" },
  { label: "Review inbox", to: "/jobs/admin/review", icon: "shield", hint: "Approve employer posts" },
  { label: "System audit", to: "/audit-logs", icon: "search", hint: "Changes and sign-ins" },
];

export function heroCopyForRole(role: Role | string | undefined): { progressLabel: string; tagline: string } {
  switch (role) {
    case "student":
      return {
        tagline: "Courses and careers are separate areas — learn here, hire through Jobs & placements.",
        progressLabel: "Academic progress below · careers in the Jobs section",
      };
    case "staff":
      return {
        tagline: "Teach, grade, and support learners without admin clutter.",
        progressLabel: "Start with grading or academic outcomes",
      };
    case "institution_head":
      return {
        tagline: "Run academics, subscriptions, and placements for your institution.",
        progressLabel: "Batches, requests and outcomes at a glance",
      };
    case "employer_admin":
    case "recruiter":
      return {
        tagline: "Hire campus talent with pipelines tied to learning credentials.",
        progressLabel: "Your hiring workspace",
      };
    case "admin":
      return {
        tagline: "Operate institutions, content and support within your scopes.",
        progressLabel: "Your scoped platform responsibilities",
      };
    case "super_admin":
      return {
        tagline: "One control plane for learning, assessment, and careers.",
        progressLabel: "Platform health and governance",
      };
    default:
      return { tagline: "", progressLabel: "Welcome back" };
  }
}

/** Short placeholder for the header jump bar — nudges people toward what matters for their role. */
export function jumpSearchHintForRole(role: Role | string | undefined): string {
  switch (role) {
    case "student":
      return "Try: my courses, tests, jobs";
    case "staff":
      return "Try: grading, outcomes, courses";
    case "institution_head":
      return "Try: batches, placements, outcomes";
    case "employer_admin":
      return "Try: jobs, pipeline, interviews";
    case "recruiter":
      return "Try: screening, interviews";
    case "admin":
      return "Try: institutions, support, batches";
    case "super_admin":
      return "Try: permissions, audit, moderation";
    default:
      return "Jump to any page in your menu";
  }
}

export function quickActionGroupsForRole(
  role: Role | string | undefined,
): { title: string; actions: QuickAction[] }[] {
  if (role === "student") {
    return [
      { title: "Courses", actions: STUDENT_LEARNING_ACTIONS },
      { title: "Jobs & placements", actions: STUDENT_CAREERS_ACTIONS },
    ];
  }
  return [{ title: "Start here", actions: quickActionsForRole(role) }];
}

export function quickActionsForRole(role: Role | string | undefined): QuickAction[] {
  switch (role) {
    case "student":
      return [...STUDENT_LEARNING_ACTIONS, ...STUDENT_CAREERS_ACTIONS];
    case "staff":
      return STAFF_ACTIONS;
    case "institution_head":
      return HEAD_ACTIONS;
    case "employer_admin":
      return EMPLOYER_ACTIONS;
    case "recruiter":
      return RECRUITER_ACTIONS;
    case "admin":
      return ADMIN_ACTIONS;
    case "super_admin":
      return SUPER_ADMIN_ACTIONS;
    default:
      return [];
  }
}
