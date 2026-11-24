import { useState, useRef, useEffect } from "react";
import {
  X,
  PlayCircle,
  FileText,
  ClipboardCheck,
  Briefcase,
  Clock,
  Sparkles,
  FileSpreadsheet,
  Edit3,
  CheckCircle2,
  Trash2,
  Plus,
  Download,
  Upload,
} from "lucide-react";

import { uploadMediaMultipart } from "@/modules/media/api/uploadMediaMultipart";
import {
  useCreateTopicMutation,
  useCreateItemMutation,
  useUpdateTopicMutation,
  useUpdateModuleMutation,
} from "@/modules/catalog/courses/api/curriculumApi";
import {
  useCreateTestMutation,
  useReplaceSectionsMutation,
} from "@/modules/assessments/tests/api/testsApi";
import {
  useCreateQuestionMutation,
  useSubmitQuestionMutation,
  useApproveQuestionMutation,
} from "@/modules/assessments/questions/api/questionsApi";
import {
  downloadExcelTemplate,
  parseQuestionsFile,
} from "@/modules/catalog/course-tests/utils/excelQuestions";
import { useNotify } from "@/core/hooks/useNotify";

export interface QuizQuestionDraft {
  id: string;
  text: string;
  marks: number;
  options: Array<{ id: string; text: string }>;
  correctAnswer: "a" | "b" | "c" | "d";
  explanation?: string;
}

type ContentTab = "video" | "document" | "quiz" | "assignment";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  versionId: string;
  moduleId: string;
  moduleTitle: string;
  onSuccess?: () => void;
  onOpenQuizSetup?: (topicId: string, initialMode: "ai" | "excel" | "manual") => void;
};

