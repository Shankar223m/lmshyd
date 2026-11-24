import { useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Eye,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  PlayCircle,
  FileText,
  ClipboardCheck,
  Check,
  Award,
  Layers,
} from "lucide-react";

import {
  useGetCourseQuery,
  useGetVersionQuery,
  usePublishCourseMutation,
} from "@/modules/catalog/courses/api/coursesApi";
import {
  useCreateModuleMutation,
  useUpdateModuleMutation,
  useDeleteModuleMutation,
  useDeleteTopicMutation,
} from "@/modules/catalog/courses/api/curriculumApi";
import {
  useUpdateAdminCoursePricingMutation,
} from "@/modules/billing/institutional/api/institutionalApi";
import { AddCourseContentModal } from "@/modules/catalog/courses/components/builder/AddCourseContentModal";
import { AdminVideoPreviewModal } from "@/modules/catalog/courses/components/modals/AdminVideoPreviewModal";
import { AdminPdfPreviewModal } from "@/modules/catalog/courses/components/modals/AdminPdfPreviewModal";
import { ChapterTestSetupModal } from "@/modules/catalog/courses/components/modals/ChapterTestSetupModal";
import { ModuleTestSetupModal } from "@/modules/catalog/courses/components/modals/ModuleTestSetupModal";
import { FinalExamSetupModal } from "@/modules/catalog/courses/components/modals/FinalExamSetupModal";
import type { TopicDetail, ModuleDetail } from "@/modules/catalog/courses/curriculumTypes";
import { useNotify } from "@/core/hooks/useNotify";
import { PageLoader } from "@/shared/ui";

type BuilderStep = "info" | "content" | "pricing" | "settings";

