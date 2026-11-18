import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useNotify } from "@/core/hooks/useNotify";
import { useStartAttemptMutation } from "@/modules/assessments/attempts/api/attemptsApi";
import type { AttemptPaper } from "@/modules/assessments/attempts/paperTypes";
import { Button, Card, EmptyState, PageHeader } from "@/shared/ui";

export function AttemptInstructionsPage() {
  const { attemptId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotify();
  const [startAttempt, { isLoading }] = useStartAttemptMutation();
  const { paper, autoStart } = (location.state as { paper?: AttemptPaper; autoStart?: boolean } | null) ?? {};

  const start = useCallback(async () => {
    try {
      const started = await startAttempt(attemptId).unwrap();
      navigate(`/attempts/${attemptId}/take`, { replace: true, state: { paper: started } });
    } catch (error) {
      notify.apiError(error);
    }
  }, [attemptId, navigate, notify, startAttempt]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!paper || !autoStart || autoStarted.current) return;
    autoStarted.current = true;
    void start();
  }, [autoStart, paper, start]);

  if (!paper) {
    return <EmptyState icon="alert" title="This page needs to be reached from My tests" action={<Button onClick={() => navigate("/my-tests")}>Go to my tests</Button>} />;
  }

  return (
    <>
      <PageHeader title={paper.attempt.test_title} description="Read the instructions, then start when you're ready. The timer begins the moment you start." />
      <div className="space-y-4">
        <Card title="Before you start">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              {paper.attempt.total_questions} question{paper.attempt.total_questions === 1 ? "" : "s"}.
            </li>
            {paper.attempt.time_mode === "overall" ? <li>One timer for the whole test.</li> : <li>Each section has its own timer; a finished section cannot be reopened.</li>}
            <li>Answers are saved automatically as you work.</li>
          </ul>
        </Card>
        <div className="flex justify-end">
          <Button loading={isLoading} onClick={() => void start()}>
            Start now
          </Button>
        </div>
      </div>
    </>
  );
}
