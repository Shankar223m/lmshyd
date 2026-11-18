import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";

/** Signed-in area. Sends users with pending set-up steps to those steps first. */
export function RequireAuth() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const onPasswordSetup = location.pathname === "/account/setup/password";
  const onMfaSetup = location.pathname === "/account/setup/mfa";

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (user.must_change_password && !onPasswordSetup) {
    return <Navigate to="/account/setup/password" replace />;
  }
  // Roles in MFA_REQUIRED_ROLES cannot call most APIs until enrolled — do not leave them on empty screens.
  if (user.mfa_setup_required && !onMfaSetup && !onPasswordSetup) {
    return <Navigate to="/account/setup/mfa" replace />;
  }
  return <Outlet />;
}
