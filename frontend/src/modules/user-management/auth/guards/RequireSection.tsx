import { Navigate, Outlet } from "react-router-dom";

import type { Section } from "@/modules/user-management/common/permissions/types";
import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { PageLoader } from "@/shared/ui";

/**
 * Shows a screen only if the server lists its section for this person. It is a navigation aid:
 * the API authorises every request regardless.
 */
export function RequireSection({ section }: { section: Section }) {
  const { isLoading, can, permissions } = usePermissions();
  const { user } = useAuth();
  if (isLoading) return <PageLoader />;
  const isStudent = user?.role === "student" || permissions.role === "student";
  const isAllowed = can(section) || (isStudent && section === "learning");
  return isAllowed ? <Outlet /> : <Navigate to="/" replace />;
}
