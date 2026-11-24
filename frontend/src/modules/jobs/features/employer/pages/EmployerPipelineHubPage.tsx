import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Layers } from "lucide-react";
import { apiFetch, type ApiResponse } from "../../../services/api";

type JobSummary = {
  id: string;
  title: string;
  status: string;
  location?: string;
  employment_type: string;
  applicant_count: number;
  active_applicant_count?: number;
};

const statusLabel = (status: string) =>
  status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** One pipeline board per job role — pick a posting first (not a unified mixed board). */
export function EmployerPipelineHubPage() {
  const [params] = useSearchParams();
  const legacyJobId = params.get("jobId");
  if (legacyJobId) {
    return <Navigate to={`/jobs/employer/pipeline/${legacyJobId}`} replace />;
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["employer-jobs"],
    queryFn: () => apiFetch<ApiResponse<{ jobs: JobSummary[] }>>("/employers/me/jobs"),
  });

  const jobs = (data?.data.jobs || []).filter(
    (j) => j.status !== "CLOSED" && j.status !== "CANCELLED" && j.status !== "REJECTED",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Pipelines by role</h1>
        <p className="mt-1 text-sm text-slate-500">
          Each job has its own hiring stages and candidates. Open a role to manage that pipeline only.
        </p>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading your open roles…</p>}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load jobs.
        </p>
      )}

      {!isLoading && jobs.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <Layers className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-700">No active roles with a pipeline yet.</p>
          <Link
            to="/jobs/employer/jobs/new"
            className="mt-4 inline-flex text-sm font-semibold text-[#7DC8F7] hover:underline"
          >
            Create a job posting
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <Link
            key={job.id}
            to={`/jobs/employer/pipeline/${job.id}`}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <h2 className="text-base font-bold text-slate-900 group-hover:text-indigo-700">{job.title}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {job.location || "Flexible"} · {job.employment_type.replace(/_/g, " ")}
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
              <span className="font-medium text-slate-600">{statusLabel(job.status)}</span>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-bold text-indigo-700">
                {(job.active_applicant_count ?? job.applicant_count)} active applicant
                {(job.active_applicant_count ?? job.applicant_count) === 1 ? "" : "s"}
              </span>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">
              Open pipeline
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}