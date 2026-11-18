import { Link } from "react-router-dom";

import { JobTabs } from "@/modules/job-portal/common/components/JobTabs";
import { useListRecruiterApplicationsQuery } from "@/modules/job-portal/jcms/api/jcmsApi";
import { Badge, EmptyState, PageHeader, Spinner } from "@/shared/ui";

export function RecruiterScreeningPage() {
  const { data = [], isFetching } = useListRecruiterApplicationsQuery({ page: 1, per_page: 50 });

  return (
    <>
      <PageHeader title="Candidate review" description="Screen applications for jobs assigned to you." />
      <JobTabs />
      {isFetching && data.length === 0 ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState icon="users" title="No assigned applications" description="Ask your employer admin to assign you to open jobs." />
      ) : (
        <div className="space-y-3">
          {data.map((row) => (
            <article key={row.application_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/60">
              <div>
                <h2 className="text-[15px] font-bold text-navy-950">{row.candidate?.name || "Candidate"}</h2>
                <p className="text-[13px] text-slate-500">{row.job_title || `Job #${row.job_id}`}{row.match_score != null ? ` · match ${row.match_score}%` : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="blue">{row.status}</Badge>
                <Link to={`/jobs/employer/applications/${row.application_id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                  Open
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
