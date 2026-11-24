import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";

/** All students are institution-managed; there is no self-registered learner path. */
export function useStudentType() {
  const { user } = useAuth();
  const isStudent = user?.role === "student";
  const isInstitutionStudent = isStudent && Boolean(user?.institution?.organization_id);
  return {
    isInstitutionStudent,
    isExternalStudent: false,
    institutionName: isInstitutionStudent ? user?.institution?.name ?? null : null,
  };
}