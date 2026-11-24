import { useMemo } from "react";
import { BookOpen, Clock3, Layers, Star, ShoppingBag, ShieldCheck } from "lucide-react";

import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { PAYMENTS_ENABLED } from "@/core/config/features";
import type { BrowseCourse } from "@/modules/store/types/courseBrowse";
import type { StoreOffer } from "@/modules/store/types";
import {
  courseLessonsLabel,
  courseModulesLabel,
  describeCourseAccess,
  inferLevel,
  resolveLearnerKind,
} from "@/modules/store/utils/courseBrowseAccess";
import { courseThumbnailSrc } from "@/modules/catalog/common/courseThumbnail";
import { inferCategory } from "@/modules/store/utils/courseCategory";

const CATEGORY_THEMES: Record<string, { color: string; icon: string }> = {
  "Development": { color: "blue", icon: "💻" },
  "AI & Machine Learning": { color: "purple", icon: "🤖" },
  "Data Science": { color: "pink", icon: "📊" },
  "Design": { color: "navy", icon: "🎨" },
  "Business": { color: "green", icon: "💼" },
  "Marketing": { color: "orange", icon: "🚀" },
};

type Props = {
  course: BrowseCourse;
  index: number;
  isInstitutionStudent: boolean;
  offer?: StoreOffer;
  isEnrolling?: boolean;
  onOpen: (courseId: string) => void;
  onPrimaryAction: (course: BrowseCourse) => void;
};

export function CourseBrowseCard({
  course,
  index,
  isInstitutionStudent,
  offer,
  isEnrolling = false,
  onOpen,
  onPrimaryAction,
}: Props) {
  const { user } = useAuth();
  const category = inferCategory(course.title, course.summary);
  const theme = CATEGORY_THEMES[category] ?? { color: "blue", icon: "📚" };
  const instructor = course.instructor_name || "ExamLMS Faculty";
  const level = inferLevel(course.summary || "", course.title) ?? "All levels";
  const access = describeCourseAccess(
    course,
    resolveLearnerKind(isInstitutionStudent),
    offer,
    PAYMENTS_ENABLED,
  );

  const isEnrolled = course.access_status === "enrolled";

  // Check progress percentage if enrolled to determine "Start Learning" (0%) vs "Continue Learning" (>0%)
  const progressPct = useMemo(() => {
    if (!isEnrolled) return 0;
    try {
      const studentId = user?.user_id || "guest";
      const savedStr = localStorage.getItem(`examlms_video_progress_${studentId}_${course.course_id}`);
      if (savedStr) {
        const savedData = JSON.parse(savedStr);
        const keys = Object.keys(savedData);
        if (keys.length > 0) {
          const totalTopicPct = keys.reduce((acc, k) => acc + (savedData[k]?.percent || 0), 0);
          return Math.round(totalTopicPct / keys.length);
        }
      }
    } catch {
      // fallback
    }
    return 0;
  }, [isEnrolled, user?.user_id, course.course_id]);

  // Real ratings/learner count only if present in data
  const rating = (course as any).rating != null ? Number((course as any).rating) : null;
  const learners = (course as any).learners_count != null ? Number((course as any).learners_count) : null;

  const skills = course.skills || [];

  // Determine button text: first 'Enroll Now', then 'Start Learning' (or 'Continue Learning')
  const primaryButtonText = isEnrolling
    ? "Enrolling..."
    : !isEnrolled
      ? "Enroll Now"
      : progressPct > 0
        ? "Continue Learning"
        : "Start Learning";

  return (
    <article className="course-card flex flex-col justify-between">
      <div>
        {/* Course Thumbnail */}
        <button
          type="button"
          className="course-image-wrap"
          onClick={() => onOpen(course.course_id)}
          aria-label={`View details for ${course.title}`}
        >
          <div className={`course-image ${theme.color}`}>
            {course.thumbnail_media_id ? (
              <img
                src={courseThumbnailSrc(course.thumbnail_media_id) ?? undefined}
                alt={course.title}
                className="course-thumbnail-img"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ) : null}
            <span className="course-icon-symbol">{theme.icon}</span>

            {/* Badges */}
            {isEnrolled ? (
              course.access_type === "purchased" ? (
                <span className="course-tag flex items-center gap-1 !bg-emerald-600 !text-white !font-bold">
                  <ShoppingBag size={10} />
                  PURCHASED
                </span>
              ) : (
                <span className="course-tag flex items-center gap-1 !bg-indigo-600 !text-white !font-bold">
                  <ShieldCheck size={10} />
                  INSTITUTION
                </span>
              )
            ) : index === 0 ? (
              <span className="course-tag">FEATURED</span>
            ) : null}
          </div>
        </button>

        {/* Card Body */}
        <div className="course-card-body pb-2">
          <div className="course-meta-top flex items-center justify-between mb-1.5">
            <span className="course-category">{category}</span>
            <span className="course-level-badge text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {level}
            </span>
          </div>

          <button
            type="button"
            className="course-title"
            onClick={() => onOpen(course.course_id)}
            title={course.title}
          >
            {course.title}
          </button>

          <p className="instructor">By {instructor}</p>

          {/* Rating */}
          {rating !== null && (
            <div className="rating-line mb-2">
              <b>
                <Star size={13} fill="#F5A623" stroke="#F5A623" /> {rating.toFixed(1)}
              </b>
              {learners !== null && <span>({learners.toLocaleString()} learners)</span>}
            </div>
          )}

          {/* Short description */}
          {course.summary ? (
            <p className="course-summary-text text-xs text-slate-600 line-clamp-2 mb-2 leading-relaxed">
              {course.summary}
            </p>
          ) : null}

          {/* Skills Covered */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1 my-2">
              {skills.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}

          {/* Course Facts: Duration, Modules, Lessons */}
          <div className="course-facts">
            <span>
              <Clock3 size={13} />
              {course.duration_label || "Self-paced"}
            </span>
            <span>
              <Layers size={13} />
              {courseModulesLabel(course)}
            </span>
            <span>
              <BookOpen size={13} />
              {courseLessonsLabel(course)}
            </span>
          </div>
        </div>
      </div>

      {/* Card Footer: Pricing & Action Buttons */}
      <div className="course-card-body pt-0">
        <div className="course-card-footer flex-col sm:flex-row gap-2 !border-t !border-slate-100 !pt-3">
          <div className="course-pricing">
            {isEnrolled ? (
              <div className="flex flex-col">
                <b className="text-sm font-bold text-emerald-600">
                  {course.access_type === "purchased" ? "Purchased" : "Enrolled"}
                </b>
                <small className="text-[10px] text-slate-400">
                  {progressPct > 0 ? `${progressPct}% in progress` : "Ready to learn"}
                </small>
              </div>
            ) : (
              <div className="flex flex-col">
                <b className="text-base font-extrabold text-[#111827]">
                  ₹{access.priceInr.toLocaleString("en-IN")}
                </b>
                <small className="text-[10px] text-slate-400">Instant Enrollment • Cert</small>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              className="btn btn-small btn-outline flex-1 sm:flex-initial text-xs font-semibold"
              onClick={() => onOpen(course.course_id)}
            >
              View Details
            </button>
            <button
              type="button"
              disabled={isEnrolling}
              className="btn btn-small btn-primary flex-1 sm:flex-initial !bg-[#635BFF] hover:!bg-[#5046E5] !text-white !font-bold transition-all disabled:opacity-50"
              onClick={() => onPrimaryAction(course)}
            >
              {primaryButtonText}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
