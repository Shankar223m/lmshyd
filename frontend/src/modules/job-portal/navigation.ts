import type { NavItem } from "@/app/navigation";

export const jobPortalNavigation: NavItem[] = [
  {
    menu: "jobs",
    label: "Jobs",
    icon: "briefcase",
    to: "/jobs",
    group: "careers",
    hint: "Job openings and career applications",
    children: [
      { label: "Find Jobs", to: "/jobs/board" },
      { label: "My Applications", to: "/jobs/applications" },
      { label: "My Interviews", to: "/jobs/interviews" },
      { label: "Job Offers", to: "/jobs/offers" },
      { label: "Placement Evidence", to: "/jobs/placement" },
      { label: "Hiring Pipeline", to: "/jobs/pipeline" },
      { label: "Candidate Review", to: "/jobs/candidates" },
    ],
  },
];
