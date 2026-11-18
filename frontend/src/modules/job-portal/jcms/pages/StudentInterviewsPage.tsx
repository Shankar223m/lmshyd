import { Link } from "react-router-dom";

import { formatDateTime } from "@/core/lib/format";
import { JobTabs } from "@/modules/job-portal/common/components/JobTabs";
import { useListMyInterviewsQuery } from "@/modules/job-portal/jcms/api/jcmsApi";
import { Badge, EmptyState, PageHeader, Spinner } from "@/shared/ui";

export function StudentInterviewsPage() {
  const { data = [], isFetching } = useListMyInterviewsQuery();

  return (
    <>
      <PageHeader title="My interviews" description="Upcoming and past interview rounds for your applications." />
      <JobTabs />
      {isFetching && data.length === 0 ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState icon="clock" title="No interviews yet" description="When a recruiter schedules a round, it appears here." action={<Link to="/jobs/applications" className="text-sm font-semibold text-brand-700">View applications</Link>} />
      ) : (
        <div className="space-y-3">
          {data.map((interview) => (
            <article key={interview.interview_id} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/60 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-navy-950">{interview.round_name}</h2>
                  <p className="text-[13px] text-slate-500">{formatDateTime(interview.starts_at)} · {interview.format} · {interview.timezone}</p>
                </div>
                <Badge tone={interview.status === "scheduled" ? "blue" : "gray"}>{interview.status}</Badge>
              </div>
              {interview.meeting_link ? (
                <a href={interview.meeting_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-brand-700 hover:underline">
                  Join meeting
                </a>
              ) : null}
              {interview.instructions ? <p className="mt-2 text-sm text-slate-600">{interview.instructions}</p> : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
