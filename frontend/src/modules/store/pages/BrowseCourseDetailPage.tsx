import { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, PlayCircle } from "lucide-react";

import { PAYMENTS_ENABLED } from "@/core/config/features";
import { useBrowsePublishedCoursesQuery } from "@/modules/store/api/studentSubscriptionsApi";
import { useGetStoreOffersQuery } from "@/modules/store/api/storeApi";
import { useCourseBrowseActions } from "@/modules/store/hooks/useCourseBrowseActions";
import type { BrowseCourse } from "@/modules/store/types/courseBrowse";
import type { StoreOffer } from "@/modules/store/types";
import {
  courseLessonsLabel,
  courseModulesLabel,
  describeCourseAccess,
  inferLevel,
  resolveLearnerKind,
} from "@/modules/store/utils/courseBrowseAccess";
import { inferCategory } from "@/modules/store/utils/courseCategory";
import { useStudentType } from "@/modules/user-management/auth/hooks/useStudentType";
import { Alert } from "@/shared/ui";

const BANNER_COLORS = ["blue", "yellow", "pink", "navy", "green", "orange"] as const;

type LocationState = { course?: BrowseCourse };

export function BrowseCourseDetailPage() {
  const { courseId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null)?.course;
  const { isInstitutionStudent, institutionName } = useStudentType();

  const { data, isLoading } = useBrowsePublishedCoursesQuery({ page: 1, per_page: 100 });
  const { data: storeData } = useGetStoreOffersQuery();

  const course = useMemo(() => {
    if (state?.course_id === courseId) return state;
    return data?.courses.find((c) => String(c.course_id) === String(courseId));
  }, [state, data?.courses, courseId]);

  const offersMap = useMemo(() => {
    const map = new Map<string, StoreOffer>();
    (storeData?.offers ?? []).forEach((o) => map.set(String(o.course_id), o));
    return map;
  }, [storeData]);

  const { handlePrimary, buy, buyBusy } = useCourseBrowseActions(offersMap);
  const offer = offersMap.get(courseId);
  const access = course
    ? describeCourseAccess(course, resolveLearnerKind(isInstitutionStudent), offer, PAYMENTS_ENABLED)
    : null;

  const color = BANNER_COLORS[Math.abs(courseId.charCodeAt(0) || 0) % BANNER_COLORS.length];

  if (isLoading && !course) {
    return (
      <div className="lms-ui-kit-catalog mx-auto w-full max-w-[1500px] pb-16">
        <div className="loading-state">
          <div className="spinner" />
          Loading course…
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="lms-ui-kit-catalog mx-auto w-full max-w-[1500px] pb-16">
        <button type="button" className="back-link" onClick={() => navigate("/browse-courses")}>
          <ArrowLeft size={16} /> Back to courses
        </button>
        <div className="empty-state">
          <BookOpen size={32} />
          <h3>Course not found</h3>
          <p>It may have been removed or is not available for your account.</p>
          <Link to="/browse-courses" className="text-link" style={{ display: "inline-block", marginTop: 12 }}>
            Browse catalog
          </Link>
        </div>
      </div>
    );
  }

  const category = inferCategory(course.title, course.summary);
  const level = inferLevel(course.summary, course.title) ?? "All levels";
  const busy = buyBusy === course.course_id;

  return (
    <div className="lms-ui-kit-catalog mx-auto w-full max-w-[1500px] pb-16">
      <button type="button" className="back-link" onClick={() => navigate("/browse-courses")}>
        <ArrowLeft size={16} /> Back to courses
      </button>

      {isInstitutionStudent && (
        <p className="soft-tag" style={{ marginBottom: 16 }}>
          Learning under <strong>{institutionName || "your institution"}</strong> — licensed courses are free when assigned
          to you.
        </p>
      )}

      <div className="course-detail-layout">
        <div>
          <div className={`detail-cover ${color}`}>
            <span className="detail-symbol">📚</span>
            <span className="cover-label">{access?.badge?.toUpperCase() || "PUBLISHED COURSE"}</span>
          </div>
          <div className="detail-main">
            <div className="eyebrow">
              {category.toUpperCase()} · {level.toUpperCase()}
            </div>
            <h1>{course.title}</h1>
            <p className="muted detail-desc">{course.summary || "Expert-led curriculum with hands-on assessments."}</p>
            <div className="detail-meta">
              <span>
                <BookOpen size={15} /> {course.instructor_name || "ExamLMS Faculty"}
              </span>
              <span>
                <Clock3 size={15} /> {course.duration_label}
              </span>
              <span>
                <PlayCircle size={15} /> {courseLessonsLabel(course)}
                {courseModulesLabel(course) ? ` · ${courseModulesLabel(course)}` : ""}
              </span>
            </div>

            <h3>What you&apos;ll learn</h3>
            <div className="learn-grid">
              {(course.summary ? course.summary.split(/[.!?]/).filter((s) => s.trim().length > 12) : [])
                .slice(0, 4)
                .map((line) => (
                  <span key={line}>
                    <CheckCircle2 size={16} />
                    {line.trim()}
                  </span>
                ))}
              {(course.summary?.length ?? 0) < 20 &&
                [
                  "Build job-ready skills step by step",
                  "Practice with graded chapter and module tests",
                  "Earn a verifiable certificate on completion",
                  "Learn with structured, sequenced content",
                ].map((line) => (
                  <span key={line}>
                    <CheckCircle2 size={16} />
                    {line}
                  </span>
                ))}
            </div>

            {access?.hint ? (
              <Alert tone="info" className="mt-4">
                {access.hint}
              </Alert>
            ) : null}
          </div>
        </div>

        <aside className="enroll-card">
          <div className={`enroll-thumb ${color}`}>📚</div>
          <div className="price-line">
            <strong>{access?.priceLine ?? "See pricing"}</strong>
          </div>
          {access?.priceSubline ? <p className="muted">{access.priceSubline}</p> : null}

          <button
            type="button"
            className="btn btn-primary full"
            disabled={!access?.canPrimary || busy}
            onClick={() => void handlePrimary(course)}
          >
            {busy ? "Please wait…" : access?.primaryLabel ?? "View options"}
          </button>

          {access?.primaryVariant === "buy" && offer && PAYMENTS_ENABLED && course.payments_enabled ? (
            <button
              type="button"
              className="btn btn-outline full"
              disabled={busy}
              onClick={() => void buy(offer)}
            >
              Proceed to checkout
            </button>
          ) : null}

          <div className="includes">
            <b>This course includes</b>
            <span>
              <PlayCircle /> {course.duration_label} of structured content
            </span>
            <span>
              <BookOpen /> {courseLessonsLabel(course)}
            </span>
            <span>
              <CheckCircle2 /> Certificate of completion
            </span>
          </div>

          {isInstitutionStudent ? (
            <small className="muted">Courses here are licensed for your university. Access is included — no per-course payment.</small>
          ) : (
            <small className="muted">After purchase, enrollment is created automatically and the course opens under My courses.</small>
          )}
        </aside>
      </div>
    </div>
  );
}