import { Navigate, Outlet } from "react-router-dom";

import { PageLoader } from "@/shared/ui";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { useJobsAccess } from "@/modules/jobs/hooks/useJobsAccess";

export function RequireJobsMenu() {
  const { sessionStatus } = useAuth();
  const { canOpenJobsMenu } = useJobsAccess();
  if (sessionStatus === "checking") return <PageLoader />;
  if (!canOpenJobsMenu) return <Navigate to="/" replace />;
  return <Outlet />;
}

type Persona = "student" | "employer" | "recruiter" | "institution" | "moderator";

export function RequireJobsPersona({ persona }: { persona: Persona }) {
  const { sessionStatus } = useAuth();
  const access = useJobsAccess();
  if (sessionStatus === "checking") return <PageLoader />;
  const ok =
    (persona === "student" && access.isStudent) ||
    (persona === "employer" && access.isEmployer) ||
    (persona === "recruiter" && access.isRecruiter) ||
    (persona === "institution" && access.isInstitution) ||
    (persona === "moderator" && access.isModerator);
  return ok ? <Outlet /> : <Navigate to="/jobs" replace />;
}