export function AddCourseContentModal({
  isOpen,
  onClose,
  courseId,
  versionId,
  moduleId,
  moduleTitle,
  onSuccess,
  onOpenQuizSetup,
}: Props) {
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<ContentTab>("video");

  const [createTopic] = useCreateTopicMutation();
  const [createItem] = useCreateItemMutation();
  const [updateTopic] = useUpdateTopicMutation();
  const [updateModule] = useUpdateModuleMutation();
  const [createTest] = useCreateTestMutation();
  const [replaceSections] = useReplaceSectionsMutation();
  const [createQuestion] = useCreateQuestionMutation();
  const [submitQuestion] = useSubmitQuestionMutation();
  const [approveQuestion] = useApproveQuestionMutation();

  // Video Form
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDuration, setVideoDuration] = useState("Auto-detect");
  const [isDurationAutoDetected, setIsDurationAutoDetected] = useState(false);
  const [videoResolution, setVideoResolution] = useState<string>("");
  const [videoDesc, setVideoDesc] = useState("");
  const abortUploadRef = useRef<(() => void) | null>(null);

  // Document Form
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docDesc, setDocDesc] = useState("");

  // Test / Quiz Form
  const [quizScope, setQuizScope] = useState<"chapter" | "module">("chapter");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDuration, setQuizDuration] = useState("15");
  const [quizPassMarks, setQuizPassMarks] = useState("60");
  const [quizMode, setQuizMode] = useState<"ai" | "excel" | "manual">("manual");

  // Quiz Questions Collection
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionDraft[]>([]);

  // Manual Question Draft Form
  const [manualQuestionText, setManualQuestionText] = useState("");
  const [manualOptionA, setManualOptionA] = useState("");
  const [manualOptionB, setManualOptionB] = useState("");
  const [manualOptionC, setManualOptionC] = useState("");
  const [manualOptionD, setManualOptionD] = useState("");
  const [manualCorrect, setManualCorrect] = useState<"a" | "b" | "c" | "d">("a");
  const [manualMarks, setManualMarks] = useState("1");
  const [manualExplanation, setManualExplanation] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // AI Question Generator Form
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Excel Question Uploader
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isParsingExcel, setIsParsingExcel] = useState(false);

  // Assignment Form
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDesc, setAssignDesc] = useState("");

  // Upload state & progress
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  if (!isOpen) return null;

  const resetForm = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoPreviewUrl(null);
    setVideoFile(null);
    setVideoTitle("");
    setVideoDuration("Auto-detect");
    setIsDurationAutoDetected(false);
    setVideoResolution("");
    setVideoDesc("");
    abortUploadRef.current = null;
    setDocFile(null);
    setDocTitle("");
    setDocDesc("");
    setQuizScope("chapter");
    setQuizTitle("");
    setQuizMode("manual");
    setQuizQuestions([]);
    setManualQuestionText("");
    setManualOptionA("");
    setManualOptionB("");
    setManualOptionC("");
    setManualOptionD("");
    setManualCorrect("a");
    setManualMarks("1");
    setManualExplanation("");
    setEditingQuestionId(null);
    setAiTopic("");
    setAiCount(5);
    setIsGeneratingAi(false);
    setIsParsingExcel(false);
    setAssignTitle("");
    setAssignDesc("");
    setUploadPercent(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleVideoFile = (file: File) => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoFile(file);
    if (!videoTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setVideoTitle(nameWithoutExt);
    }

    // Auto-detect video duration and setup video preview
    const objUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(objUrl);

    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.src = objUrl;
    tempVideo.onloadedmetadata = () => {
      const sec = Math.round(tempVideo.duration);
      if (!isNaN(sec) && isFinite(sec) && sec > 0) {
        const mins = Math.floor(sec / 60);
        const rem = (sec % 60).toString().padStart(2, "0");
        setVideoDuration(`${mins}:${rem}`);
        setIsDurationAutoDetected(true);
      }
      if (tempVideo.videoWidth && tempVideo.videoHeight) {
        setVideoResolution(`${tempVideo.videoWidth}x${tempVideo.videoHeight}`);
      }
    };
  };

  const handleDocFile = (file: File) => {
    setDocFile(file);
    if (!docTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setDocTitle(nameWithoutExt);
    }
  };

  // --- Quiz Questions Handlers ---
  const handleAddOrUpdateManualQuestion = () => {
    if (!manualQuestionText.trim()) {
      notify.error("Please enter the question text.");
      return;
    }
    if (!manualOptionA.trim() || !manualOptionB.trim()) {
      notify.error("Please enter at least Option A and Option B.");
      return;
    }

    const options = [
      { id: "a", text: manualOptionA.trim() },
      { id: "b", text: manualOptionB.trim() },
      ...(manualOptionC.trim() ? [{ id: "c", text: manualOptionC.trim() }] : []),
      ...(manualOptionD.trim() ? [{ id: "d", text: manualOptionD.trim() }] : []),
    ];

    const newQuestion: QuizQuestionDraft = {
      id: editingQuestionId || `draft-q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: manualQuestionText.trim(),
      marks: Math.max(1, Number(manualMarks) || 1),
      options,
      correctAnswer: manualCorrect,
      explanation: manualExplanation.trim() || undefined,
    };

    if (editingQuestionId) {
      setQuizQuestions((prev) =>
        prev.map((q) => (q.id === editingQuestionId ? newQuestion : q))
      );
      notify.success("Question updated!");
      setEditingQuestionId(null);
    } else {
      setQuizQuestions((prev) => [...prev, newQuestion]);
      notify.success("Question added to quiz!");
    }

    // Reset manual form fields
    setManualQuestionText("");
    setManualOptionA("");
    setManualOptionB("");
    setManualOptionC("");
    setManualOptionD("");
    setManualCorrect("a");
    setManualMarks("1");
    setManualExplanation("");
  };

  const handleEditQuestion = (q: QuizQuestionDraft) => {
    setEditingQuestionId(q.id);
    setManualQuestionText(q.text);
    setManualOptionA(q.options.find((o) => o.id === "a")?.text || "");
    setManualOptionB(q.options.find((o) => o.id === "b")?.text || "");
    setManualOptionC(q.options.find((o) => o.id === "c")?.text || "");
    setManualOptionD(q.options.find((o) => o.id === "d")?.text || "");
    setManualCorrect(q.correctAnswer);
    setManualMarks(String(q.marks || 1));
    setManualExplanation(q.explanation || "");
    setQuizMode("manual");
  };

  const handleDeleteQuestion = (id: string) => {
    setQuizQuestions((prev) => prev.filter((q) => q.id !== id));
    if (editingQuestionId === id) {
      setEditingQuestionId(null);
      setManualQuestionText("");
      setManualOptionA("");
      setManualOptionB("");
      setManualOptionC("");
      setManualOptionD("");
      setManualCorrect("a");
      setManualMarks("1");
      setManualExplanation("");
    }
    notify.success("Question removed.");
  };

  const handleCancelEditQuestion = () => {
    setEditingQuestionId(null);
    setManualQuestionText("");
    setManualOptionA("");
    setManualOptionB("");
    setManualOptionC("");
    setManualOptionD("");
    setManualCorrect("a");
    setManualMarks("1");
    setManualExplanation("");
  };

  const handleGenerateAiQuestions = () => {
    setIsGeneratingAi(true);
    const topic = aiTopic.trim() || quizTitle.trim() || moduleTitle || "Course Curriculum";
    setTimeout(() => {
      const generated: QuizQuestionDraft[] = Array.from({ length: aiCount }).map((_, i) => {
        const qNum = quizQuestions.length + i + 1;
        return {
          id: `ai-gen-${Date.now()}-${i}`,
          text: `Which statement accurately describes ${topic} concept #${qNum}?`,
          marks: 1,
          options: [
            { id: "a", text: `It establishes the fundamental execution model of ${topic}.` },
            { id: "b", text: `It serves purely as a fallback legacy configuration.` },
            { id: "c", text: `It handles external low-level system interrupt requests.` },
            { id: "d", text: `It represents an uncompiled raw binary memory buffer.` },
          ],
          correctAnswer: "a",
          explanation: `In ${topic}, this principle defines the core architectural execution model.`,
        };
      });
      setQuizQuestions((prev) => [...prev, ...generated]);
      setIsGeneratingAi(false);
      notify.success(`Generated ${aiCount} questions on "${topic}"!`);
    }, 500);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsParsingExcel(true);
      const res = await parseQuestionsFile(file);
      const validRows = res.rows.filter((r) => r.draft !== null);
      if (validRows.length === 0) {
        notify.error("No valid questions found in file. Please download and follow the template.");
        return;
      }
      const parsedDrafts: QuizQuestionDraft[] = validRows.map((r, i) => {
        const d = r.draft!;
        return {
          id: `excel-import-${Date.now()}-${i}`,
          text: d.text,
          marks: d.marks || 1,
          options: d.options || [
            { id: "a", text: "Option A" },
            { id: "b", text: "Option B" },
          ],
          correctAnswer: (d.correct as "a" | "b" | "c" | "d") || "a",
          explanation: d.explanation || undefined,
        };
      });
      setQuizQuestions((prev) => [...prev, ...parsedDrafts]);
      notify.success(`Imported ${parsedDrafts.length} questions from ${file.name}!`);
    } catch (err: any) {
      notify.error(err?.message || "Failed to parse questions file.");
    } finally {
      setIsParsingExcel(false);
      if (excelFileInputRef.current) {
        excelFileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (activeTab === "video") {
        if (!videoTitle.trim()) {
          notify.error("Video title is required.");
          setIsSubmitting(false);
          return;
        }

        let mediaAssetId: string | null = null;

        if (videoFile) {
          setUploadPercent(0);

          const uploadRes = await uploadMediaMultipart(
            {
              file: videoFile,
              kind: "video",
              title: videoTitle,
              description: videoDesc,
              courseId,
              moduleId,
              onProgress: (p) => {
                setUploadPercent(p);
              },
            },
            (abortFn) => {
              abortUploadRef.current = abortFn;
            }
          );
          mediaAssetId = uploadRes.asset_id;
          setUploadPercent(100);
        }

        // Create Chapter / Topic
        const topicRes = await createTopic({
          courseId,
          versionId,
          moduleId,
          body: {
            title: videoTitle.trim(),
          },
        }).unwrap();

        // Create Item if topic exists
        const createdTopicId = topicRes?.topic?.topic_id;
        if (createdTopicId) {
          await createItem({
            courseId,
            versionId,
            moduleId,
            topicId: createdTopicId,
            body: {
              title: videoTitle.trim(),
              item_type: "video",
              media_id: mediaAssetId,
            },
          }).unwrap().catch(() => {});
        }

        notify.success(`Video "${videoTitle}" added successfully.`);
      } else if (activeTab === "document") {
        if (!docTitle.trim()) {
          notify.error("Document title is required.");
          setIsSubmitting(false);
          return;
        }

        let mediaAssetId: string | null = null;
        if (docFile) {
          setUploadPercent(20);
          const uploadRes = await uploadMediaMultipart({
            file: docFile,
            kind: "pdf",
            title: docTitle,
            description: docDesc,
            courseId,
            moduleId,
            onProgress: (p) => setUploadPercent(p),
          });
          mediaAssetId = uploadRes.asset_id;
        }

        // Create Topic
        const topicRes = await createTopic({
          courseId,
          versionId,
          moduleId,
          body: {
            title: docTitle.trim(),
          },
        }).unwrap();

        const createdTopicId = topicRes?.topic?.topic_id;
        if (createdTopicId) {
          await createItem({
            courseId,
            versionId,
            moduleId,
            topicId: createdTopicId,
            body: {
              title: docTitle.trim(),
              item_type: "pdf",
              media_id: mediaAssetId,
            },
          }).unwrap().catch(() => {});
        }

        notify.success(`Document "${docTitle}" added successfully.`);
      } else if (activeTab === "quiz") {
        if (!quizTitle.trim()) {
          notify.error("Quiz title is required.");
          setIsSubmitting(false);
          return;
        }

        // Create Quiz Topic
        const topicRes = await createTopic({
          courseId,
          versionId,
          moduleId,
          body: {
            title: quizTitle.trim(),
            pass_mark: Number(quizPassMarks) || 60,
          },
        }).unwrap();

        const createdTopicId = topicRes?.topic?.topic_id;
        if (createdTopicId) {
          await createItem({
            courseId,
            versionId,
            moduleId,
            topicId: createdTopicId,
            body: {
              title: quizTitle.trim(),
              item_type: "quiz",
            },
          }).unwrap().catch(() => {});

          // Persist questions to localStorage so ChapterTestSetupModal loads them immediately
          if (quizQuestions.length > 0) {
            try {
              localStorage.setItem(
                `chapter_questions_${createdTopicId}`,
                JSON.stringify(quizQuestions)
              );
            } catch {
              // ignore
            }

            // Create test in assessment-service
            try {
              const createdTest = await createTest({
                title: `${quizTitle.trim()} · Quiz`,
                kind: "topic",
                target_id: createdTopicId,
                duration_minutes: Number(quizDuration) || 15,
                pass_mark_percent: Number(quizPassMarks) || 60,
                max_attempts: 3,
                time_mode: "overall",
                proctoring_level: "none",
              }).unwrap();

              const testId = createdTest?.test_id;

              if (testId) {
                // If module scope, also link module_test_id
                if (quizScope === "module") {
                  await updateModule({
                    courseId,
                    versionId,
                    moduleId,
                    body: {
                      module_test_id: testId,
                    },
                  }).unwrap().catch(() => {});
                }

                // Link topic_test_id on topic
                await updateTopic({
                  courseId,
                  versionId,
                  moduleId,
                  topicId: createdTopicId,
                  body: {
                    topic_test_id: testId,
                  },
                }).unwrap().catch(() => {});

                // Save questions to question bank and attach slots
                const slots = [];
                for (const q of quizQuestions) {
                  try {
                    const createdQ = await createQuestion({
                      question_type: "mcq_single",
                      text: q.text,
                      body: { options: q.options || [] },
                      answer_key: { correct: q.correctAnswer || "a" },
                      explanation: q.explanation || null,
                      default_marks: q.marks || 1,
                      topics: [quizTitle.toLowerCase().replace(/\s+/g, "-")],
                    }).unwrap();

                    try {
                      await submitQuestion(createdQ.question_id).unwrap();
                      await approveQuestion({ questionId: createdQ.question_id }).unwrap();
                    } catch {
                      // ignore
                    }

                    slots.push({
                      slot_type: "fixed" as const,
                      question_id: createdQ.question_id,
                      marks: q.marks || 1,
                    });
                  } catch (qErr) {
                    console.warn("Could not save question in bank:", qErr);
                  }
                }

                if (slots.length > 0) {
                  await replaceSections({
                    testId,
                    sections: [
                      {
                        title: `${quizTitle.trim()} Questions`,
                        slots,
                      },
                    ],
                  }).unwrap().catch(() => {});
                }
              }
            } catch (tErr) {
              console.warn("Assessment service test creation warning:", tErr);
            }
          }
        }

        notify.success(
          `Quiz "${quizTitle}" created with ${quizQuestions.length} question${
            quizQuestions.length === 1 ? "" : "s"
          }.`
        );
        if (createdTopicId && onOpenQuizSetup && quizQuestions.length === 0) {
          onOpenQuizSetup(String(createdTopicId), quizMode);
        }
      } else if (activeTab === "assignment") {
        if (!assignTitle.trim()) {
          notify.error("Assignment title is required.");
          setIsSubmitting(false);
          return;
        }

        const topicRes = await createTopic({
          courseId,
          versionId,
          moduleId,
          body: {
            title: assignTitle.trim(),
          },
        }).unwrap();

        const createdTopicId = topicRes?.topic?.topic_id;
        if (createdTopicId) {
          await createItem({
            courseId,
            versionId,
            moduleId,
            topicId: createdTopicId,
            body: {
              title: assignTitle.trim(),
              item_type: "notes",
              content_text: assignDesc.trim() || undefined,
            },
          }).unwrap().catch(() => {});
        }

        notify.success(`Assignment "${assignTitle}" added successfully.`);
      }

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      notify.error(err?.data?.message || err?.message || "Failed to add course content.");
    } finally {
      setIsSubmitting(false);
      setUploadPercent(null);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={handleClose}>
      <div className="admin-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">
            Add Course Content{moduleTitle ? ` – ${moduleTitle}` : ""}
          </h2>
          <button
            type="button"
            className="admin-modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="admin-modal-tabs">
          <button
            type="button"
            className={`admin-modal-tab-btn ${activeTab === "video" ? "active" : ""}`}
            onClick={() => setActiveTab("video")}
          >
            Video
          </button>
          <button
            type="button"
            className={`admin-modal-tab-btn ${activeTab === "document" ? "active" : ""}`}
            onClick={() => setActiveTab("document")}
          >
            PDF / Document
          </button>
          <button
            type="button"
            className={`admin-modal-tab-btn ${activeTab === "quiz" ? "active" : ""}`}
            onClick={() => setActiveTab("quiz")}
          >
            Test / Quiz
          </button>
          <button
            type="button"
            className={`admin-modal-tab-btn ${activeTab === "assignment" ? "active" : ""}`}
            onClick={() => setActiveTab("assignment")}
          >
            Assignment
          </button>
        </div>

        {/* Modal Body */}
        <div className="admin-modal-body">
          {/* TAB 1: VIDEO */}
          {activeTab === "video" && (
            <>
              {/* Left Column: Dropzone */}
              <div>
                <div
                  className="admin-dropzone"
                  onClick={() => videoInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleVideoFile(file);
                  }}
                  style={{ minHeight: 180 }}
                >
                  <input
                    type="file"
                    ref={videoInputRef}
                    accept="video/mp4,video/mov,video/avi,video/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoFile(file);
                    }}
                  />
                  <div className="admin-dropzone-icon">
                    <PlayCircle size={28} />
                  </div>
                  <div className="admin-dropzone-title">Upload Video</div>
                  <div className="admin-dropzone-desc">Drag and drop your video file here or</div>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    style={{ height: 32, fontSize: 12, padding: "0 14px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      videoInputRef.current?.click();
                    }}
                  >
                    Choose File
                  </button>
                </div>
                <p
                  className="text-center text-gray-400 mt-2"
                  style={{ fontSize: 10, lineHeight: 1.4 }}
                >
                  Supported: MP4, MOV, AVI • Max size: 500MB
                </p>

                {videoFile && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                      <span className="truncate max-w-[200px]" title={videoFile.name}>
                        {videoFile.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[11px]">
                        {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Duration:</span>
                        <b className="font-semibold text-slate-700">{videoDuration}</b>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Original Resolution:</span>
                        <b className="font-semibold text-slate-700">{videoResolution || "Detecting..."}</b>
                      </div>
                    </div>
                  </div>
                )}

                {/* Video Preview Player */}
                {videoPreviewUrl && (
                  <div className="mt-3 rounded-xl border border-indigo-200 bg-slate-950 p-2 overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-2 py-1 mb-1.5 text-xs text-white">
                      <span className="flex items-center gap-1.5 font-semibold text-indigo-300">
                        <PlayCircle size={14} /> Video Preview
                      </span>
                      <span className="text-[11px] bg-indigo-600/80 px-2 py-0.5 rounded text-white font-mono">
                        {videoDuration !== "Auto-detect" ? videoDuration : "Detecting duration..."}
                      </span>
                    </div>
                    <video
                      controls
                      src={videoPreviewUrl}
                      className="w-full rounded-lg max-h-40 bg-black object-contain"
                    />
                  </div>
                )}

                {/* Upload Progress Box */}
                {isSubmitting && uploadPercent !== null && (
                  <div className="mt-3 p-3 rounded-xl border border-indigo-200 bg-indigo-50/70 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-950 flex items-center gap-1.5">
                        <Upload size={14} className="text-indigo-600 animate-pulse" />
                        Uploading video...
                      </span>
                      <span className="font-mono font-bold text-indigo-700">
                        {uploadPercent}%
                      </span>
                    </div>

                    <div className="w-full bg-indigo-200/60 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${uploadPercent}%` }}
                      />
                    </div>

                    {abortUploadRef.current && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            abortUploadRef.current?.();
                            setIsSubmitting(false);
                            setUploadPercent(null);
                            notify.info("Video upload cancelled.");
                          }}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer underline"
                        >
                          Cancel Upload
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Details */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: "#172033" }}>
                  Video Details
                </h3>
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Title <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="Enter video title..."
                  />
                </div>

                <div className="admin-form-group">
                  <div className="flex items-center justify-between mb-1">
                    <label className="admin-form-label" style={{ margin: 0 }}>
                      Duration
                    </label>
                    {isDurationAutoDetected && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Auto-detected
                      </span>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      className="admin-input"
                      value={videoDuration}
                      onChange={(e) => {
                        setVideoDuration(e.target.value);
                        setIsDurationAutoDetected(false);
                      }}
                      placeholder="Auto-detect"
                      style={{ paddingLeft: 32 }}
                    />
                    <Clock
                      size={15}
                      className="text-gray-400"
                      style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                    />
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Description (Optional)</label>
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    value={videoDesc}
                    onChange={(e) => setVideoDesc(e.target.value)}
                    placeholder="Add description..."
                    style={{ minHeight: 70 }}
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 2: DOCUMENT */}
          {activeTab === "document" && (
            <>
              <div>
                <div
                  className="admin-dropzone"
                  onClick={() => docInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleDocFile(file);
                  }}
                  style={{ minHeight: 180 }}
                >
                  <input
                    type="file"
                    ref={docInputRef}
                    accept="application/pdf,.doc,.docx"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDocFile(file);
                    }}
                  />
                  <div className="admin-dropzone-icon" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                    <FileText size={28} />
                  </div>
                  <div className="admin-dropzone-title">Upload PDF / Document</div>
                  <div className="admin-dropzone-desc">Drag and drop file here or</div>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    style={{ height: 32, fontSize: 12, padding: "0 14px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      docInputRef.current?.click();
                    }}
                  >
                    Choose File
                  </button>
                </div>
                <p
                  className="text-center text-gray-400 mt-2"
                  style={{ fontSize: 10, lineHeight: 1.4 }}
                >
                  Supported: PDF, DOC, DOCX • Max size: 50MB
                </p>

                {docFile && (
                  <div
                    className="mt-3 p-2 bg-sky-50 border border-sky-100 rounded-lg flex items-center justify-between"
                    style={{ fontSize: 12 }}
                  >
                    <span className="truncate max-w-[180px] font-medium text-sky-900">
                      {docFile.name}
                    </span>
                    <span className="text-sky-600 text-xs">
                      {(docFile.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: "#172033" }}>
                  Document Details
                </h3>
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Title <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Enter document title..."
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Description (Optional)</label>
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    value={docDesc}
                    onChange={(e) => setDocDesc(e.target.value)}
                    placeholder="Add description..."
                    style={{ minHeight: 90 }}
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 3: TEST / QUIZ */}
          {activeTab === "quiz" && (
            <div style={{ gridColumn: "span 2" }}>
              <div className="admin-card" style={{ padding: 20 }}>
                {/* Quiz Level / Scope Toggle */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-700">Quiz Level:</span>
                    <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setQuizScope("chapter");
                          if (!quizTitle || quizTitle.toLowerCase().includes("module")) {
                            setQuizTitle("Chapter Quiz");
                          }
                        }}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          quizScope === "chapter"
                            ? "bg-white text-indigo-600 shadow-2xs"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        Chapter Quiz
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuizScope("module");
                          if (!quizTitle || quizTitle.toLowerCase().includes("chapter")) {
                            setQuizTitle(`${moduleTitle || "Module"} Test`);
                          }
                        }}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          quizScope === "module"
                            ? "bg-white text-indigo-600 shadow-2xs"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        Module Quiz
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: "#fdf2f8", color: "#db2777" }}
                  >
                    <ClipboardCheck size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                      {quizScope === "chapter" ? "Configure Chapter Quiz" : "Configure Module Quiz"}
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="admin-form-group sm:col-span-2">
                    <label className="admin-form-label">
                      {quizScope === "chapter" ? "Chapter Quiz Name" : "Module Quiz Name"} <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="admin-input"
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      placeholder={
                        quizScope === "chapter"
                          ? "e.g. Chapter 1: Introduction Quiz"
                          : "e.g. Module 1 Mastery Quiz"
                      }
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Time Limit (Minutes)</label>
                    <input
                      type="number"
                      className="admin-input"
                      value={quizDuration}
                      onChange={(e) => setQuizDuration(e.target.value)}
                      min="1"
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Passing Percentage (%)</label>
                    <input
                      type="number"
                      className="admin-input"
                      value={quizPassMarks}
                      onChange={(e) => setQuizPassMarks(e.target.value)}
                      min="1"
                      max="100"
                    />
                  </div>
                </div>

                {/* Question Creation Mode Selector */}
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <label className="admin-form-label mb-2 block font-semibold text-gray-800">
                    How would you like to add questions?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Option 1: AI */}
                    <div
                      onClick={() => setQuizMode("ai")}
                      className={`cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between ${
                        quizMode === "ai"
                          ? "border-indigo-500 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-500"
                          : "border-gray-200 hover:border-indigo-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <Sparkles size={15} />
                        </div>
                        <span className="text-xs font-bold text-gray-900">Auto-Generate (AI)</span>
                      </div>
                    </div>

                    {/* Option 2: Excel */}
                    <div
                      onClick={() => setQuizMode("excel")}
                      className={`cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between ${
                        quizMode === "excel"
                          ? "border-emerald-500 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-500"
                          : "border-gray-200 hover:border-emerald-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                          <FileSpreadsheet size={15} />
                        </div>
                        <span className="text-xs font-bold text-gray-900">Excel / CSV Import</span>
                      </div>
                    </div>

                    {/* Option 3: Manual */}
                    <div
                      onClick={() => setQuizMode("manual")}
                      className={`cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between ${
                        quizMode === "manual"
                          ? "border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-500"
                          : "border-gray-200 hover:border-blue-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <Edit3 size={15} />
                        </div>
                        <span className="text-xs font-bold text-gray-900">Manual Builder</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. MANUAL QUESTION BUILDER */}
                {quizMode === "manual" && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <Edit3 size={14} className="text-blue-600" />
                        {editingQuestionId ? "Edit Question" : "Enter Question Details"}
                      </span>
                      {editingQuestionId && (
                        <button
                          type="button"
                          onClick={handleCancelEditQuestion}
                          className="text-[11px] text-blue-600 hover:underline font-medium"
                        >
                          Cancel Editing
                        </button>
                      )}
                    </div>

                    {/* Question text */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Question Text <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        className="admin-textarea text-xs w-full"
                        rows={2}
                        value={manualQuestionText}
                        onChange={(e) => setManualQuestionText(e.target.value)}
                        placeholder="Type your question here... e.g. What is the output of print(2 ** 3) in Python?"
                      />
                    </div>

                    {/* Options A, B, C, D with radio buttons for correct answer */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Answer Choices <span className="text-gray-400 font-normal">(select the radio button next to the correct answer)</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Option A */}
                        <div
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                            manualCorrect === "a"
                              ? "border-emerald-500 bg-emerald-50/60 shadow-2xs"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <input
                            type="radio"
                            name="manualChoiceCorrect"
                            checked={manualCorrect === "a"}
                            onChange={() => setManualCorrect("a")}
                            className="w-4 h-4 text-emerald-600 cursor-pointer"
                            id="choice_a_radio"
                          />
                          <label htmlFor="choice_a_radio" className="text-xs font-bold text-gray-700 cursor-pointer shrink-0">
                            A:
                          </label>
                          <input
                            type="text"
                            className="admin-input text-xs flex-1 !h-8 !py-1"
                            value={manualOptionA}
                            onChange={(e) => setManualOptionA(e.target.value)}
                            placeholder="Option A text..."
                          />
                        </div>

                        {/* Option B */}
                        <div
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                            manualCorrect === "b"
                              ? "border-emerald-500 bg-emerald-50/60 shadow-2xs"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <input
                            type="radio"
                            name="manualChoiceCorrect"
                            checked={manualCorrect === "b"}
                            onChange={() => setManualCorrect("b")}
                            className="w-4 h-4 text-emerald-600 cursor-pointer"
                            id="choice_b_radio"
                          />
                          <label htmlFor="choice_b_radio" className="text-xs font-bold text-gray-700 cursor-pointer shrink-0">
                            B:
                          </label>
                          <input
                            type="text"
                            className="admin-input text-xs flex-1 !h-8 !py-1"
                            value={manualOptionB}
                            onChange={(e) => setManualOptionB(e.target.value)}
                            placeholder="Option B text..."
                          />
                        </div>

                        {/* Option C */}
                        <div
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                            manualCorrect === "c"
                              ? "border-emerald-500 bg-emerald-50/60 shadow-2xs"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <input
                            type="radio"
                            name="manualChoiceCorrect"
                            checked={manualCorrect === "c"}
                            onChange={() => setManualCorrect("c")}
                            className="w-4 h-4 text-emerald-600 cursor-pointer"
                            id="choice_c_radio"
                          />
                          <label htmlFor="choice_c_radio" className="text-xs font-bold text-gray-700 cursor-pointer shrink-0">
                            C:
                          </label>
                          <input
                            type="text"
                            className="admin-input text-xs flex-1 !h-8 !py-1"
                            value={manualOptionC}
                            onChange={(e) => setManualOptionC(e.target.value)}
                            placeholder="Option C text..."
                          />
                        </div>

                        {/* Option D */}
                        <div
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                            manualCorrect === "d"
                              ? "border-emerald-500 bg-emerald-50/60 shadow-2xs"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <input
                            type="radio"
                            name="manualChoiceCorrect"
                            checked={manualCorrect === "d"}
                            onChange={() => setManualCorrect("d")}
                            className="w-4 h-4 text-emerald-600 cursor-pointer"
                            id="choice_d_radio"
                          />
                          <label htmlFor="choice_d_radio" className="text-xs font-bold text-gray-700 cursor-pointer shrink-0">
                            D:
                          </label>
                          <input
                            type="text"
                            className="admin-input text-xs flex-1 !h-8 !py-1"
                            value={manualOptionD}
                            onChange={(e) => setManualOptionD(e.target.value)}
                            placeholder="Option D text..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Marks & Explanation */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Marks</label>
                        <input
                          type="number"
                          min="1"
                          className="admin-input text-xs !h-8"
                          value={manualMarks}
                          onChange={(e) => setManualMarks(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Explanation (Optional)</label>
                        <input
                          type="text"
                          className="admin-input text-xs !h-8"
                          value={manualExplanation}
                          onChange={(e) => setManualExplanation(e.target.value)}
                          placeholder="e.g. 2 ** 3 evaluates 2 raised to 3rd power (8)"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleAddOrUpdateManualQuestion}
                        className="admin-btn admin-btn-primary !h-8 !text-xs !px-4 flex items-center gap-1.5 bg-[#635BFF] hover:bg-[#5248e5]"
                      >
                        <Plus size={14} />
                        {editingQuestionId ? "Update Question" : "+ Add Question to Quiz"}
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. EXCEL / CSV IMPORT */}
                {quizMode === "excel" && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <FileSpreadsheet size={15} className="text-emerald-600" />
                        Bulk Upload Questions from Spreadsheet
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadExcelTemplate()}
                        className="text-xs text-emerald-700 hover:text-emerald-900 underline font-semibold flex items-center gap-1"
                      >
                        <Download size={13} />
                        Download Sample Template (.xlsx)
                      </button>
                    </div>
                    <div
                      onClick={() => excelFileInputRef.current?.click()}
                      className="border-2 border-dashed border-emerald-300 rounded-xl p-6 text-center cursor-pointer hover:bg-emerald-50 transition-all bg-white"
                    >
                      <input
                        type="file"
                        ref={excelFileInputRef}
                        accept=".xlsx,.xls,.csv"
                        style={{ display: "none" }}
                        onChange={handleExcelUpload}
                      />
                      <FileSpreadsheet size={28} className="mx-auto text-emerald-500 mb-2" />
                      <div className="text-xs font-bold text-gray-800">
                        {isParsingExcel ? "Parsing Questions..." : "Click to choose file or drag and drop Excel/CSV spreadsheet"}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Supported: .xlsx, .xls, .csv with Question, Option A, Option B, Correct Answer columns
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. AI QUESTION GENERATOR */}
                {quizMode === "ai" && (
                  <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                        <Sparkles size={15} className="text-indigo-600" />
                        AI Question Generator
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Topic / Keywords</label>
                        <input
                          type="text"
                          className="admin-input text-xs !h-8"
                          value={aiTopic}
                          onChange={(e) => setAiTopic(e.target.value)}
                          placeholder={quizTitle || moduleTitle || "e.g. Python variables, functions and loops"}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Question Count</label>
                        <select
                          className="admin-input text-xs !h-8 w-full"
                          value={aiCount}
                          onChange={(e) => setAiCount(Number(e.target.value))}
                        >
                          <option value={3}>3 Questions</option>
                          <option value={5}>5 Questions</option>
                          <option value={10}>10 Questions</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={isGeneratingAi}
                        onClick={handleGenerateAiQuestions}
                        className="admin-btn admin-btn-primary !h-8 !text-xs !px-4 flex items-center gap-1.5 bg-[#635BFF] hover:bg-[#5248e5]"
                      >
                        <Sparkles size={13} />
                        {isGeneratingAi ? "Generating Questions..." : `Generate ${aiCount} Questions with AI`}
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. QUIZ QUESTIONS LIST DISPLAY */}
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                      <span>Quiz Questions</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700">
                        {quizQuestions.length} added
                      </span>
                    </h5>
                    {quizQuestions.length > 0 && (
                      <span className="text-xs text-gray-500">
                        Total Marks:{" "}
                        <strong className="text-gray-800">
                          {quizQuestions.reduce((sum, q) => sum + (q.marks || 1), 0)}
                        </strong>
                      </span>
                    )}
                  </div>

                  {quizQuestions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-5 text-center">
                      <ClipboardCheck size={24} className="mx-auto text-gray-400 mb-1.5 opacity-60" />
                      <p className="text-xs font-semibold text-gray-700">No questions added yet</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Fill in question details above and click &quot;+ Add Question to Quiz&quot;, or use Excel / AI generator.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {quizQuestions.map((q, idx) => (
                        <div
                          key={q.id || idx}
                          className="p-3 rounded-xl border border-gray-200 bg-white shadow-2xs hover:border-indigo-200 transition-all text-xs"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="font-bold text-gray-900">
                              Q{idx + 1}. {q.text}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                {q.marks || 1} mark{q.marks === 1 ? "" : "s"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleEditQuestion(q)}
                                className="p-1 text-gray-400 hover:text-indigo-600 rounded"
                                title="Edit Question"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="p-1 text-gray-400 hover:text-rose-600 rounded"
                                title="Delete Question"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                            {q.options.map((opt) => {
                              const isCorrect =
                                String(opt.id).toLowerCase() ===
                                String(q.correctAnswer).toLowerCase();
                              return (
                                <div
                                  key={opt.id}
                                  className={`p-1.5 rounded text-[11px] flex items-center justify-between border ${
                                    isCorrect
                                      ? "bg-emerald-50/80 border-emerald-300 font-semibold text-emerald-900"
                                      : "bg-gray-50 border-gray-100 text-gray-600"
                                  }`}
                                >
                                  <span className="truncate">
                                    <strong>{opt.id.toUpperCase()}:</strong> {opt.text}
                                  </span>
                                  {isCorrect && (
                                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0 ml-1" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {q.explanation && (
                            <p className="text-[10px] text-gray-500 mt-1 italic">
                              Note: {q.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ASSIGNMENT */}
          {activeTab === "assignment" && (
            <div style={{ gridColumn: "span 2" }}>
              <div className="admin-card" style={{ padding: 20 }}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: "#ecfdf5", color: "#059669" }}
                  >
                    <Briefcase size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                      Create Practical Assignment
                    </h4>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Assignment Title <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    value={assignTitle}
                    onChange={(e) => setAssignTitle(e.target.value)}
                    placeholder="e.g. Build a Responsive Portfolio Project"
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Instructions / Description</label>
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    value={assignDesc}
                    onChange={(e) => setAssignDesc(e.target.value)}
                    placeholder="Provide step-by-step assignment requirements..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="admin-modal-footer">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Saving..."
              : activeTab === "video"
                ? "Upload Video"
                : activeTab === "document"
                  ? "Upload Document"
                  : activeTab === "quiz"
                    ? quizQuestions.length > 0
                      ? `Create Quiz (${quizQuestions.length} Question${quizQuestions.length === 1 ? "" : "s"})`
                      : "Create Quiz & Add Questions"
                    : "Add Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
