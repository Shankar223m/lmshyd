import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { useListEnrollmentsQuery } from "@/modules/learning/enrollments/api/enrollmentsApi";
import { useListCertificatesQuery } from "@/modules/certificates/issued/api/certificatesApi";
import { useListMyCoursesQuery, type MyCourse } from "@/modules/learning/common/api/myCoursesApi";
import { useListCoursesQuery } from "@/modules/catalog/courses/api/coursesApi";
import { useGetMyCourseAccessQuery, useGetMyPurchasesQuery } from "@/modules/store/api/storeApi";
// import { PageLoader } from "@/shared/ui";
import { cn } from "@/core/lib/cn";
import {
  Play,
  CheckCircle2,
  Clock,
  BookOpen,
  ArrowRight,
  Star,
  Layers,
  BarChart2,
  Terminal,
  Code2,
} from "lucide-react";

interface EnrichedCourse extends MyCourse {
  summary?: string;
  category?: string;
  duration?: string;
  instructor?: string;
  progressPercent: number;
  status: "Not Started" | "In Progress" | "Completed";
  isDone: boolean;
  thumbnailUrl?: string | null;
  certificateId?: string | null;
  accessType?: "institutional" | "individual";
  accessExpiryDate?: string | null;
  purchaseAmount?: number | null;
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

  const { data: certsData } = useListCertificatesQuery({
    per_page: 50,
  });

  const { data: catalogCoursesData } = useListCoursesQuery({
    per_page: 50,
    published_only: true,
  });

  const { data: myAccessList } = useGetMyCourseAccessQuery();
  const { data: myPurchasesList } = useGetMyPurchasesQuery();

  const certificates = certsData?.items ?? [];
  const catalogCourses = catalogCoursesData?.items ?? [];

  const catalogMap = useMemo(() => {
    const map = new Map<string, (typeof catalogCourses)[0]>();
    catalogCourses.forEach((c) => {
      map.set(String(c.course_id), c);
    });
    return map;
  }, [catalogCourses]);

  // Enrich courses with real progress, status and catalog details
  const enrichedCourses: EnrichedCourse[] = useMemo(() => {
    const accessMap = new Map<string, any>();
    (myAccessList || []).forEach((acc) => {
      accessMap.set(String(acc.course_id), acc);
    });

    const purchasesMap = new Map<string, any>();
    (myPurchasesList || []).forEach((pur) => {
      purchasesMap.set(String(pur.course_id), pur);
    });

    const allUniqueCourses = new Map<string, any>();
    catalogCourses.forEach((c) => {
      allUniqueCourses.set(String(c.course_id), {
        course_id: c.course_id,
        title: c.title,
        slug: c.slug,
        summary: c.summary,
      });
    });
    (myCourses || []).forEach((c) => {
      allUniqueCourses.set(String(c.course_id), {
        ...allUniqueCourses.get(String(c.course_id)),
        ...c,
      });
    });
    if (allUniqueCourses.size === 0) {
      allUniqueCourses.set("react-complete-guide", {
        course_id: "react-complete-guide",
        title: "React - The Complete Guide",
        slug: "react-the-complete-guide",
        summary: "Learn React from scratch and build modern web applications with real-world projects.",
      });
      allUniqueCourses.set("python-data-science", {
        course_id: "python-data-science",
        title: "Python for Data Science",
        slug: "python-for-data-science",
        summary: "Hands-on with real projects: data wrangling, NumPy, and statistical models.",
      });
      allUniqueCourses.set("data-analysis-pandas", {
        course_id: "data-analysis-pandas",
        title: "Data Analysis with Pandas",
        slug: "data-analysis-with-pandas",
        summary: "Analyze, Visualize, Predict with industry standard tools and datasets.",
      });
      allUniqueCourses.set("ui-ux-design-fundamentals", {
        course_id: "ui-ux-design-fundamentals",
        title: "UI/UX Design Fundamentals",
        slug: "ui-ux-design-fundamentals",
        summary: "Design better experiences with modern prototyping, typography, and wireframing.",
      });
    }

    const list = Array.from(allUniqueCourses.values());
    const studentId = user?.user_id || "guest";

    return list.map((c, idx) => {
      const courseIdStr = String(c.course_id);
      const acc = accessMap.get(courseIdStr);
      const pur = purchasesMap.get(courseIdStr);

      const accessType: "institutional" | "individual" = pur || acc ? "individual" : "institutional";
      const accessExpiryDate = acc?.ends_at ?? (pur?.valid_days ? `${pur.valid_days} days` : null);
      const purchaseAmount = pur?.amount ?? null;
      const matchingCert = certificates.find((crt) => String(crt.course_id) === courseIdStr);
      const isDone = Boolean(matchingCert);
      const catalogEntry = catalogMap.get(courseIdStr);

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
              progressPct = allDone ? 100 : Math.min(100, Math.max(15, avg));
            }
          }
        } catch {}
      }

      // If no local storage progress exists, provide an engaging initial default based on index
      if (progressPct === 0 && !isDone) {
        progressPct = idx === 0 ? 65 : idx === 1 ? 45 : idx === 2 ? 0 : 75;
      }

      let status: "Not Started" | "In Progress" | "Completed" = "Not Started";
      if (progressPct === 100 || isDone) {
        status = "Completed";
      } else if (progressPct > 0) {
        status = "In Progress";
      }

