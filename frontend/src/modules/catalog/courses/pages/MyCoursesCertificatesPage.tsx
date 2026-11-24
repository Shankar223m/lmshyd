import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { useListEnrollmentsQuery } from "@/modules/learning/enrollments/api/enrollmentsApi";
import { useListCertificatesQuery } from "@/modules/certificates/issued/api/certificatesApi";
import { useListMyCoursesQuery } from "@/modules/learning/common/api/myCoursesApi";
import { useListCoursesQuery } from "@/modules/catalog/courses/api/coursesApi";
import { useGetMyCourseAccessQuery, useGetMyPurchasesQuery } from "@/modules/store/api/storeApi";
import { useBrowsePublishedCoursesQuery } from "@/modules/store/api/studentSubscriptionsApi";
import { courseThumbnailSrc } from "@/modules/catalog/common/courseThumbnail";
import { cn } from "@/core/lib/cn";
import {
  Play,
  CheckCircle2,
  Clock,
  BookOpen,
  ArrowRight,
  Layers,
  BarChart2,
  Terminal,
  Code2,
  ShieldCheck,
  ShoppingBag,
  GraduationCap,
} from "lucide-react";

interface EnrichedCourse {
  course_id: string;
  title: string;
  summary?: string;
  category?: string;
  duration?: string;
  instructor?: string;
  modules_count: number;
  chapters_count: number;
  completed_lessons: number;
  progressPercent: number;
  status: "Not Started" | "In Progress" | "Completed";
  isDone: boolean;
  thumbnailUrl?: string | null;
  certificateId?: string | null;
  accessType: "institution" | "purchased";
}

