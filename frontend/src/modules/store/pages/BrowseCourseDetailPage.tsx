import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  PlayCircle,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Layers,
  UserCheck,
  Star,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import { useNotify } from "@/core/hooks/useNotify";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { PAYMENTS_ENABLED } from "@/core/config/features";
import {
  useBrowsePublishedCoursesQuery,
  useGetCourseCurriculumPreviewQuery,
} from "@/modules/store/api/studentSubscriptionsApi";
import { useGetStoreOffersQuery, useTestBuyCourseMutation } from "@/modules/store/api/storeApi";
import { CoursePurchaseModal } from "@/modules/store/components/CoursePurchaseModal";
import type { BrowseCourse } from "@/modules/store/types/courseBrowse";
import type { StoreOffer } from "@/modules/store/types";
import {
  courseLessonsLabel,
  courseModulesLabel,
  describeCourseAccess,
  getCoursePriceInr,
  inferLevel,
  resolveLearnerKind,
} from "@/modules/store/utils/courseBrowseAccess";
import { inferCategory } from "@/modules/store/utils/courseCategory";
import { useStudentType } from "@/modules/user-management/auth/hooks/useStudentType";
import { Alert } from "@/shared/ui";

const CATEGORY_THEMES: Record<string, { color: string; icon: string }> = {
  "Development": { color: "blue", icon: "💻" },
  "AI & Machine Learning": { color: "purple", icon: "🤖" },
  "Data Science": { color: "pink", icon: "📊" },
  "Design": { color: "navy", icon: "🎨" },
  "Business": { color: "green", icon: "💼" },
  "Marketing": { color: "orange", icon: "🚀" },
};

type LocationState = { course?: BrowseCourse };
type TabKey = "overview" | "curriculum" | "learn" | "instructor";

const SAVED_COURSES_KEY = "examlms_saved_courses";

