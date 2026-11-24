import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { PAYMENTS_ENABLED } from "@/core/config/features";
import { useBuyCourse } from "@/modules/store/hooks/useBuyCourse";
import type { BrowseCourse } from "@/modules/store/types/courseBrowse";
import type { StoreOffer } from "@/modules/store/types";
import { describeCourseAccess, resolveLearnerKind } from "@/modules/store/utils/courseBrowseAccess";
import { useStudentType } from "@/modules/user-management/auth/hooks/useStudentType";

export function useCourseBrowseActions(offersByCourse: Map<string, StoreOffer>) {
  const navigate = useNavigate();
  const { isInstitutionStudent } = useStudentType();
  const { buy, busy: buyBusy } = useBuyCourse();

  const openDetail = useCallback(
    (courseId: string, course?: BrowseCourse) => {
      navigate(`/courses/${courseId}/details`, { state: course ? { course } : undefined });
    },
    [navigate],
  );

  const handlePrimary = useCallback(
    async (course: BrowseCourse) => {
      const offer = offersByCourse.get(course.course_id);
      const access = describeCourseAccess(
        course,
        resolveLearnerKind(isInstitutionStudent),
        offer,
        PAYMENTS_ENABLED,
      );

      if (access.primaryVariant === "continue" || access.primaryVariant === "start") {
        navigate(`/courses/${course.course_id}/learn`);
        return;
      }

      if (access.primaryVariant === "buy" && offer) {
        await buy(offer);
        return;
      }

      if (access.primaryVariant === "view") {
        openDetail(course.course_id, course);
        return;
      }

      openDetail(course.course_id, course);
    },
    [buy, isInstitutionStudent, navigate, offersByCourse, openDetail],
  );

  return {
    openDetail,
    handlePrimary,
    buyBusy,
    buy,
  };
}