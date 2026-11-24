import { useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Play,
  Star,
  Users,
  Layers,
  PlayCircle,
  FileText,
  ClipboardCheck,
  Award,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  UserCheck,
} from "lucide-react";

import {
  useGetCourseQuery,
  useGetVersionQuery,
  usePublishCourseMutation,
} from "@/modules/catalog/courses/api/coursesApi";
import { parseCourseSummary } from "@/modules/catalog/courses/utils/courseMetrics";
import { useNotify } from "@/core/hooks/useNotify";
import { PageLoader } from "@/shared/ui";

type PreviewTab = "overview" | "curriculum" | "reviews" | "instructor";

export function CoursePreviewPage() {
  const { courseId = "" } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const notify = useNotify();

  const [activeTab, setActiveTab] = useState<PreviewTab>("overview");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const { data: course, isLoading: isLoadingCourse } = useGetCourseQuery(courseId, {
    skip: !courseId,
  });

  const activeVersion = course?.versions?.[0];
  const versionId = activeVersion?.version_id ? String(activeVersion.version_id) : "";

  const { data: versionDetail, isLoading: isLoadingVersion } = useGetVersionQuery(
    { courseId, versionId },
    { skip: !courseId || !versionId }
  );

  const [publishCourse, { isLoading: isPublishing }] = usePublishCourseMutation();

  const metrics = useMemo(() => {
    return parseCourseSummary(course?.summary);
  }, [course?.summary]);

  const modules = useMemo(() => {
    return versionDetail?.modules ?? [];
  }, [versionDetail]);

  // Helper to determine topic type safely
  const getTopicType = (t: any): "quiz" | "pdf" | "video" | "notes" => {
    if (t.topic_test_id) return "quiz";
    const itemType = t.items?.[0]?.item_type;
    if (itemType === "quiz" || itemType === "practice") return "quiz";
    if (itemType === "pdf") return "pdf";
    if (itemType === "notes") return "notes";
    return "video";
  };

  const totalModules = modules.length;
  let totalLessons = 0;
  let totalTests = 0;

  modules.forEach((mod) => {
    const topics = mod.topics || [];
    topics.forEach((t) => {
      const type = getTopicType(t);
      if (type === "quiz") {
        totalTests += 1;
      } else {
        totalLessons += 1;
      }
    });
  });

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePublish = async () => {
    try {
      await publishCourse(courseId).unwrap();
      notify.success("Course published successfully!");
      navigate(`/courses/${courseId}/builder`);
    } catch (err: any) {
      notify.error(err?.data?.message || err?.message || "Failed to publish course.");
    }
  };

  if (isLoadingCourse || (versionId && isLoadingVersion)) {
    return <PageLoader label="Loading Course Preview..." />;
  }

  if (!course) {
    return (
      <div className="admin-lms-page">
        <p>Course not found.</p>
        <Link to="/courses" className="admin-btn admin-btn-primary mt-4">
          Back to Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-lms-page">
      {/* Breadcrumb */}
      <nav className="admin-lms-breadcrumb">
        <Link to="/courses">Courses</Link>
        <span className="sep">&gt;</span>
        <span className="current">Course Preview</span>
      </nav>

      {/* Header matching Reference Bottom-Left Screen */}
      <header className="admin-lms-header">
        <div className="admin-lms-header-titles">
          <h1>Course Preview</h1>
        </div>
        <div className="admin-lms-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => navigate(`/courses/${courseId}/builder`)}
          >
            Back to Builder
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? "Publishing..." : "Publish Course"}
          </button>
        </div>
      </header>

      {/* 2-Column Course Preview Layout */}
      <div className="course-preview-grid">
        {/* Left Column: Media Player & Quick Meta */}
        <div>
          <div className="preview-media-player-card">
            {course.thumbnail_media_id ? (
              <img
                src={`/api/v1/media/stream/${course.thumbnail_media_id}`}
                alt={course.title}
                className="w-full h-full object-cover opacity-80"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="text-center p-6">
                <span style={{ fontSize: 56 }}>⚛</span>
              </div>
            )}
            <span className="preview-badge-level">{metrics.level}</span>
            <div className="preview-play-btn" style={{ position: "absolute" }}>
              <Play size={24} fill="currentColor" />
            </div>
          </div>

          <div className="preview-sidebar-info">
            <h3>{course.title}</h3>
            <div className="preview-sidebar-meta">
              <span className="flex items-center gap-1 font-semibold text-amber-500">
                <Star size={14} fill="#F5A623" stroke="#F5A623" /> 4.8
              </span>
              <span>(12.5k reviews)</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users size={13} /> 50k+ learners
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Preview */}
        <div className="admin-card">
          <div className="preview-tabs">
            <button
              type="button"
              className={`preview-tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              className={`preview-tab-btn ${activeTab === "curriculum" ? "active" : ""}`}
              onClick={() => setActiveTab("curriculum")}
            >
              Curriculum
            </button>
            <button
              type="button"
              className={`preview-tab-btn ${activeTab === "reviews" ? "active" : ""}`}
              onClick={() => setActiveTab("reviews")}
            >
              Reviews
            </button>
            <button
              type="button"
              className={`preview-tab-btn ${activeTab === "instructor" ? "active" : ""}`}
              onClick={() => setActiveTab("instructor")}
            >
              Instructor
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: "#172033", lineHeight: 1.4 }}>
                {metrics.cleanDescription ||
                  `Learn ${course.title} from scratch and build modern web applications with real-world projects.`}
              </h4>

              {/* 4 Stat Tiles */}
              <div className="preview-stat-tiles-grid">
                <div className="preview-stat-tile">
                  <Layers size={18} className="text-blue-600 flex-shrink-0" />
                  <span>{totalModules} Modules</span>
                </div>
                <div className="preview-stat-tile">
                  <PlayCircle size={18} className="text-purple-600 flex-shrink-0" />
                  <span>{totalLessons} Lessons</span>
                </div>
                <div className="preview-stat-tile">
                  <ClipboardCheck size={18} className="text-pink-600 flex-shrink-0" />
                  <span>{totalTests} Tests</span>
                </div>
                <div className="preview-stat-tile">
                  <Award size={18} className="text-emerald-600 flex-shrink-0" />
                  <span>Certificate Included</span>
                </div>
              </div>

              {/* Learning Outcomes */}
              <div style={{ marginTop: 24 }}>
                <h5 style={{ fontSize: 14, fontWeight: 700, color: "#172033", marginBottom: 12 }}>
                  What you&apos;ll learn
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    "Master core principles and fundamental design patterns",
                    "Build hands-on production-ready projects step by step",
                    "Understand test driven workflows and best practices",
                    "Earn a verifiable digital certificate upon completing all modules",
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                      <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CURRICULUM */}
          {activeTab === "curriculum" && (
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#172033", marginBottom: 14 }}>
                Course Content & Lessons
              </h4>

              {modules.length === 0 ? (
                <p className="text-sm text-gray-500">No modules in this course yet.</p>
              ) : (
                <div className="space-y-3">
                  {modules.map((mod, idx) => {
                    const isExpanded = Boolean(expandedModules[mod.module_id] ?? idx === 0);
                    const topics = mod.topics || [];

                    return (
                      <div
                        key={mod.module_id}
                        className="border border-gray-200 rounded-xl overflow-hidden"
                      >
                        <button
                          type="button"
                          className="w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left font-semibold text-sm text-gray-800"
                          onClick={() => toggleModule(mod.module_id)}
                        >
                          <span>
                            Module {idx + 1}: {mod.title}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-gray-500 font-normal">
                            <span>{topics.length} items</span>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </button>

                        {isExpanded && topics.length > 0 && (
                          <div className="p-3 bg-white divide-y divide-gray-100">
                            {topics.map((t) => {
                              const topicType = getTopicType(t);
                              const isQuiz = topicType === "quiz";
                              const isDoc = topicType === "pdf" || topicType === "notes";

                              return (
                                <div
                                  key={t.topic_id}
                                  className="py-2 flex items-center gap-2.5 text-xs text-gray-700"
                                >
                                  {isQuiz ? (
                                    <ClipboardCheck size={14} className="text-pink-500" />
                                  ) : isDoc ? (
                                    <FileText size={14} className="text-sky-500" />
                                  ) : (
                                    <PlayCircle size={14} className="text-purple-500" />
                                  )}
                                  <span className="flex-1">{t.title}</span>
                                  {isQuiz && (
                                    <span className="text-[10px] bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded font-semibold">
                                      Quiz
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REVIEWS */}
          {activeTab === "reviews" && (
            <div>
              <div className="p-4 bg-gray-50 rounded-xl mb-4 flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-gray-900">4.8</span>
                  <span className="text-xs text-gray-500 ml-2">course rating • 12.5k reviews</span>
                </div>
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 italic">
                Learner feedback will automatically appear here once enrolled students complete their course ratings.
              </p>
            </div>
          )}

          {/* TAB 4: INSTRUCTOR */}
          {activeTab === "instructor" && (
            <div className="flex items-start gap-4 p-2">
              <div className="w-14 h-14 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                <UserCheck size={28} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {metrics.instructor || "ExamLMS Faculty"}
                </h4>
                <p style={{ margin: "2px 0 8px", fontSize: 12, color: "#718096" }}>
                  Verified Instructor · ExamLMS Academy
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#4a5568", lineHeight: 1.6 }}>
                  Dedicated subject-matter expert with extensive engineering and curriculum design experience.
                  Courses focus on practical application and industry standard tools.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