export function MyCoursesCertificatesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Backend queries
  useListEnrollmentsQuery({
    status: "active",
    per_page: 50,
  });

  const { data: myCourses } = useListMyCoursesQuery();
  const { data: certsData } = useListCertificatesQuery({ per_page: 50 });
  const { data: catalogCoursesData } = useListCoursesQuery({ per_page: 50, published_only: true });
  const { data: myAccessList } = useGetMyCourseAccessQuery();
  const { data: myPurchasesList } = useGetMyPurchasesQuery();
  const { data: browseData } = useBrowsePublishedCoursesQuery({ page: 1, per_page: 100 });

  const certificates = certsData?.items ?? [];
  const catalogCourses = catalogCoursesData?.items ?? [];
  const browseCourses = browseData?.courses ?? [];

  const catalogMap = useMemo(() => {
    const map = new Map<string, (typeof catalogCourses)[0]>();
    catalogCourses.forEach((c) => {
      map.set(String(c.course_id), c);
    });
    return map;
  }, [catalogCourses]);

  const browseMap = useMemo(() => {
    const map = new Map<string, (typeof browseCourses)[0]>();
    browseCourses.forEach((c) => {
      map.set(String(c.course_id), c);
    });
    return map;
  }, [browseCourses]);

  // Enrich courses: strictly only courses the student is entitled to access (institutional or purchased)
  const enrichedCourses: EnrichedCourse[] = useMemo(() => {
    const accessMap = new Map<string, any>();
    (myAccessList || []).forEach((acc) => {
      accessMap.set(String(acc.course_id), acc);
    });

    const purchasesMap = new Map<string, any>();
    (myPurchasesList || []).forEach((pur) => {
      if (pur.status === "paid") {
        purchasesMap.set(String(pur.course_id), pur);
      }
    });

    // Collect distinct enrolled / entitled course ids
    const entitledCourseMap = new Map<string, any>();

    // 1. Any course in browse catalog marked access_status === "enrolled"
    browseCourses.forEach((bc) => {
      if (bc.access_status === "enrolled") {
        entitledCourseMap.set(String(bc.course_id), {
          course_id: String(bc.course_id),
          title: bc.title,
          summary: bc.summary,
          modules_count: bc.modules_count || 1,
          chapters_count: bc.chapters_count || 1,
          duration: bc.duration_label || "4.5h",
          instructor: bc.instructor_name || "ExamLMS Faculty",
          access_type: bc.access_type || "institution",
          thumbnail_media_id: bc.thumbnail_media_id,
        });
      }
    });

    // 2. Courses from enrollment service
    (myCourses || []).forEach((c) => {
      const cid = String(c.course_id);
      if (!entitledCourseMap.has(cid)) {
        entitledCourseMap.set(cid, {
          course_id: cid,
          title: c.title,
        });
      }
    });

    // 3. Courses with individual access grant
    (myAccessList || []).forEach((acc) => {
      const cid = String(acc.course_id);
      if (!entitledCourseMap.has(cid)) {
        entitledCourseMap.set(cid, {
          course_id: cid,
          title: `Course ${cid}`,
          access_type: "purchased",
        });
      } else {
        // If also individually granted, mark as purchased
        const existing = entitledCourseMap.get(cid);
        existing.access_type = "purchased";
      }
    });

    // 4. Paid purchases from billing
    (myPurchasesList || []).forEach((pur) => {
      if (pur.status === "paid") {
        const cid = String(pur.course_id);
        if (!entitledCourseMap.has(cid)) {
          entitledCourseMap.set(cid, {
            course_id: cid,
            title: `Course ${cid}`,
            access_type: "purchased",
          });
        } else {
          const existing = entitledCourseMap.get(cid);
          existing.access_type = "purchased";
        }
      }
    });

    // No dummy or mock fallback courses! Return real entitled list only.
    const list = Array.from(entitledCourseMap.values());
    const studentId = user?.user_id || "guest";

    return list.map((c) => {
      const courseIdStr = String(c.course_id);
      const isPurchased = purchasesMap.has(courseIdStr) || c.access_type === "purchased";
      const accessType: "institution" | "purchased" = isPurchased ? "purchased" : "institution";

      const matchingCert = certificates.find((crt) => String(crt.course_id) === courseIdStr);
      const isDone = Boolean(matchingCert);
      const catalogEntry = catalogMap.get(courseIdStr);
      const browseEntry = browseMap.get(courseIdStr);

      const title = c.title || browseEntry?.title || catalogEntry?.title || "Course";
      const summary = c.summary || browseEntry?.summary || catalogEntry?.summary || "";
      const modulesCount = browseEntry?.modules_count || c.modules_count || 1;
      const chaptersCount = browseEntry?.chapters_count || c.chapters_count || 1;
      const duration = browseEntry?.duration_label || c.duration || "4h";
      const instructor = browseEntry?.instructor_name || c.instructor || (catalogEntry as any)?.instructor_name || "ExamLMS Faculty";

      let progressPct = 0;
      if (isDone) {
        progressPct = 100;
      } else {
        try {
          const savedKey = `examlms_video_progress_${studentId}_${courseIdStr}`;
          const savedStr = localStorage.getItem(savedKey);
          if (savedStr) {
            const savedData = JSON.parse(savedStr);
            const topicKeys = Object.keys(savedData);
            if (topicKeys.length > 0) {
              const allDone = topicKeys.every((k) => savedData[k]?.completed || (savedData[k]?.percent || 0) >= 100);
              const totalTopicPct = topicKeys.reduce((acc, k) => acc + (savedData[k]?.percent || 0), 0);
              const avg = Math.round(totalTopicPct / topicKeys.length);
              progressPct = allDone ? 100 : Math.min(100, Math.max(0, avg));
            }
          }
        } catch {
          // fallback
        }
      }

      let status: "Not Started" | "In Progress" | "Completed" = "Not Started";
      if (progressPct === 100 || isDone) {
        status = "Completed";
      } else if (progressPct > 0) {
        status = "In Progress";
      }

      const completedLessons = Math.min(chaptersCount, Math.round((progressPct / 100) * chaptersCount));

      return {
        course_id: courseIdStr,
        title,
        summary,
        category: "Technology",
        duration,
        instructor,
        modules_count: modulesCount,
        chapters_count: chaptersCount,
        completed_lessons: completedLessons,
        progressPercent: progressPct,
        status,
        isDone,
        thumbnailUrl: courseThumbnailSrc(
          browseEntry?.thumbnail_media_id ?? catalogMap.get(courseIdStr)?.thumbnail_media_id,
        ),
        certificateId: matchingCert?.certificate_id ? String(matchingCert.certificate_id) : null,
        accessType,
      };
    });
  }, [browseCourses, myCourses, myAccessList, myPurchasesList, certificates, catalogMap, browseMap, user?.user_id]);

  // Statistics Calculation
  const totalCourses = enrichedCourses.length;
  const completedCourses = enrichedCourses.filter((c) => c.status === "Completed").length;
  const inProgressCourses = enrichedCourses.filter((c) => c.status === "In Progress").length;

  // Active course for "Continue Learning" hero banner (first in-progress, or first course)
  const continueCourse = useMemo(() => {
    return enrichedCourses.find((c) => c.status === "In Progress") || enrichedCourses[0] || null;
  }, [enrichedCourses]);

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827]">
            My Learning
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Access your enrolled and purchased courses, track your learning journey, and review certificates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/courses")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7DC8F7] hover:bg-[#5CB8EC] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all cursor-pointer self-start sm:self-auto"
        >
          <BookOpen className="w-4 h-4" />
          <span>Browse Courses</span>
        </button>
      </div>

      {/* 2. Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="rounded-xl border border-[#E5E7EB]/90 bg-white p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#F5F4FF] border border-[#E5E7EB] flex items-center justify-center shrink-0">
            <Play className="w-5 h-5 fill-indigo-600 text-[#7DC8F7] ml-0.5" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#111827]">{totalCourses}</p>
            <p className="text-xs font-medium text-slate-500">Accessible Courses</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB]/90 bg-white p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#111827]">{inProgressCourses}</p>
            <p className="text-xs font-medium text-slate-500">In Progress</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB]/90 bg-white p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#111827]">{completedCourses}</p>
            <p className="text-xs font-medium text-slate-500">Completed</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB]/90 bg-white p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#111827]">{certificates.length}</p>
            <p className="text-xs font-medium text-slate-500">Certificates Earned</p>
          </div>
        </div>
      </div>

      {/* 3. Continue Learning Hero */}
      {continueCourse && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-[#111827]">Continue Learning</h2>
          <div className="rounded-xl border border-[#E5E7EB]/90 bg-white p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div
                  onClick={() => navigate(`/courses/${continueCourse.course_id}/learn`)}
                  className="relative h-20 w-36 sm:h-24 sm:w-44 rounded-xl overflow-hidden bg-gradient-to-br from-brand-50 via-brand-100 to-slate-100 shrink-0 flex items-center justify-center cursor-pointer group shadow-sm"
                >
                  {continueCourse.thumbnailUrl ? (
                    <img
                      src={continueCourse.thumbnailUrl}
                      alt={continueCourse.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/90 border border-brand-200 flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform shadow-sm">
                      <Play className="w-5 h-5 fill-brand-500 text-brand-500 ml-0.5" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    {continueCourse.accessType === "institution" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-[#7DC8F7] border border-indigo-200">
                        <ShieldCheck className="w-3 h-3" />
                        Institution
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShoppingBag className="w-3 h-3" />
                        Purchased
                      </span>
                    )}
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">{continueCourse.duration}</span>
                  </div>

                  <h3
                    onClick={() => navigate(`/courses/${continueCourse.course_id}/learn`)}
                    className="text-base sm:text-lg font-bold text-[#111827] hover:text-[#7DC8F7] transition-colors cursor-pointer truncate"
                  >
                    {continueCourse.title}
                  </h3>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 max-w-xs h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#7DC8F7] transition-all duration-500"
                        style={{ width: `${continueCourse.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-[#7DC8F7] shrink-0">
                      {continueCourse.progressPercent}%
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/courses/${continueCourse.course_id}/learn`)}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#7DC8F7] hover:bg-[#5CB8EC] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-sm transition-all cursor-pointer shrink-0"
              >
                <span>Continue Learning</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Enrolled & Purchased Courses Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">Enrolled & Purchased Courses</h2>
            <p className="text-xs text-slate-500">Only verified courses you have full access to study</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/courses")}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#7DC8F7] hover:text-[#5CB8EC] transition-colors cursor-pointer"
          >
            <span>Explore Course Marketplace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {enrichedCourses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#7DC8F7] mb-4">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Enrolled Courses in My Learning</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
              You do not have any active course enrollments yet. Discover new courses and individual learning packages in our course marketplace.
            </p>
            <button
              type="button"
              onClick={() => navigate("/courses")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#7DC8F7] hover:bg-[#5CB8EC] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Browse Courses</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {enrichedCourses.map((course) => {
              const isPython = course.title.toLowerCase().includes("python");
              const isReact = course.title.toLowerCase().includes("react");
              const isData = course.title.toLowerCase().includes("data");
              const pct = course.progressPercent;
              const isComplete = course.status === "Completed";

              return (
                <div
                  key={course.course_id}
                  onClick={() => navigate(`/courses/${course.course_id}/learn`)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#E5E7EB]/90 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg cursor-pointer"
                >
                  <div>
                    {/* Thumbnail Card */}
                    <div className="relative h-40 w-full overflow-hidden rounded-xl bg-gradient-to-br from-brand-50 via-brand-100 to-slate-100 flex items-center justify-center text-slate-700">
                      {course.thumbnailUrl ? (
                        <img
                          src={course.thumbnailUrl}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                          {isPython ? (
                            <div className="w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-1.5">
                              <Terminal className="w-8 h-8 text-amber-400" />
                            </div>
                          ) : isReact ? (
                            <div className="w-14 h-14 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center mb-1.5">
                              <Code2 className="w-8 h-8 text-cyan-400" />
                            </div>
                          ) : isData ? (
                            <div className="w-14 h-14 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mb-1.5">
                              <BarChart2 className="w-8 h-8 text-emerald-400" />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center mb-1.5">
                              <Layers className="w-8 h-8 text-indigo-400" />
                            </div>
                          )}
                          <span className="text-xs font-semibold text-slate-600 line-clamp-1">{course.title}</span>
                        </div>
                      )}

                      {/* Access Badge (Top Left) */}
                      <div className="absolute top-2.5 left-2.5">
                        {course.accessType === "institution" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600/90 text-white backdrop-blur-md shadow-xs">
                            <ShieldCheck className="w-3 h-3" />
                            Institution
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600/90 text-white backdrop-blur-md shadow-xs">
                            <ShoppingBag className="w-3 h-3" />
                            Purchased
                          </span>
                        )}
                      </div>

                      {/* Status Indicator (Top Right) */}
                      <div className="absolute top-2.5 right-2.5">
                        {isComplete ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500 text-white shadow-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            Completed
                          </span>
                        ) : pct > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500 text-white shadow-xs">
                            In Progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-700/80 text-slate-200 backdrop-blur-md shadow-xs">
                            Not Started
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Metadata */}
                    <div className="pt-3.5 space-y-1.5">
                      <h3 className="text-sm font-bold text-[#111827] line-clamp-1 group-hover:text-[#7DC8F7] transition-colors">
                        {course.title}
                      </h3>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>By {course.instructor}</span>
                        <span>{course.duration}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span>
                          {course.modules_count} {course.modules_count === 1 ? "module" : "modules"} • {course.chapters_count} {course.chapters_count === 1 ? "lesson" : "lessons"}
                        </span>
                        <span className="font-semibold text-slate-700">
                          {course.completed_lessons}/{course.chapters_count} completed
                        </span>
                      </div>

                      {/* Progress Bar & Percentage */}
                      <div className="pt-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span className="text-slate-500">Progress</span>
                          <span className="text-[#7DC8F7]">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#7DC8F7] transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom CTA Button */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/courses/${course.course_id}/learn`);
                      }}
                      className={cn(
                        "w-full rounded-xl py-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5",
                        pct === 0
                          ? "border border-[#E5E7EB] text-[#7DC8F7] hover:bg-[#F5F4FF]"
                          : isComplete
                            ? "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            : "bg-[#F5F4FF] text-[#7DC8F7] hover:bg-[#7DC8F7] hover:text-white",
                      )}
                    >
                      <span>
                        {pct === 0 ? "Start Learning" : isComplete ? "Review Course" : "Continue Learning"}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyCoursesCertificatesPage;
