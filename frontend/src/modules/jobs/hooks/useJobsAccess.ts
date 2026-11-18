import { useMemo } from "react";

import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";
import type { Role } from "@/modules/user-management/common/types";

/** LMS-native jobs capabilities (no JCMS persona strings in the UI). */
export function useJobsAccess() {
  const { user } = useAuth();
  const { permissions, canOpen } = usePermissions();
  const role = user?.role as Role | undefined;

  return useMemo(() => {
    const scopes = new Set(permissions.scopes ?? []);
    const isModerator =
      role === "super_admin" || (role === "admin" && scopes.has("careers.manage"));
    const canDiscover = role === "student" && canOpen("jobs");
    return {
      role,
      isStudent: role === "student",
      isEmployer: role === "employer_admin",
      isRecruiter: role === "recruiter",
      isInstitution: role === "institution_head" || role === "staff",
      isModerator,
      canDiscover,
      canOpenJobsMenu: canOpen("jobs"),
    };
  }, [role, permissions.scopes, canOpen]);
}

export function jobsHomePath(role: Role | undefined, isModerator: boolean): string {
  switch (role) {
    case "student":
      return "/jobs/student/dashboard";
    case "employer_admin":
      return "/jobs/employer/jobs";
    case "recruiter":
      return "/jobs/recruiter/screening";
    case "institution_head":
    case "staff":
      return "/jobs/institution/placements";
    case "super_admin":
    case "admin":
      return isModerator ? "/jobs/admin/dashboard" : "/";
    default:
      return "/jobs/student/jobs";
  }
}