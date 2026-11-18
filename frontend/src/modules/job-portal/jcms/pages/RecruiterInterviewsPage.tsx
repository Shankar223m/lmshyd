import { useState } from "react";

import { formatDateTime } from "@/core/lib/format";
import { JobTabs } from "@/modules/job-portal/common/components/JobTabs";
import { useListRecruiterInterviewsQuery, useSubmitInterviewFeedbackMutation } from "@/modules/job-portal/jcms/api/jcmsApi";
import { Badge, Button, EmptyState, Field, PageHeader, Spinner } from "@/shared/ui";

export function RecruiterInterviewsPage() {
  const { data = [], isFetching } = useListRecruiterInterviewsQuery();
  const [submitFeedback, feedbackState] = useSubmitInterviewFeedbackMutation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState("hire");

  return (
    <>
      <PageHeader title="Interviews & scorecards" description="Scheduled rounds for your assigned jobs. Submit feedback after each round." />
      <JobTabs />
      {isFetching && data.length === 0 ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState icon="clock" title="No interviews scheduled" description="Schedule a round from an applicant's pipeline page." />
      ) : (
        <div className="space-y-3">
          {data.map((interview) => (
            <article key={interview.interview_id} className="space-y-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/60 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-navy-950">{interview.round_name}</h2>
                  <p className="text-[13px] text-slate-500">{formatDateTime(interview.starts_at)} · {interview.format}</p>
                </div>
                <Badge tone={interview.status === "completed" ? "green" : "blue"}>{interview.status}</Badge>
              </div>
              {interview.status === "scheduled" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Recommendation">
                    {(props) => (
                      <input {...props} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />
                    )}
                  </Field>
                  <Button
                    size="sm"
                    disabled={feedbackState.isLoading}
                    onClick={() => {
                      setActiveId(interview.interview_id);
                      submitFeedback({
                        interviewId: interview.interview_id,
                        body: {
                          technical_skills: 4,
                          problem_solving: 4,
                          communication: 4,
                          culture_fit: 4,
                          recommendation,
                          comments: "Submitted from recruiter interviews page",
                        },
                      });
                    }}
                  >
                    {activeId === interview.interview_id && feedbackState.isLoading ? "Saving…" : "Submit scorecard"}
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