export function CourseBuilderPage() {
  const { courseId = "" } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const notify = useNotify();

  const [activeStep, setActiveStep] = useState<BuilderStep>("content");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Add Module State
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState("");

  // Add Content Modal State
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState<string>("");
  const [targetModuleTitle, setTargetModuleTitle] = useState<string>("");

  // Preview Modal States
  const [videoPreviewData, setVideoPreviewData] = useState<{
    mediaId: string | number | null | undefined;
    chapterTitle: string;
    itemTitle?: string;
  } | null>(null);

  const [pdfPreviewData, setPdfPreviewData] = useState<{
    mediaId: string | number | null | undefined;
    chapterTitle: string;
    itemTitle?: string;
  } | null>(null);

  // Assessment & Test Setup Modals
  const [selectedChapterTest, setSelectedChapterTest] = useState<{
    chapter: TopicDetail;
    moduleId: string;
    moduleTitle: string;
  } | null>(null);

  const [selectedModuleTest, setSelectedModuleTest] = useState<ModuleDetail | null>(null);
  const [isFinalExamModalOpen, setIsFinalExamModalOpen] = useState(false);

  // Course Data
  const { data: course, isLoading: isLoadingCourse, refetch: refetchCourse } = useGetCourseQuery(courseId, {
    skip: !courseId,
  });

  const activeVersion = useMemo(() => {
    if (!course?.versions?.length) return null;
    return course.versions.find((v) => v.status === "draft") || course.versions[0];
  }, [course]);

  const versionId = useMemo(() => {
    return activeVersion?.version_id ? String(activeVersion.version_id) : "";
  }, [activeVersion]);

  const {
    data: versionDetail,
    isLoading: isLoadingVersion,
    refetch: refetchVersion,
  } = useGetVersionQuery(
    { courseId, versionId },
    { skip: !courseId || !versionId }
  );

  const effectiveVersionId = useMemo(() => {
    return versionDetail?.version_id ? String(versionDetail.version_id) : versionId;
  }, [versionDetail, versionId]);

  // Pricing State
  const [updatePricing] = useUpdateAdminCoursePricingMutation();
  const [priceInput, setPriceInput] = useState<string>("1999");
  const [institutionalSeatInput, setInstitutionalSeatInput] = useState<string>("499");

  // Mutations
  const [createModule, { isLoading: isCreatingModule }] = useCreateModuleMutation();
  const [updateModule] = useUpdateModuleMutation();
  const [deleteModule] = useDeleteModuleMutation();
  const [deleteTopic] = useDeleteTopicMutation();
  const [publishCourse, { isLoading: isPublishing }] = usePublishCourseMutation();

  const isPublished = course?.versions?.some((v) => v.status === "published");

  // Modules list from active version
  const modules = useMemo(() => {
    return versionDetail?.modules ?? [];
  }, [versionDetail]);

  // Expand first module by default
  useState(() => {
    if (modules.length > 0 && modules[0] && Object.keys(expandedModules).length === 0) {
      setExpandedModules({ [modules[0].module_id]: true });
    }
  });

  const toggleModule = (modId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [modId]: !prev[modId],
    }));
  };

  const handleOpenAddContent = (modId: string, modTitle: string) => {
    setTargetModuleId(modId);
    setTargetModuleTitle(modTitle);
    setContentModalOpen(true);
  };

  const handleCreateModule = async () => {
    if (!newModuleTitle.trim()) {
      notify.error("Please enter a module title.");
      return;
    }
    try {
      await createModule({
        courseId,
        versionId: effectiveVersionId,
        body: { title: newModuleTitle.trim() },
      }).unwrap();
      notify.success(`Module "${newModuleTitle}" created.`);
      setNewModuleTitle("");
      setShowAddModuleModal(false);
      refetchVersion();
    } catch (err: any) {
      notify.error(err?.data?.message || err?.data?.error?.message || err?.data?.detail || "Failed to create module.");
    }
  };

  const handleUpdateModule = async (moduleId: string) => {
    if (!editModuleTitle.trim()) return;
    try {
      await updateModule({
        courseId,
        versionId: effectiveVersionId,
        moduleId: String(moduleId),
        body: { title: editModuleTitle.trim() },
      }).unwrap();
      notify.success("Module title updated.");
      setEditingModuleId(null);
      refetchVersion();
    } catch (err: any) {
      notify.error(err?.data?.message || err?.data?.error?.message || err?.data?.detail || "Failed to update module.");
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!window.confirm("Are you sure you want to delete this module and its lessons?")) return;
    try {
      await deleteModule({
        courseId,
        versionId: effectiveVersionId,
        moduleId: String(moduleId),
      }).unwrap();
      notify.success("Module removed.");
      refetchVersion();
    } catch (err: any) {
      notify.error(err?.data?.message || err?.data?.error?.message || err?.data?.detail || err?.message || "Failed to delete module.");
    }
  };

  const handleDeleteTopic = async (moduleId: string, topicId: string) => {
    if (!window.confirm("Delete this lesson?")) return;
    try {
      await deleteTopic({
        courseId,
        versionId: effectiveVersionId,
        moduleId: String(moduleId),
        topicId: String(topicId),
      }).unwrap();
      notify.success("Lesson removed.");
      refetchVersion();
    } catch (err: any) {
      notify.error(err?.data?.message || err?.data?.error?.message || err?.data?.detail || err?.message || "Failed to delete lesson.");
    }
  };

  const handlePublish = async () => {
    try {
      await publishCourse(courseId).unwrap();
      notify.success("Course published successfully!");
      refetchCourse();
    } catch (err: any) {
      notify.error(
        err?.data?.message || err?.message || "Failed to publish course. Ensure modules and lessons exist."
      );
    }
  };

  // Helper to determine topic type safely
  const getTopicType = (t: any): "quiz" | "pdf" | "video" | "notes" => {
    if (t.topic_test_id) return "quiz";
    const itemType = t.items?.[0]?.item_type;
    if (itemType === "quiz" || itemType === "practice") return "quiz";
    if (itemType === "pdf") return "pdf";
    if (itemType === "notes") return "notes";
    return "video";
  };

  // Stats calculation
  const totalModules = modules.length;
  let totalLessons = 0;
  let totalTests = 0;

  modules.forEach((mod) => {
    if (mod.module_test_id) totalTests += 1;
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
  if (versionDetail?.rule?.final_test_id) {
    totalTests += 1;
  }

  // Calculate completion percentage: requires title, banner, at least 1 module, at least 1 lesson
  let completionPoints = 0;
  if (course?.title) completionPoints += 25;
  if (course?.thumbnail_media_id) completionPoints += 15;
  if (totalModules > 0) completionPoints += 25;
  if (totalLessons > 0) completionPoints += 20;
  if (totalTests > 0 || isPublished) completionPoints += 15;
  const progressPercent = Math.min(100, Math.max(20, completionPoints));

  if (isLoadingCourse || (versionId && isLoadingVersion)) {
    return <PageLoader label="Loading Course Builder..." />;
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
        <span className="current">Course Builder</span>
      </nav>

      {/* Header matching Reference Top-Right Screen */}
      <header className="admin-lms-header">
        <div className="admin-lms-header-titles">
          <h1>
            {course.title}
            <span className={`admin-status-badge ${isPublished ? "published" : "draft"}`}>
              {isPublished ? "Published" : "Draft"}
            </span>
          </h1>
        </div>
        <div className="admin-lms-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => navigate(`/courses/${courseId}/preview`)}
            title="Preview how course looks to learners"
          >
            <Eye size={16} /> Preview
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => {
              notify.success("Draft state is up to date.");
            }}
          >
            Save Draft
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

      {/* 3-Column Course Builder Layout */}
      <div className="course-builder-grid">
        {/* Left Column: Workflow Steps Navigation */}
        <aside className="admin-card" style={{ padding: 14 }}>
          <div className="builder-steps-nav">
            <button
              type="button"
              className={`builder-step-item ${activeStep === "info" ? "active" : "completed"}`}
              onClick={() => setActiveStep("info")}
            >
              <span className="builder-step-number">
                <Check size={13} />
              </span>
              <span>Course info</span>
            </button>

            <button
              type="button"
              className={`builder-step-item ${activeStep === "content" ? "active" : ""}`}
              onClick={() => setActiveStep("content")}
            >
              <span className="builder-step-number">2</span>
              <span>Course Content</span>
            </button>

            <button
              type="button"
              className={`builder-step-item ${activeStep === "pricing" ? "active" : ""}`}
              onClick={() => setActiveStep("pricing")}
            >
              <span className="builder-step-number">3</span>
              <span>Pricing</span>
            </button>

            <button
              type="button"
              className={`builder-step-item ${activeStep === "settings" ? "active" : ""}`}
              onClick={() => setActiveStep("settings")}
            >
              <span className="builder-step-number">4</span>
              <span>Settings</span>
            </button>
          </div>
        </aside>

        {/* Center Column: Course Modules or Active Step View */}
        <main>
          {activeStep === "content" && (
            <div>
              <div className="builder-modules-header">
                <h2>Course Modules</h2>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => setShowAddModuleModal(true)}
                  style={{ height: 34, fontSize: 13 }}
                >
                  <Plus size={16} /> Add Module
                </button>
              </div>

              {/* Add Module inline modal/input */}
              {showAddModuleModal && (
                <div className="admin-card mb-4" style={{ padding: 16 }}>
                  <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>
                    New Module
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="admin-input"
                      value={newModuleTitle}
                      onChange={(e) => setNewModuleTitle(e.target.value)}
                      placeholder="e.g. Module 1: React Basics"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => setShowAddModuleModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      onClick={handleCreateModule}
                      disabled={isCreatingModule}
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}

              {/* Modules list */}
              {modules.length === 0 ? (
                <div className="admin-card text-center py-12">
                  <Layers size={36} className="mx-auto text-gray-300 mb-3" />
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: "#2d3748" }}>
                    No modules added yet
                  </h3>
                  <p style={{ fontSize: 13, color: "#718096", margin: "4px 0 16px" }}>
                    Get started by creating your first module to structure course lessons.
                  </p>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={() => setShowAddModuleModal(true)}
                  >
                    <Plus size={16} /> Add First Module
                  </button>
                </div>
              ) : (
                <div className="builder-module-list">
                  {modules.map((mod, idx) => {
                    const isExpanded = Boolean(expandedModules[mod.module_id]);
                    const topics = mod.topics || [];
                    const lessonCount = topics.filter((t) => getTopicType(t) !== "quiz").length;
                    const testCount = topics.filter((t) => getTopicType(t) === "quiz").length;

                    return (
                      <div key={mod.module_id} className="builder-module-card">
                        <div
                          className="builder-module-head"
                          onClick={() => toggleModule(mod.module_id)}
                        >
                          <span className="builder-drag-handle">
                            <GripVertical size={18} />
                          </span>

                          <div className="builder-module-title-wrap">
                            {editingModuleId === mod.module_id ? (
                              <div
                                className="flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  className="admin-input"
                                  value={editModuleTitle}
                                  onChange={(e) => setEditModuleTitle(e.target.value)}
                                  style={{ height: 32, fontSize: 13 }}
                                />
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-primary"
                                  style={{ height: 30, padding: "0 10px", fontSize: 11 }}
                                  onClick={() => handleUpdateModule(mod.module_id)}
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="builder-module-title">
                                  Module {idx + 1}: {mod.title}
                                </span>
                                <span className="builder-module-meta">
                                  {lessonCount} lessons • {testCount} {testCount === 1 ? "test" : "tests"}
                                </span>
                              </>
                            )}
                          </div>

                          <div
                            className="builder-module-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="builder-icon-btn"
                              title="Edit module name"
                              onClick={() => {
                                setEditingModuleId(mod.module_id);
                                setEditModuleTitle(mod.title);
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="builder-icon-btn danger"
                              title="Delete module"
                              onClick={() => handleDeleteModule(mod.module_id)}
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="builder-icon-btn"
                              onClick={() => toggleModule(mod.module_id)}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Module Body */}
                        {isExpanded && (
                          <div className="builder-module-body">
                            {topics.length > 0 && (
                              <div className="builder-lessons-list">
                                {topics.map((t) => {
                                  const topicType = getTopicType(t);
                                  const isQuiz = topicType === "quiz";
                                  const isDoc = topicType === "pdf" || topicType === "notes";
                                  const iconType = isQuiz ? "quiz" : isDoc ? "document" : "video";

                                  return (
                                    <div key={t.topic_id} className="builder-lesson-row">
                                      <div className={`builder-lesson-icon ${iconType}`}>
                                        {isQuiz ? (
                                          <ClipboardCheck size={14} />
                                        ) : isDoc ? (
                                          <FileText size={14} />
                                        ) : (
                                          <PlayCircle size={14} />
                                        )}
                                      </div>
                                      <span
                                        className="builder-lesson-title"
                                        style={{ cursor: "pointer" }}
                                        title={
                                          isQuiz
                                            ? "Click to configure test questions"
                                            : isDoc
                                              ? "Click to preview document"
                                              : "Click to preview video"
                                        }
                                        onClick={() => {
                                          if (isQuiz) {
                                            setSelectedChapterTest({
                                              chapter: t,
                                              moduleId: mod.module_id,
                                              moduleTitle: mod.title,
                                            });
                                          } else if (isDoc) {
                                            setPdfPreviewData({
                                              mediaId: t.items?.[0]?.media_id,
                                              chapterTitle: t.title,
                                              itemTitle: t.items?.[0]?.title,
                                            });
                                          } else {
                                            setVideoPreviewData({
                                              mediaId: t.items?.[0]?.media_id,
                                              chapterTitle: t.title,
                                              itemTitle: t.items?.[0]?.title,
                                            });
                                          }
                                        }}
                                      >
                                        {t.title}
                                      </span>
                                      {isQuiz ? (
                                        <span className="builder-lesson-badge">Chapter Quiz</span>
                                      ) : t.topic_test_id ? (
                                        <span className="builder-lesson-badge bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          Quiz Linked
                                        </span>
                                      ) : null}

                                      <div className="flex items-center gap-1">
                                        {isQuiz ? (
                                          <button
                                            type="button"
                                            className="builder-icon-btn"
                                            onClick={() =>
                                              setSelectedChapterTest({
                                                chapter: t,
                                                moduleId: mod.module_id,
                                                moduleTitle: mod.title,
                                              })
                                            }
                                            title="Configure Questions (AI / Excel / Manual)"
                                          >
                                            <Edit2 size={13} />
                                          </button>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              className="builder-icon-btn text-indigo-600 hover:bg-indigo-50"
                                              onClick={() =>
                                                setSelectedChapterTest({
                                                  chapter: t,
                                                  moduleId: mod.module_id,
                                                  moduleTitle: mod.title,
                                                })
                                              }
                                              title={t.topic_test_id ? "Configure Chapter Quiz" : "+ Add Chapter Quiz"}
                                            >
                                              <ClipboardCheck size={13} />
                                            </button>
                                            <button
                                              type="button"
                                              className="builder-icon-btn"
                                              onClick={() => {
                                                if (isDoc) {
                                                  setPdfPreviewData({
                                                    mediaId: t.items?.[0]?.media_id,
                                                    chapterTitle: t.title,
                                                    itemTitle: t.items?.[0]?.title,
                                                  });
                                                } else {
                                                  setVideoPreviewData({
                                                    mediaId: t.items?.[0]?.media_id,
                                                    chapterTitle: t.title,
                                                    itemTitle: t.items?.[0]?.title,
                                                  });
                                                }
                                              }}
                                              title={isDoc ? "Preview Document" : "Preview Video"}
                                            >
                                              <Eye size={13} />
                                            </button>
                                          </>
                                        )}

                                        <button
                                          type="button"
                                          className="builder-icon-btn danger"
                                          onClick={() => handleDeleteTopic(mod.module_id, t.topic_id)}
                                          title="Delete lesson"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Dedicated Module-level Test / Quiz */}
                            <div className="mt-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                  <ClipboardCheck size={16} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-900">
                                      Module Quiz: {mod.title}
                                    </span>
                                    {mod.module_test_id ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                        Configured
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                                        Pending Setup
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="admin-btn admin-btn-primary !h-7 !text-xs !px-3 bg-[#635BFF] hover:bg-[#5248e5]"
                                onClick={() => setSelectedModuleTest(mod)}
                              >
                                {mod.module_test_id ? "Edit Module Quiz" : "+ Setup Module Quiz"}
                              </button>
                            </div>

                            <div className="mt-2.5">
                              <button
                                type="button"
                                className="admin-btn admin-btn-outline"
                                style={{ width: "100%", height: 36, fontSize: 12, borderStyle: "dashed" }}
                                onClick={() => handleOpenAddContent(mod.module_id, mod.title)}
                              >
                                <Plus size={14} /> Add Content (Video / PDF / Chapter Quiz)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* FINAL CERTIFICATION EXAM CARD */}
              <div className="mt-6 rounded-2xl border border-indigo-200/90 bg-linear-to-r from-indigo-50/60 via-white to-purple-50/40 p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#635BFF] text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
                      <Award size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 m-0">
                          Final Certification Exam
                        </h3>
                        {versionDetail?.rule?.final_test_id ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                            <Check size={12} /> Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                            Pending Setup
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-600 font-medium">
                        <span>
                          Passing Mark:{" "}
                          <strong className="text-slate-900">
                            {versionDetail?.rule?.final_pass_mark ?? 70}%
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Max Attempts:{" "}
                          <strong className="text-slate-900">
                            {versionDetail?.rule?.final_test_attempts ?? 3}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Cooldown:{" "}
                          <strong className="text-slate-900">
                            {versionDetail?.rule?.final_test_cooldown_days ?? 1} day
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {versionDetail?.rule?.final_test_id && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        onClick={() => navigate(`/courses/${courseId}/final-exam`)}
                        style={{ height: 36, fontSize: 13 }}
                      >
                        <Eye size={14} /> Preview Exam
                      </button>
                    )}
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      onClick={() => setIsFinalExamModalOpen(true)}
                      style={{ height: 36, fontSize: 13, backgroundColor: "#635BFF" }}
                    >
                      <Award size={14} />{" "}
                      {versionDetail?.rule?.final_test_id ? "Edit Final Exam" : "Configure Final Exam"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP: COURSE INFO */}
          {activeStep === "info" && (
            <div className="admin-card">
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Course Information</h3>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => setActiveStep("content")}
                  style={{ height: 32, fontSize: 12 }}
                >
                  Continue to Content
                </button>
              </div>
              <p style={{ fontSize: 13, color: "#718096", marginBottom: 16 }}>
                Review and update your core course metadata.
              </p>
              <div className="admin-form-group">
                <label className="admin-form-label">Course Title</label>
                <input type="text" className="admin-input" defaultValue={course.title} readOnly />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Summary / Description</label>
                <textarea
                  className="admin-textarea"
                  defaultValue={course.summary}
                  readOnly
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* STEP: PRICING */}
          {activeStep === "pricing" && (
            <div className="admin-card">
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>
                Course Pricing & Licensing
              </h3>
              <p style={{ fontSize: 13, color: "#718096", marginBottom: 20 }}>
                Configure individual retail pricing and institutional seat packages.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="admin-form-label">Individual Learner Price (INR)</label>
                  <div className="admin-price-input-wrap">
                    <span className="admin-price-prefix">₹</span>
                    <input
                      type="number"
                      className="admin-input"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      placeholder="1999"
                    />
                  </div>
                  <small style={{ fontSize: 11, color: "#718096", marginTop: 4, display: "block" }}>
                    Price charged for individual student enrollment in store.
                  </small>
                </div>

                <div>
                  <label className="admin-form-label">Institutional Seat Price (INR)</label>
                  <div className="admin-price-input-wrap">
                    <span className="admin-price-prefix">₹</span>
                    <input
                      type="number"
                      className="admin-input"
                      value={institutionalSeatInput}
                      onChange={(e) => setInstitutionalSeatInput(e.target.value)}
                      placeholder="499"
                    />
                  </div>
                  <small style={{ fontSize: 11, color: "#718096", marginTop: 4, display: "block" }}>
                    Per-student license price for corporate and university batches.
                  </small>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={async () => {
                    const pricePaise = (Number(priceInput) || 0) * 100;
                    try {
                      await updatePricing({
                        course_id: courseId,
                        course_title: course.title,
                        individual_price_paise: pricePaise,
                        institutional_price_per_seat_paise: (Number(institutionalSeatInput) || 0) * 100,
                        fixed_price_paise: pricePaise,
                        reason: "Course builder pricing update",
                      }).unwrap();
                      notify.success("Pricing updated successfully.");
                    } catch {
                      notify.error("Failed to update pricing.");
                    }
                  }}
                >
                  Save Pricing
                </button>
              </div>
            </div>
          )}

          {/* STEP: SETTINGS */}
          {activeStep === "settings" && (
            <div className="admin-card">
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Course Settings</h3>
              <p style={{ fontSize: 13, color: "#718096", marginBottom: 20 }}>
                Manage completion certificates and assessment requirements.
              </p>

              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Award size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                      Certificate Template
                    </h4>
                    <p style={{ margin: 0, fontSize: 12, color: "#718096" }}>
                      Choose or customize the certificate awarded upon completion.
                    </p>
                  </div>
                </div>
                <Link
                  to="/certificates/templates"
                  className="admin-btn admin-btn-outline"
                  style={{ height: 32, fontSize: 12 }}
                >
                  Customize Template
                </Link>
              </div>
            </div>
          )}
        </main>

        {/* Right Column: Course Progress & Stats matching Reference */}
        <aside className="builder-stats-sidebar">
          {/* Card 1: Course Progress */}
          <div className="admin-card builder-progress-card">
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px", color: "#172033" }}>
              Course Progress
            </h3>

            <div className="builder-progress-ring-wrap">
              <svg width="110" height="110" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#EDF2F7"
                  strokeWidth="10"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#00C49F"
                  strokeWidth="10"
                  strokeDasharray={`${(progressPercent / 100) * 314} 314`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span className="builder-progress-percentage">{progressPercent}%</span>
              </div>
            </div>

            <span className="builder-progress-label">Content Completed</span>
          </div>

          {/* Card 2: Course Stats */}
          <div className="admin-card">
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 14px", color: "#172033" }}>
              Course Stats
            </h3>

            <div className="builder-stats-list">
              <div className="builder-stat-item">
                <div className="builder-stat-icon modules">
                  <Layers size={16} />
                </div>
                <span style={{ fontWeight: 600 }}>{totalModules} Modules</span>
              </div>

              <div className="builder-stat-item">
                <div className="builder-stat-icon lessons">
                  <PlayCircle size={16} />
                </div>
                <span style={{ fontWeight: 600 }}>{totalLessons} Lessons</span>
              </div>

              <div className="builder-stat-item">
                <div className="builder-stat-icon tests">
                  <ClipboardCheck size={16} />
                </div>
                <span style={{ fontWeight: 600 }}>{totalTests} Tests</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Screen 3: Add Course Content Modal */}
      {contentModalOpen && (
        <AddCourseContentModal
          isOpen={contentModalOpen}
          onClose={() => setContentModalOpen(false)}
          courseId={courseId}
          versionId={versionId}
          moduleId={targetModuleId}
          moduleTitle={targetModuleTitle}
          onSuccess={() => refetchVersion()}
          onOpenQuizSetup={async (topicId) => {
            await refetchVersion();
            const mod = modules.find((m) => m.module_id === targetModuleId);
            const foundTopic = mod?.topics?.find((t) => t.topic_id === topicId) || {
              topic_id: topicId,
              title: "Quiz",
              position: 1,
              pass_mark: 60,
              topic_test_id: null,
              items: [],
            };
            setSelectedChapterTest({
              chapter: foundTopic as any,
              moduleId: targetModuleId,
              moduleTitle: targetModuleTitle,
            });
          }}
        />
      )}

      {/* Video Preview Modal */}
      {videoPreviewData && (
        <AdminVideoPreviewModal
          isOpen={Boolean(videoPreviewData)}
          onClose={() => setVideoPreviewData(null)}
          chapterTitle={videoPreviewData.chapterTitle}
          itemTitle={videoPreviewData.itemTitle}
          mediaId={videoPreviewData.mediaId}
        />
      )}

      {/* PDF Document Preview Modal */}
      {pdfPreviewData && (
        <AdminPdfPreviewModal
          isOpen={Boolean(pdfPreviewData)}
          onClose={() => setPdfPreviewData(null)}
          chapterTitle={pdfPreviewData.chapterTitle}
          itemTitle={pdfPreviewData.itemTitle}
          mediaId={pdfPreviewData.mediaId}
        />
      )}

      {/* Chapter Test / Quiz Setup Modal */}
      {selectedChapterTest && (
        <ChapterTestSetupModal
          isOpen={Boolean(selectedChapterTest)}
          onClose={() => setSelectedChapterTest(null)}
          chapter={selectedChapterTest.chapter}
          moduleTitle={selectedChapterTest.moduleTitle}
          courseId={courseId}
          versionId={versionId}
          moduleId={selectedChapterTest.moduleId}
          onSaved={() => refetchVersion()}
        />
      )}

      {/* Module Test Setup Modal */}
      {selectedModuleTest && (
        <ModuleTestSetupModal
          isOpen={Boolean(selectedModuleTest)}
          onClose={() => setSelectedModuleTest(null)}
          module={selectedModuleTest}
          courseId={courseId}
          versionId={versionId}
          onSaved={() => refetchVersion()}
        />
      )}

      {/* Final Certification Exam Setup Modal */}
      {isFinalExamModalOpen && (
        <FinalExamSetupModal
          isOpen={isFinalExamModalOpen}
          onClose={() => setIsFinalExamModalOpen(false)}
          courseTitle={course?.title || "Course"}
          courseId={courseId}
          versionId={versionId}
          rule={versionDetail?.rule}
          onSaved={() => refetchVersion()}
        />
      )}
    </div>
  );
}
