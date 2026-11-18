import { BookOpen, Clock3 } from "lucide-react";

import { PAYMENTS_ENABLED } from "@/core/config/features";
import type { BrowseCourse } from "@/modules/store/types/courseBrowse";
import type { StoreOffer } from "@/modules/store/types";
import {
  courseLessonsLabel,
  describeCourseAccess,
  resolveLearnerKind,
} from "@/modules/store/utils/courseBrowseAccess";
import { inferCategory } from "@/modules/store/utils/courseCategory";

const BANNER_STYLES = [
  { color: "blue", icon: "⚛" },
  { color: "yellow", icon: "🐍" },
  { color: "pink", icon: "📊" },
  { color: "navy", icon: "🎨" },
  { color: "green", icon: "💼" },
  { color: "orange", icon: "🚀" },
] as const;

type Props = {
  course: BrowseCourse;
  index: number;
  isInstitutionStudent: boolean;
  offer?: StoreOffer;
  onOpen: (courseId: string) => void;
  onPrimaryAction: (course: BrowseCourse) => void;
};

export function CourseBrowseCard({ course, index, isInstitutionStudent, offer, onOpen, onPrimaryAction }: Props) {
  const banner = BANNER_STYLES[index % BANNER_STYLES.length] ?? BANNER_STYLES[0];
  const category = inferCategory(course.title, course.summary);
  const instructor = course.instructor_name || "ExamLMS Faculty";
  const access = describeCourseAccess(course, resolveLearnerKind(isInstitutionStudent), offer, PAYMENTS_ENABLED);
  const tag =
    course.access_status === "enrolled"
      ? "ENROLLED"
      : index === 0
        ? "FEATURED"
        : course.access_status === "eligible_under_plan"
          ? "PLAN"
          : null;

  return (
    <article className="course-card">
      <button type="button" className="course-image-wrap" onClick={() => onOpen(course.course_id)}>
        <div className={`course-image ${banner.color}`}>
          <span>{banner.icon}</span>
          {tag ? <b className="course-tag">{tag}</b> : null}
        </div>
      </button>
      <div className="course-card-body">
        <div className="course-category">{category}</div>
        <button type="button" className="course-title" onClick={() => onOpen(course.course_id)}>
          {course.title}
        </button>
        <p className="instructor">By {instructor}</p>
        {course.summary ? (
          <p className="muted" style={{ fontSize: 11, margin: "0 0 10px", lineHeight: 1.5 }}>
            {course.summary.length > 110 ? `${course.summary.slice(0, 107)}…` : course.summary}
          </p>
        ) : null}
        <div className="course-facts" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
          <span>
            <Clock3 size={14} />
            {course.duration_label}
          </span>
          <span>
            <BookOpen size={14} />
            {courseLessonsLabel(course)}
          </span>
        </div>
        <div className="course-card-footer">
          <div>
            {access.priceLine ? <b>{access.priceLine}</b> : null}
            {access.priceSubline ? (
              <small style={{ display: "block", fontSize: 10, color: "#9ba4b4", marginTop: 4 }}>{access.priceSubline}</small>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-small btn-outline"
            onClick={() =>
              access.primaryVariant === "continue" || access.primaryVariant === "start"
                ? onPrimaryAction(course)
                : onOpen(course.course_id)
            }
          >
            {access.primaryVariant === "continue" ? "Continue" : access.primaryVariant === "start" ? "Start" : "View course"}
          </button>
        </div>
      </div>
    </article>
  );
}