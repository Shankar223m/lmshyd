import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MapPin, Briefcase, Clock, Check, ArrowLeft, DollarSign, Copy, Building2 } from "lucide-react";
import { JobThumbnail } from "../../../components/JobThumbnail";
import { formatSalaryRange, SALARY_DISCLOSURE } from "../../../utils/formatSalary";
import { JobPostingTagline } from "../../../components/JobPostingTagline";
import { apiFetch, type ApiResponse } from "../../../services/api";

type JobDetail = {
  id: string;
  title: string;
  description: string;
  location?: string;
  employment_type: string;
  work_mode: string;
  salary_min?: number;
  salary_max?: number;
  openings?: number;
  skills?: string[];
  organization_name?: string;
  thumbnail_file_id?: string | null;
  match_percent?: number;
  closes_on?: string;
  created_at?: string;
  status?: string;
  applicant_count?: number;
  active_applicant_count?: number;
  eligibility?: Record<string, unknown>;
  eligibility_details?: Array<{ rule: string; passed: boolean; message: string }>;
  posting_channel?: string;
  posting_tagline?: string;
};

export function JobDetailPage({ audience = "student" }: { audience?: "student" | "admin" }) {
  const isAdmin = audience === "admin";
  const listPath = isAdmin ? "/jobs/admin/postings" : "/jobs/student/jobs";
  const { jobId } = useParams();
  const [activeTab, setActiveTab] = useState<"overview" | "company">("overview");
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => apiFetch<ApiResponse<JobDetail>>(`/jobs/${jobId}`),
  });

  const job = data?.data;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#635BFF] border-t-transparent" />
        <p className="text-xs text-slate-500">Loading role…</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto my-12 max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="text-base font-bold text-red-900">Job not found</h2>
        <p className="mt-1 text-xs text-red-700">This role may have closed or is no longer visible.</p>
        <Link
          to={listPath}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#635BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5046E5]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to openings
        </Link>
      </div>
    );
  }

  const salaryText = formatSalaryRange(job.salary_min, job.salary_max);
  const org = job.organization_name || "Employer";
  const postedLabel = job.created_at
    ? `Posted ${new Date(job.created_at).toLocaleDateString()}`
    : job.closes_on
      ? `Apply by ${new Date(job.closes_on).toLocaleDateString()}`
      : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to={listPath} className="transition hover:text-slate-900">
          {isAdmin ? "Job postings" : "Job portal"}
        </Link>
        <span>/</span>
        <span className="max-w-md truncate font-semibold text-slate-900">{job.title}</span>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-md">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <JobThumbnail
              fileId={job.thumbnail_file_id}
              fallbackLabel={org}
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm"
            />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">{job.title}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                <span className="font-semibold text-slate-700">{org}</span>
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {job.location}
                  </span>
                )}
                <span className="flex items-center gap-1 capitalize">
                  <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                  {job.employment_type.replace(/_/g, " ").toLowerCase()}
                </span>
                {postedLabel && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {postedLabel}
                  </span>
                )}
              </div>
              <p className="mt-3 text-lg font-bold text-slate-900">{salaryText || SALARY_DISCLOSURE}</p>
            </div>
          </div>

          {!isAdmin ? (
            <Link
              to={`/jobs/student/jobs/${job.id}/apply`}
              className="shrink-0 self-start rounded-xl bg-[#16A37B] px-8 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 md:self-center"
            >
              Apply now
            </Link>
          ) : (
            <Link
              to="/jobs/admin/review?tab=jobs"
              className="shrink-0 self-start rounded-xl border border-slate-200 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 md:self-center"
            >
              Open review inbox
            </Link>
          )}
        </div>

        <div className="mt-6 flex gap-6 overflow-x-auto border-t border-slate-100 pt-2 text-sm font-medium">
          {(["overview", "company"] as const).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={`relative whitespace-nowrap pb-2.5 capitalize transition ${
                activeTab === tabKey ? "font-semibold text-[#635BFF] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#635BFF]" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tabKey}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          {activeTab === "overview" && (
            <>
              <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <h2 className="text-base font-bold text-slate-900">About the role</h2>
                <JobPostingTagline postingChannel={job.posting_channel} tagline={job.posting_tagline} />
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {job.description?.trim() || "The employer has not added a detailed description yet."}
                </p>
                {job.skills && job.skills.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {job.skills.map((sk) => (
                        <span key={sk} className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {job.eligibility_details && job.eligibility_details.length > 0 && (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">Your eligibility</h3>
                  <ul className="mt-4 space-y-2">
                    {job.eligibility_details.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between border-b border-slate-50 py-2 text-xs last:border-0">
                        <span className="font-medium text-slate-700">{item.rule}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                            item.passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {item.passed ? <Check className="h-3 w-3" /> : null}
                          {item.passed ? "Eligible" : item.message || "Review"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {activeTab === "company" && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <JobThumbnail fallbackLabel={org} className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{org}</h2>
                  <p className="mt-1 text-sm text-slate-500">Verified campus employer</p>
                  <Link
                    to={`${listPath}?q=${encodeURIComponent(org)}`}
                    className="mt-4 inline-flex text-sm font-semibold text-[#635BFF] hover:underline"
                  >
                    View all roles at {org} →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-4">
          <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Job highlights</h3>
            {isAdmin && job.status && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                Status: {job.status.replace(/_/g, " ")}
              </p>
            )}
            {typeof job.active_applicant_count === "number" && isAdmin && (
              <p className="text-xs text-slate-600">
                <span className="font-semibold text-slate-900">{job.active_applicant_count}</span> active applicants
                {typeof job.applicant_count === "number" ? ` · ${job.applicant_count} total` : ""}
              </p>
            )}
            {!isAdmin && typeof job.match_percent === "number" && (
              <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-[#635BFF]">
                {job.match_percent}% profile match
              </p>
            )}
            <Highlight icon={<DollarSign className="h-4 w-4" />} tone="emerald" label="Salary" value={salaryText || SALARY_DISCLOSURE} />
            <Highlight icon={<Building2 className="h-4 w-4" />} tone="purple" label="Work mode" value={job.work_mode.replace(/_/g, " ")} />
            <Highlight icon={<MapPin className="h-4 w-4" />} tone="blue" label="Location" value={job.location || "Not specified"} />
            {job.openings != null && (
              <Highlight icon={<Briefcase className="h-4 w-4" />} tone="indigo" label="Openings" value={String(job.openings)} />
            )}
            {!isAdmin && (
              <Link
                to={`/jobs/student/jobs/${job.id}/apply`}
                className="flex w-full items-center justify-center rounded-xl bg-[#16A37B] py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Apply for this position
              </Link>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-900">Share</h4>
            <button
              type="button"
              onClick={handleCopyLink}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Copy className="h-3.5 w-3.5 text-slate-400" />
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Highlight({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "emerald" | "purple" | "blue" | "indigo";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-[#635BFF]",
  };
  return (
    <div className="flex items-start gap-3 text-xs">
      <div className={`shrink-0 rounded-lg p-2 ${tones[tone]}`}>{icon}</div>
      <div>
        <div className="font-medium text-slate-400">{label}</div>
        <div className="mt-0.5 font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}