import type { NavItem } from "@/app/navigation";

/** LMS Jobs & placements (sidebar children are added per role in useNavItems). */
export const jobsNavigation: NavItem[] = [
  {
    menu: "jobs",
    label: "Jobs & placements",
    icon: "briefcase",
    to: "/jobs",
    group: "home",
    hint: "Search and apply, hiring pipelines, campus placements, and moderation",
  },
];

/** @deprecated Use jobsNavigation */
export const jcmsPortalNavigation = jobsNavigation;
