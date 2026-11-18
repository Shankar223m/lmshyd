import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { TabbedPage, type WorkflowTab } from "@/shared/layout/TabbedPage";
import { apiFetch, type ApiResponse } from "@/modules/jobs/services/api";

/** In-page tabs for platform jobs moderation (not a second app shell). */
export function AdminSectionTabs({ actions }: { actions?: ReactNode }) {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch<ApiResponse<Record<string, number>>>("/admin/stats"),
    staleTime: 30_000,
  });
  const pending = (data?.data?.pending_jobs ?? 0) + (data?.data?.pending_organizations ?? 0);

  const tabs: WorkflowTab[] = [
    { label: "Overview", to: "/jobs/admin/dashboard", icon: "dashboard" },
    { label: "Postings", to: "/jobs/admin/postings", icon: "briefcase" },
    { label: "Review inbox", to: "/jobs/admin/review", icon: "fileText", badge: pending },
    { label: "Create job", to: "/jobs/admin/jobs/new", icon: "plus" },
    { label: "Activity log", to: "/jobs/admin/audit", icon: "search" },
  ];

  return <TabbedPage tabs={tabs} actions={actions} />;
}