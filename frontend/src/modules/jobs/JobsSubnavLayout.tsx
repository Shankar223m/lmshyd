import { Outlet, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/modules/jobs/features/auth/AuthContext";
import { apiFetch, type ApiResponse } from "@/modules/jobs/services/api";
import { WorkflowShell, type WorkflowTab } from "@/shared/layout/WorkflowShell";
import { Button } from "@/shared/ui";

const baseRoleTabs: Record<string, WorkflowTab[]> = {
  EMPLOYER: [
    { label: "Jobs", to: "/jobs/employer/jobs", icon: "briefcase" },
    { label: "Pipeline", to: "/jobs/employer/pipeline", icon: "layers" },
    { label: "Interviews", to: "/jobs/employer/interviews", icon: "calendar" },
    { label: "Company", to: "/jobs/employer/profile", icon: "building" },
  ],
  RECRUITER: [
    { label: "Screening", to: "/jobs/recruiter/screening", icon: "users" },
    { label: "Interviews", to: "/jobs/recruiter/interviews", icon: "calendar" },
  ],
  STUDENT: [
    { label: "Dashboard", to: "/jobs/student/dashboard", icon: "dashboard" },
    { label: "Find jobs", to: "/jobs/student/jobs", icon: "search" },
    { label: "Applications", to: "/jobs/student/applications", icon: "clipboardCheck" },
    { label: "Offers & placement", to: "/jobs/student/offers", icon: "award" },
    { label: "Profile", to: "/jobs/student/profile", icon: "user" },
  ],
  INSTITUTION: [],
};

function AdminJobsNav() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch<ApiResponse<Record<string, number>>>("/admin/stats"),
    staleTime: 30_000,
  });
  const pending =
    (data?.data?.pending_jobs ?? 0) + (data?.data?.pending_organizations ?? 0);

  const tabs: WorkflowTab[] = [
    { label: "Overview", to: "/jobs/admin/dashboard", icon: "dashboard" },
    { label: "Job postings", to: "/jobs/admin/postings", icon: "briefcase" },
    { label: "Review inbox", to: "/jobs/admin/review", icon: "fileText", badge: pending },
    { label: "Create job", to: "/jobs/admin/jobs/new", icon: "plus" },
    { label: "Activity log", to: "/jobs/admin/audit", icon: "search" },
  ];

  return <WorkflowShell tabs={tabs} />;
}

export function JobsSubnavLayout() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "PLATFORM_ADMINISTRATOR") {
    return (
      <>
        <AdminJobsNav />
        <Outlet />
      </>
    );
  }

  if (user.role === "INSTITUTION") {
    return <Outlet />;
  }

  const tabs = baseRoleTabs[user.role] || [];
  const actions =
    user.role === "EMPLOYER" ? (
      <Link to="/jobs/employer/jobs/new">
        <Button size="sm" icon="plus" type="button">
          Create job
        </Button>
      </Link>
    ) : undefined;

  return (
    <>
      <WorkflowShell tabs={tabs} actions={actions} />
      <Outlet />
    </>
  );
}

/** @deprecated */
export const PortalLayout = JobsSubnavLayout;
