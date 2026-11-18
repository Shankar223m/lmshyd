import type { Role } from "@/modules/user-management/common/types";

/** First screen after sign-in when no deep-link `from` was requested. */
export function homePathForRole(role: Role | string): string {
  switch (role) {
    case "student":
      return "/";
    case "employer_admin":
    case "recruiter":
      return "/";
    case "institution_head":
    case "staff":
      return "/";
    case "admin":
    case "super_admin":
      return "/";
    default:
      return "/";
  }
}
