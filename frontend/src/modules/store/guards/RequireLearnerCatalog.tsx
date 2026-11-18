import { Navigate, Outlet } from "react-router-dom";

import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";
import { PageLoader } from "@/shared/ui";

/** Institution students (catalog) and self-registered learners (store) may open the course catalog. */
export function RequireLearnerCatalog() {
  const { isLoading, can, permissions } = usePermissions();
  if (isLoading) return <PageLoader />;
  const storeBuyer = permissions.permissions?.includes("store.buy");
  if (can("catalog") || can("store") || storeBuyer) {
    return <Outlet />;
  }
  return <Navigate to="/" replace />;
}