export function BrowseCourseDetailPage() {
  const { courseId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null)?.course;
  const { isInstitutionStudent } = useStudentType();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [isSaved, setIsSaved] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isEnrollingDirect, setIsEnrollingDirect] = useState(false);
  const [testBuy] = useTestBuyCourseMutation();
  const notify = useNotify();
  const { user } = useAuth();

  const handleEnrollNow = async () => {
    if (!course) return;
    setIsEnrollingDirect(true);
    try {
      await testBuy({
        courseId: course.course_id,
        name: user?.full_name || "Student",
        email: user?.email,
      }).unwrap();
      notify.success(`Enrolled in ${course.title}! Starting your course...`);
      navigate(`/courses/${course.course_id}/learn`);
    } catch {
      setIsPurchaseModalOpen(true);
    } finally {
      setIsEnrollingDirect(false);
    }
  };

  // Initialize wishlist / saved status from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_COURSES_KEY);
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        setIsSaved(ids.includes(courseId));
      }
    } catch {
      // fallback
    }
  }, [courseId]);

  const toggleSaveForLater = () => {
    try {
      const stored = localStorage.getItem(SAVED_COURSES_KEY);
      const ids: string[] = stored ? JSON.parse(stored) : [];
      let updated: string[];
      if (ids.includes(courseId)) {
        updated = ids.filter((id) => id !== courseId);
        setIsSaved(false);
      } else {
        updated = [...ids, courseId];
        setIsSaved(true);
      }
      localStorage.setItem(SAVED_COURSES_KEY, JSON.stringify(updated));
    } catch {
      setIsSaved((prev) => !prev);
    }
  };

  const { data, isLoading } = useBrowsePublishedCoursesQuery({ page: 1, per_page: 100 });
  const { data: storeData } = useGetStoreOffersQuery();

  // Fetch real curriculum preview
  const {
    data: curriculumPreview,
    isLoading: isLoadingCurriculum,
    isError: isCurriculumError,
  } = useGetCourseCurriculumPreviewQuery(courseId, {
    skip: !courseId,
  });

  const course = useMemo(() => {
    if (state?.course_id === courseId) return state;
    return data?.courses.find((c) => String(c.course_id) === String(courseId));
  }, [state, data?.courses, courseId]);

  const offersMap = useMemo(() => {
    const map = new Map<string, StoreOffer>();
    (storeData?.offers ?? []).forEach((o) => map.set(String(o.course_id), o));
    return map;
  }, [storeData]);

  const offer = offersMap.get(courseId);
  const access = course
    ? describeCourseAccess(course, resolveLearnerKind(isInstitutionStudent), offer, PAYMENTS_ENABLED)
    : null;

  const priceInr = course ? getCoursePriceInr(course, offer) : 1999;
  const isEnrolled = course?.access_status === "enrolled";

  // Auto-expand first module once curriculum loads
  useEffect(() => {
    if (curriculumPreview?.modules && curriculumPreview.modules.length > 0) {
      setExpandedModules((prev) => {
        if (Object.keys(prev).length === 0) {
          const firstId = curriculumPreview.modules[0]?.id;
          return firstId ? { [firstId]: true } : prev;
        }
        return prev;
      });
    }
  }, [curriculumPreview]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const expandAllModules = () => {
    if (!curriculumPreview?.modules) return;
    const allExpanded: Record<string, boolean> = {};
    curriculumPreview.modules.forEach((m) => {
      allExpanded[m.id] = true;
    });
    setExpandedModules(allExpanded);
  };

  const collapseAllModules = () => {
    setExpandedModules({});
  };

  if (isLoading && !course) {
    return (
      <div className="lms-ui-kit-catalog mx-auto w-full max-w-[1500px] pb-16">
        <div className="loading-state">
          <div className="spinner" />
          Loading course details…
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="lms-ui-kit-catalog mx-auto w-full max-w-[1500px] pb-16">
        <button type="button" className="back-link" onClick={() => navigate("/courses")}>
          <ArrowLeft size={16} /> Back to courses
        </button>
        <div className="empty-state">
          <BookOpen size={32} />
          <h3>Course not found</h3>
          <p>It may have been removed or is not available for your account.</p>
          <Link to="/courses" className="text-link" style={{ display: "inline-block", marginTop: 12 }}>
            Browse catalog
          </Link>
        </div>
      </div>
    );
  }

  const category = inferCategory(course.title, course.summary);
  const theme = CATEGORY_THEMES[category] ?? { color: "blue", icon: "📚" };
  const level = inferLevel(course.summary || "", course.title);
  const instructor = course.instructor_name || "ExamLMS Faculty";
  const rating = (course as any).rating != null ? Number((course as any).rating) : null;
  const learners = (course as any).learners_count != null ? Number((course as any).learners_count) : null;

  const modulesList = curriculumPreview?.modules ?? [];
  const allExpanded =
    modulesList.length > 0 && modulesList.every((m) => expandedModules[m.id]);

  const skills = course.skills || [];

  return (
    <div className="lms-ui-kit-catalog mx-auto w-full max-w-[1500px] pb-16">
      <button type="button" className="back-link" onClick={() => navigate("/courses")}>
        <ArrowLeft size={16} /> Back to explore courses
      </button>

      <div className="detail-layout">
        <div className="detail-main">
          {/* Hero Banner with Course Visual */}
          <div className="detail-header-card">
            {course.thumbnail_media_id ? (
              <div className="relative h-56 sm:h-64 w-full rounded-2xl overflow-hidden mb-6 bg-slate-900 shadow-md">
                <img
                  src={`/api/v1/media/${course.thumbnail_media_id}`}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : null}

            <div className="meta-pills flex flex-wrap items-center gap-2 mb-3">
              <span className="course-category font-bold">{category}</span>
              <span className="meta-pill">{level}</span>
              {isEnrolled && (
                course.access_type === "purchased" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    <ShoppingBag size={12} /> Purchased Access
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                    <ShieldCheck size={12} /> Institution Licensed
                  </span>
                )
              )}
            </div>

            <h1 className="detail-title text-2xl sm:text-3xl font-extrabold text-[#111827]">
              {course.title}
            </h1>

            {course.summary ? (
              <p className="detail-summary text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
                {course.summary}
              </p>
            ) : null}

            {/* Skills Covered Pills */}
            {skills.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 mr-1">Skills covered:</span>
                {skills.map((s) => (
                  <span
                    key={s}
                    className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-xs font-semibold text-slate-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            <div className="detail-meta-row flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
              <span className="font-semibold text-slate-700">Created by {instructor}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock3 size={15} /> {course.duration_label}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <PlayCircle size={15} /> {courseLessonsLabel(course)}
                {courseModulesLabel(course) ? ` · ${courseModulesLabel(course)}` : ""}
              </span>
              {rating !== null && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Star size={15} fill="#F5A623" stroke="#F5A623" /> {rating.toFixed(1)}
                    {learners !== null && ` (${learners.toLocaleString()} learners)`}
                  </span>
                </>
              )}
            </div>

            {/* Interactive Tabs */}
            <div className="tabs mt-6">
              <button
                type="button"
                className={`tab ${activeTab === "overview" ? "active" : ""}`}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                className={`tab ${activeTab === "curriculum" ? "active" : ""}`}
                onClick={() => setActiveTab("curriculum")}
              >
                Curriculum ({modulesList.length > 0 ? modulesList.length : course.modules_count || 1})
              </button>
              <button
                type="button"
                className={`tab ${activeTab === "learn" ? "active" : ""}`}
                onClick={() => setActiveTab("learn")}
              >
                What you&apos;ll learn
              </button>
              <button
                type="button"
                className={`tab ${activeTab === "instructor" ? "active" : ""}`}
                onClick={() => setActiveTab("instructor")}
              >
                Instructor
              </button>
            </div>

            {/* TAB: OVERVIEW / LEARN */}
            {(activeTab === "overview" || activeTab === "learn") && (
              <section className="detail-section">
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
                      "Build job-ready practical skills step by step",
                      "Practice with interactive chapter exercises",
                      "Complete graded assessments to measure mastery",
                      "Earn a verifiable digital certificate upon completion",
                    ].map((line) => (
                      <span key={line}>
                        <CheckCircle2 size={16} />
                        {line}
                      </span>
                    ))}
                </div>
              </section>
            )}

            {/* TAB: CURRICULUM */}
            {(activeTab === "overview" || activeTab === "curriculum") && (
              <section className="detail-section mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 style={{ margin: 0 }}>Course Curriculum</h3>
                    <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {modulesList.length > 0
                        ? `${modulesList.length} ${modulesList.length === 1 ? "module" : "modules"} · ${courseLessonsLabel(course)} · ${course.duration_label}`
                        : "Module preview from published course curriculum."}
                    </p>
                  </div>
                  {modulesList.length > 0 && (
                    <button
                      type="button"
                      className="text-link"
                      style={{ fontSize: 12, cursor: "pointer" }}
                      onClick={allExpanded ? collapseAllModules : expandAllModules}
                    >
                      {allExpanded ? "Collapse all" : "Expand all"}
                    </button>
                  )}
                </div>

                {isLoadingCurriculum && (
                  <div className="loading-state" style={{ minHeight: 120 }}>
                    <div className="spinner" />
                    Loading curriculum preview…
                  </div>
                )}

                {isCurriculumError && (
                  <Alert tone="info" className="my-2">
                    Curriculum outline is available for registered students. Review overview and enrollment details.
                  </Alert>
                )}

                {!isLoadingCurriculum && modulesList.length === 0 && (
                  <div className="curriculum-empty">
                    <Layers size={22} className="text-gray-400" />
                    <p>Curriculum outline will display published modules once configured by instructors.</p>
                  </div>
                )}

                {!isLoadingCurriculum && modulesList.length > 0 && (
                  <div className="curriculum-accordion space-y-3">
                    {modulesList.map((m, mIdx) => {
                      const isOpen = expandedModules[m.id];
                      return (
                        <div key={m.id} className="module-accordion-card">
                          <button
                            type="button"
                            className="module-accordion-header"
                            onClick={() => toggleModule(m.id)}
                            aria-expanded={isOpen}
                          >
                            <div className="flex items-center gap-3">
                              <span className="module-num-badge">Module {mIdx + 1}</span>
                              <span className="module-title-text font-bold">{m.title}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-500 text-xs">
                              <span>
                                {m.chapters.length} {m.chapters.length === 1 ? "lesson" : "lessons"}
                              </span>
                              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="module-accordion-content">
                              {m.description && (
                                <p className="module-desc-text text-xs text-slate-500 mb-2">{m.description}</p>
                              )}
                              <ul className="chapter-preview-list divide-y divide-slate-100">
                                {m.chapters.map((ch, chIdx) => (
                                  <li key={ch.id} className="chapter-preview-item py-2 flex items-center justify-between text-xs text-slate-700">
                                    <div className="flex items-center gap-2">
                                      <PlayCircle size={14} className="text-[#635BFF] shrink-0" />
                                      <span>{chIdx + 1}. {ch.title}</span>
                                    </div>
                                    <span className="text-slate-400 font-mono text-[11px]">
                                      {Math.round(ch.duration_seconds / 60)} min
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* TAB: INSTRUCTOR */}
            {activeTab === "instructor" && (
              <section className="detail-section">
                <h3>About the Instructor</h3>
                <div className="instructor-card-profile">
                  <div className="instructor-avatar">
                    <UserCheck size={32} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16 }}>{instructor}</h4>
                    <p className="muted" style={{ margin: "4px 0 10px", fontSize: 13 }}>
                      Verified Instructor · ExamLMS Academy
                    </p>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: "#475569" }}>
                      Experienced educator dedicated to practical, hands-on learning. Every lesson is crafted with
                      real-world relevance to help learners build confident, job-ready skills.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {access?.hint ? (
              <Alert tone="info" className="mt-4">
                {access.hint}
              </Alert>
            ) : null}
          </div>
        </div>

        {/* Right-side Sticky Enrollment Panel */}
        <aside className="enroll-card">
          <div className={`enroll-thumb ${theme.color}`}>
            <span>{theme.icon}</span>
          </div>

          <div className="price-line">
            {isEnrolled ? (
              <div>
                <strong className="text-emerald-600">
                  {course.access_type === "purchased" ? "Purchased" : "Enrolled"}
                </strong>
                <small className="price-subline block text-slate-500">
                  {course.access_type === "purchased" ? "Full Individual Lifetime Access" : "Licensed under your Institution"}
                </small>
              </div>
            ) : (
              <div>
                <strong className="text-2xl font-black text-slate-900">
                  ₹{priceInr.toLocaleString("en-IN")}
                </strong>
                <small className="price-subline block text-slate-500">
                  Full Lifetime Access • GST Included
                </small>
              </div>
            )}
          </div>

          {isEnrolled ? (
            <button
              type="button"
              className="btn btn-primary full !bg-[#635BFF] hover:!bg-[#5046E5] !text-white !font-bold"
              onClick={() => navigate(`/courses/${course.course_id}/learn`)}
            >
              Start Learning
            </button>
          ) : (
            <button
              type="button"
              disabled={isEnrollingDirect}
              className="btn btn-primary full !bg-[#635BFF] hover:!bg-[#5046E5] !text-white !font-bold disabled:opacity-50"
              onClick={handleEnrollNow}
            >
              <Sparkles size={16} />
              <span>{isEnrollingDirect ? "Enrolling..." : "Enroll Now"}</span>
            </button>
          )}

          {/* Save for later interaction button */}
          <button
            type="button"
            className="btn btn-outline full mt-2"
            onClick={toggleSaveForLater}
          >
            <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
            {isSaved ? "Saved for later" : "Save for later"}
          </button>

          <div className="includes">
            <b>This course includes</b>
            <span>
              <PlayCircle size={15} /> {course.duration_label} of structured learning
            </span>
            <span>
              <BookOpen size={15} /> {courseLessonsLabel(course)}
            </span>
            <span>
              <Layers size={15} /> {courseModulesLabel(course) || "Comprehensive modules"}
            </span>
            <span>
              <CheckCircle2 size={15} /> Verifiable completion certificate
            </span>
          </div>

          <small className="muted" style={{ display: "block", marginTop: 12 }}>
            Instant access upon purchase. The course unlocks immediately in your My Learning tab with full progress tracking.
          </small>
        </aside>
      </div>

      {/* Purchase Modal */}
      <CoursePurchaseModal
        isOpen={isPurchaseModalOpen}
        course={course}
        offer={offer}
        onClose={() => setIsPurchaseModalOpen(false)}
      />
    </div>
  );
}

export default BrowseCourseDetailPage;