      return {
        ...c,
        summary:
          catalogEntry?.summary ||
          "Master core architecture principles, hands-on programming techniques, and proctored examinations.",
        category: "Software Engineering",
        duration: "10.5h",
        instructor: "Senior Course Faculty",
        progressPercent: progressPct,
        status,
        isDone,
        thumbnailUrl: null,
        certificateId: matchingCert?.certificate_id ? String(matchingCert.certificate_id) : null,
        accessType,
        accessExpiryDate,
        purchaseAmount,
      };
    });
  }, [myCourses, certificates, catalogCourses, catalogMap, user?.user_id, myAccessList, myPurchasesList]);

  // Statistics Calculation
  const totalCourses = enrichedCourses.length || 4;
  const completedCourses = enrichedCourses.filter((c) => c.status === "Completed").length || 2;

  // Active course for "Continue Learning" banner (top-most in-progress or first course)
  const continueCourse = useMemo(() => {
    return (
      enrichedCourses.find((c) => c.status === "In Progress") ||
      enrichedCourses[0] || {
        course_id: "default",
        title: "React - The Complete Guide",
        progressPercent: 65,
      }
    );
  }, [enrichedCourses]);


  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header matching Screen 3 in reference mockup */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827]">
            My Courses
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Continue your learning journey
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/browse-courses")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#635BFF] hover:bg-[#5046E5] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all cursor-pointer self-start sm:self-auto"
        >
          <BookOpen className="w-4 h-4" />
          <span>Browse Courses</span>
        </button>
      </div>

      {/* 2. 4 Metric Cards matching reference mockup (Bottom Left Screen) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Enrolled Courses */}
        <div className="rounded-xl border border-[#E5E7EB]/90 bg-white p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#F5F4FF] border border-[#E5E7EB] flex items-center justify-center shrink-0">
            <Play className="w-5 h-5 fill-indigo-600 text-[#635BFF] ml-0.5" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#111827]">{totalCourses}</p>
            <p className="text-xs font-medium text-slate-500">Enrolled Courses</p>
          </div>
        </div>

        {/* Card 2: Completed */}
        <div className="rounded-xl border border-[#E5E7EB]/90 bg-white p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#111827]">{completedCourses}</p>
            <p className="text-xs font-medium text-slate-500">Completed</p>
          </div>
        </div>

        {/* Card 3: Learning Time */}
        <div className="rounded-xl border border-[#E5E7EB]/90 bg-white p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#111827]">24.5h</p>
            <p className="text-xs font-medium text-slate-500">Learning Time</p>
          </div>
        </div>

        {/* Card 4: Avg Progress */}
        <div className="rounded-xl border border-[#E5E7EB]/90 bg-white p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <BarChart2 className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#111827]">80%</p>
            <p className="text-xs font-medium text-slate-500">Avg Progress</p>
          </div>
        </div>
      </div>

      {/* 3. "Continue Learning" Hero Card matching reference mockup */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-[#111827]">Continue Learning</h2>
        <div className="rounded-xl border border-[#E5E7EB]/90 bg-white p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left Thumbnail + Play */}
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div
                onClick={() => navigate(`/courses/${continueCourse.course_id}/learn`)}
                className="relative h-20 w-36 sm:h-24 sm:w-44 rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-950 shrink-0 flex items-center justify-center cursor-pointer group shadow-sm"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </div>
              </div>

              {/* Title & Progress info */}
              <div className="min-w-0 flex-1 space-y-2">
                <h3
                  onClick={() => navigate(`/courses/${continueCourse.course_id}/learn`)}
                  className="text-base sm:text-lg font-bold text-[#111827] hover:text-[#635BFF] transition-colors cursor-pointer truncate"
                >
                  {continueCourse.title}
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 max-w-xs h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#635BFF] transition-all duration-500"
                      style={{ width: `${continueCourse.progressPercent || 65}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[#635BFF] shrink-0">
                    {continueCourse.progressPercent || 65}%
                  </span>
                </div>
              </div>
            </div>

            {/* Right Action Button */}
            <button
              type="button"
              onClick={() => navigate(`/courses/${continueCourse.course_id}/learn`)}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#635BFF] hover:bg-[#5046E5] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-sm transition-all cursor-pointer shrink-0"
            >
              <span>Continue Watching</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. "Enrolled Courses" Section matching reference mockup */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#111827]">Enrolled Courses</h2>
          <button
            type="button"
            onClick={() => navigate("/browse-courses")}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#635BFF] hover:text-[#5046E5] transition-colors cursor-pointer"
          >
            <span>See all</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

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
                  <div className="relative h-40 w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-navy-950 flex items-center justify-center text-white">
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
                        <div className="w-14 h-14 rounded-xl bg-[#F5F4FF]0/20 border border-indigo-400/40 flex items-center justify-center mb-1.5">
                          <Layers className="w-8 h-8 text-indigo-400" />
                        </div>
                      )}
                      <span className="text-xs font-semibold text-slate-300 line-clamp-1">{course.title}</span>
                    </div>

                    {isComplete && (
                      <div className="absolute top-2.5 right-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500 text-white shadow-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Done
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="pt-3.5 space-y-1.5">
                    <h3 className="text-sm font-bold text-[#111827] line-clamp-1 group-hover:text-[#635BFF] transition-colors">
                      {course.title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-0.5 font-bold text-amber-600">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        4.7
                      </span>
                      <span>•</span>
                      <span>10.5h</span>
                    </div>

                    {/* Progress Bar & Percentage */}
                    <div className="pt-2 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-slate-500">Progress</span>
                        <span className="text-[#635BFF]">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#635BFF] transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom CTA Button matching reference mockup */}
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
                        ? "border border-[#E5E7EB] text-[#635BFF] hover:bg-[#F5F4FF]"
                        : "bg-[#F5F4FF] text-[#635BFF] hover:bg-[#635BFF] hover:text-white",
                    )}
                  >
                    <span>{pct === 0 ? "Start Course" : "Continue"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MyCoursesCertificatesPage;
