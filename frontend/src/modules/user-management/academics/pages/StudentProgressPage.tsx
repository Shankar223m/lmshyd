import { PageHeader } from "@/shared/ui";
import { StudentProgressDashboard } from "@/modules/proctoring/monitor/components/StudentProgressDashboard";

/** Course completion and test activity (no camera / proctoring). */
export function StudentProgressPage() {
  return (
    <>
      <PageHeader
        title="Student progress"
        description="Enrollment progress, materials, and test scores for your students. Platform admins see all institutions; institution staff see their own org."
      />
      <StudentProgressDashboard />
    </>
  );
}
