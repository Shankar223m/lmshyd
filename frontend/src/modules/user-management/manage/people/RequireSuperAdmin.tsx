import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";

/** Super admin users are looked after by super admins only (the server refuses anyone else; this just keeps the page closed). */
export function RequireSuperAdmin() {
  const { user } = useAuth();
  return user?.role === "super_admin" ? <Outlet /> : <Navigate to="/" replace />;
}
