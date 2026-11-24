import { useState, useEffect } from "react";
import { Modal, Button, Alert } from "@/shared/ui";
import {
  AssessmentQuestionManager,
  type ManagedQuestionItem,
} from "@/modules/catalog/course-tests/components/AssessmentQuestionManager";
import type { McqDraft } from "@/modules/catalog/course-tests/hooks/useTestQuestions";
import {
  useCreateTestMutation,
  useUpdateTestMutation,
  useReplaceSectionsMutation,
  useSubmitTestMutation,
  useApproveTestMutation,
  useGetTestQuery,
} from "@/modules/assessments/tests/api/testsApi";
import {
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  useSubmitQuestionMutation,
  useApproveQuestionMutation,
  useListQuestionsQuery,
} from "@/modules/assessments/questions/api/questionsApi";
import { useUpdateRulesMutation } from "@/modules/catalog/courses/api/coursesApi";
import { useNotify } from "@/core/hooks/useNotify";
import type { CourseRule } from "@/modules/catalog/courses/curriculumTypes";

export interface FinalExamSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseTitle: string;
  courseId: string;
  versionId: string;
  rule?: CourseRule;
  onSaved?: () => void;
}

export function FinalExamSetupModal({
  isOpen,
  onClose,
  courseTitle,
  courseId,
  versionId,
  rule,
  onSaved,
}: FinalExamSetupModalProps) {
  const notify = useNotify();

  // Exam Settings
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [passMarkPercent, setPassMarkPercent] = useState(rule?.final_pass_mark || 70);
  const [maxAttempts, setMaxAttempts] = useState(rule?.final_test_attempts || 3);
  const [cooldownDays, setCooldownDays] = useState(rule?.final_test_cooldown_days || 1);

  const [questions, setQuestions] = useState<ManagedQuestionItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Existing test if linked
  const existingTestId = rule?.final_test_id ? String(rule.final_test_id) : null;
  const { data: existingTest } = useGetTestQuery(
    existingTestId ?? "",
    { skip: !existingTestId, refetchOnMountOrArgChange: true }
  );

  const { data: bankData } = useListQuestionsQuery({ per_page: 100 }, { skip: !isOpen });

  const [createTest] = useCreateTestMutation();
  const [updateTest] = useUpdateTestMutation();
  const [replaceSections] = useReplaceSectionsMutation();
  const [submitTest] = useSubmitTestMutation();
  const [approveTest] = useApproveTestMutation();
  const [createQuestion] = useCreateQuestionMutation();
  const [updateQuestion] = useUpdateQuestionMutation();
  const [submitQuestion] = useSubmitQuestionMutation();
  const [approveQuestion] = useApproveQuestionMutation();
  const [updateRules] = useUpdateRulesMutation();

  // Initialize questions
  useEffect(() => {
    if (!isOpen) {
      setIsLoaded(false);
      return;
    }
    if (isLoaded) return;

    let loaded: ManagedQuestionItem[] = [];

    // 1. Primary: Load directly from existing test slots in database
    if (existingTest?.sections && existingTest.sections.length > 0) {
      const slots = existingTest.sections.flatMap((s) => s.slots || []);
      if (slots.length > 0) {
        loaded = slots.map((slot, sIdx) => {
          const matched = bankData?.items?.find((q) => String(q.question_id) === String(slot.question_id));
          const opts = (matched as any)?.options?.map((o: any) => ({ id: o.id || "a", text: o.text || "" })) || [
            { id: "a", text: "Option A" },
            { id: "b", text: "Option B" },
            { id: "c", text: "Option C" },
            { id: "d", text: "Option D" },
          ];
          return {
            id: slot.question_id ? String(slot.question_id) : `final-slot-${sIdx}`,
            text: matched?.text || `Comprehensive Exam Question #${slot.position || sIdx + 1}`,
            questionType: matched?.question_type || "mcq_single",
            marks: slot.marks || matched?.default_marks || 2,
            options: opts,
            correctAnswer: (matched as any)?.answer_key?.correct || "a",
            explanation: (matched as any)?.explanation || "",
          };
        });
      }
    }

    // 2. Fallback: Try localStorage
    if (loaded.length === 0) {
      try {
        const saved = localStorage.getItem(`final_exam_questions_${courseId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loaded = parsed;
          }
        }
      } catch {
        // ignore
      }
    }

    // If no questions exist, start with an empty question list
    if (existingTest) {
      if (existingTest.duration_minutes) setDurationMinutes(existingTest.duration_minutes);
      if (existingTest.pass_mark_percent) setPassMarkPercent(existingTest.pass_mark_percent);
      if (existingTest.max_attempts) setMaxAttempts(existingTest.max_attempts);
    }

    setQuestions(loaded);
    setIsLoaded(true);
  }, [isOpen, isLoaded, courseId, courseTitle, existingTest, bankData]);

  // Persist draft questions to localStorage
  const updateQuestionsAndPersist = (newQuestions: ManagedQuestionItem[]) => {
    setQuestions(newQuestions);
    try {
      localStorage.setItem(`final_exam_questions_${courseId}`, JSON.stringify(newQuestions));
    } catch {
      // ignore
    }
  };

  const handleSaveQuestion = async (draft: McqDraft & { questionType?: string }) => {
    const newItem: ManagedQuestionItem = {
      id: draft.questionId || `draft-final-q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: draft.text,
      questionType: draft.questionType || "mcq_single",
      marks: draft.marks,
      options: draft.options,
      correctAnswer: draft.correct,
      explanation: draft.explanation,
    };

    if (draft.questionId) {
      updateQuestionsAndPersist(
        questions.map((q) => (q.id === draft.questionId ? newItem : q))
      );
      notify.success("Question updated");
    } else {
      updateQuestionsAndPersist([...questions, newItem]);
      notify.success("Question added");
    }
  };

  const handleDeleteQuestion = async (questionId?: string, index?: number) => {
    let nextList: ManagedQuestionItem[];
    if (questionId) {
      nextList = questions.filter((q) => q.id !== questionId);
    } else if (index !== undefined) {
      nextList = questions.filter((_, idx) => idx !== index);
    } else {
      return;
    }
    updateQuestionsAndPersist(nextList);
    notify.success("Question removed");
  };

  const handleImportDrafts = async (
    drafts: McqDraft[],
    _onProgress: (completed: number, total: number) => void
  ) => {
    const importedItems: ManagedQuestionItem[] = drafts.map((d, i) => ({
      id: `draft-import-final-${Date.now()}-${i}`,
      text: d.text,
      questionType: "mcq_single",
      marks: d.marks,
      options: d.options,
      correctAnswer: d.correct,
      explanation: d.explanation,
    }));

    updateQuestionsAndPersist([...questions, ...importedItems]);
    notify.success(`Imported ${drafts.length} questions to Final Exam!`);
  };

  // Final Save & Publish of Final Exam
  const handleSaveAndPublishTest = async () => {
    if (questions.length === 0) {
      setSaveError("Please add at least one question to the final exam.");
      return;
    }

    try {
      setIsSavingAll(true);
      setSaveError(null);

      // 1. Create or retrieve test in assessment service
      let testId = existingTestId;
      if (!testId) {
        const createdTest = await createTest({
          title: `${courseTitle} · Final Certification Exam`,
          kind: "module",
          target_id: courseId,
          duration_minutes: durationMinutes,
          pass_mark_percent: passMarkPercent,
          max_attempts: maxAttempts,
          time_mode: "overall",
          proctoring_level: "strict",
        }).unwrap();
        testId = createdTest.test_id;
      } else {
        await updateTest({
          testId,
          body: {
            duration_minutes: durationMinutes,
            pass_mark_percent: passMarkPercent,
            max_attempts: maxAttempts,
          },
        }).unwrap();
      }

      // 2. Create questions in question bank and collect slot inputs
      const slots = [];
      for (const q of questions) {
        try {
          let qid = q.id;
          const isDraftId = !qid || qid.startsWith("draft-") || qid.startsWith("imported-") || qid.startsWith("final-slot-") || qid.startsWith("auto-");

          if (isDraftId) {
            const createdQ = await createQuestion({
              question_type: "mcq_single",
              text: q.text,
              body: { options: q.options || [] },
              answer_key: { correct: q.correctAnswer || "a" },
              explanation: q.explanation || null,
              default_marks: q.marks,
              topics: [courseTitle.toLowerCase().replace(/\s+/g, "-"), "final-exam"],
            }).unwrap();

            try {
              await submitQuestion(createdQ.question_id).unwrap();
              await approveQuestion({ questionId: createdQ.question_id }).unwrap();
            } catch {
              // Already submitted/approved
            }
            qid = createdQ.question_id;
          } else if (qid) {
            try {
              await updateQuestion({
                questionId: qid,
                body: {
                  text: q.text,
                  body: { options: q.options || [] },
                  answer_key: { correct: q.correctAnswer || "a" },
                  explanation: q.explanation || null,
                  default_marks: q.marks,
                },
              }).unwrap();
            } catch (uErr) {
              console.warn("Could not update question in bank:", uErr);
            }
          }

          slots.push({
            slot_type: "fixed" as const,
            question_id: qid,
            marks: q.marks,
          });
        } catch (qErr) {
          console.error("Failed to sync question to bank:", qErr);
        }
      }

      // 3. Configure test section slots
      if (testId && slots.length > 0) {
        await replaceSections({
          testId,
          sections: [
            {
              title: `${courseTitle} Comprehensive Certification Section`,
              slots,
            },
          ],
        }).unwrap();

        try {
          await submitTest(testId).unwrap();
          await approveTest({ testId }).unwrap();
        } catch {
          // Already approved
        }
      }

      // 4. Link test to course version rules
      if (testId) {
        await updateRules({
          courseId,
          versionId,
          body: {
            final_test_id: testId,
            final_pass_mark: passMarkPercent,
            final_test_attempts: maxAttempts,
            final_test_cooldown_days: cooldownDays,
          },
        }).unwrap();
      }

      notify.success("Final Certification Exam configured and linked successfully!");
      try {
        localStorage.removeItem(`final_exam_questions_${courseId}`);
      } catch {}

      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      setSaveError(err?.data?.message || err?.message || "Failed to save final certification exam.");
      notify.error("Failed to save final exam.");
    } finally {
      setIsSavingAll(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Final Certification Exam – ${courseTitle}`}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-xs text-slate-500">
            {questions.length} question{questions.length !== 1 ? "s" : ""} configured
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSavingAll}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveAndPublishTest}
              loading={isSavingAll}
              disabled={isSavingAll || questions.length === 0}
              className="bg-[#635BFF] hover:bg-[#5248EE] text-white font-bold"
            >
              Save & Link Final Exam
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {saveError && (
          <Alert tone="danger" title="Save Error">
            {saveError}
          </Alert>
        )}

        {/* Exam Parameter Settings */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <h4 className="text-sm font-bold text-slate-900 mb-3">
            Final Exam Settings
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                min={5}
                max={180}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(5, parseInt(e.target.value) || 45))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Passing Score (%)
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={passMarkPercent}
                onChange={(e) => setPassMarkPercent(Math.min(100, Math.max(10, parseInt(e.target.value) || 70)))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Retake Attempts
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Math.max(1, parseInt(e.target.value) || 3))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cooldown (Days)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={cooldownDays}
                onChange={(e) => setCooldownDays(Math.max(0, parseInt(e.target.value) || 1))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Assessment Question Manager (AI Auto-Gen, Excel Import, Manual Builder) */}
        <div>
          <AssessmentQuestionManager
            questions={questions}
            contextTitle={courseTitle}
            contextType="final"
            targetQuestionCount={questions.length || 10}
            onSaveQuestion={handleSaveQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            onImportDrafts={handleImportDrafts}
          />
        </div>
      </div>
    </Modal>
  );
}
