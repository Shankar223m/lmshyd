import { Navigate } from "react-router-dom";

import { useCan } from "@/modules/user-management/common/permissions/useCan";

/** Students land on their AI Resume Builder dashboard; staff and careers managers look students up (read only). */
export function CareerHomePage() {
  const { holds } = useCan();
  return <Navigate to={holds("career.profile") ? "/career/resumes" : "/career/students"} replace />;
}
