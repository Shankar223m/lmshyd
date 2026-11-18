import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";

/** Institution students see only university-licensed courses; self-registered learners see the full catalog. */
export function useStudentType() {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const isStudent = user?.role === "student";
  const orgTypeRaw = String(permissions.organization_type ?? user?.institution?.organization_type ?? "");
  const isIndividualLearnerOrg = orgTypeRaw === "individual";
  const hasStoreBuy = permissions.permissions?.includes("store.buy") ?? false;
  const isExternalStudent = isStudent && (isIndividualLearnerOrg || hasStoreBuy);
  const isInstitutionStudent =
    isStudent && Boolean(user?.institution?.organization_id) && !isIndividualLearnerOrg && !hasStoreBuy;
  return {
    isInstitutionStudent,
    isExternalStudent,
    institutionName: isInstitutionStudent ? user?.institution?.name ?? null : null,
  };
}