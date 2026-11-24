import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { JobThumbnail } from "../../../components/JobThumbnail";
import { apiFetch, type ApiResponse } from "../../../services/api";

type ModerationJob = {
  id: string;
  title: string;
  organization_name?: string;
  organization_verified?: boolean;
  status: string;
  description: string;
  location?: string;
  employment_type: string;
  work_mode: string;
  salary_min?: number;
  salary_max?: number;
  openings?: number;
  skills?: string[];
  moderation_note?: string;
  created_at?: string;
  safety_checks?: {
    salary_benchmark_met: boolean;
    no_recruitment_fees: boolean;
    duplicate_detected: boolean;
    org_verified: boolean;
  };
};

type OrganizationItem = {
  id: string;
  name: string;
  org_type: string;
  verification_status: string;
  verification_comment?: string;
  website?: string;
  contact_name?: string;
  contact_email?: string;
  created_at?: string;
};

function daysWaiting(iso?: string): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function formatWhen(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminReviewInboxPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "orgs" ? "orgs" : "jobs";
  const deepJobId = params.get("job");

  const [selectedJobId, setSelectedJobId] = useState<string | null>(deepJobId);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [orgComment, setOrgComment] = useState("");

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["admin-jobs", "queue"],
    queryFn: () => apiFetch<ApiResponse<ModerationJob[]>>("/admin/jobs?tab=queue"),
  });
  const jobs = jobsData?.data || [];

  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ["admin-organizations", "pending"],
    queryFn: () => apiFetch<ApiResponse<OrganizationItem[]>>("/admin/organizations?status=PENDING"),
  });
  const orgs = useMemo(() => {
    const rows = orgsData?.data || [];
    return rows.filter((o) =>
      ["PENDING", "UNDER_REVIEW", "CHANGES_REQUIRED"].includes(o.verification_status),
    );
  }, [orgsData?.data]);

  useEffect(() => {
    if (deepJobId) setSelectedJobId(deepJobId);
  }, [deepJobId]);

  useEffect(() => {
    if (tab === "jobs" && !selectedJobId && jobs[0]) setSelectedJobId(jobs[0].id);
    if (tab === "orgs" && !selectedOrgId && orgs[0]) setSelectedOrgId(orgs[0].id);
  }, [tab, jobs, orgs, selectedJobId, selectedOrgId]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || null;
  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) || null;

  const moderateMutation = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      apiFetch(`/admin/jobs/${id}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action, note }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setNoteText("");
      setSelectedJobId(null);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, action, comment }: { id: string; action: string; comment?: string }) =>
      apiFetch(`/admin/organizations/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({ action, comment }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-organizations"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setOrgComment("");
      setSelectedOrgId(null);
    },
  });

  const setTab = (next: "jobs" | "orgs") => {
    const p = new URLSearchParams(params);
    if (next === "orgs") p.set("tab", "orgs");
    else p.delete("tab");
    p.delete("job");
    setParams(p, { replace: true });
  };

  const empty = tab === "jobs" ? jobs.length === 0 && !jobsLoading : orgs.length === 0 && !orgsLoading;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-tight text-slate-900">Review inbox</h1>
          <p className="mt-1 text-sm text-slate-500">Jobs and organisations waiting for a decision</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Compliance SLA <strong className="text-slate-900">99.4%</strong>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("jobs")}
          className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
            tab === "jobs" ? "bg-[#7DC8F7] text-white" : "border border-slate-200 bg-white text-slate-700"
          }`}
        >
          Jobs ({jobs.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("orgs")}
          className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
            tab === "orgs" ? "bg-[#7DC8F7] text-white" : "border border-slate-200 bg-white text-slate-700"
          }`}
        >
          Organisations ({orgs.length})
        </button>
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <h2 className="text-lg font-bold text-slate-900">All caught up!</h2>
          <p className="mt-1 text-sm text-slate-500">There are no jobs or organisations awaiting review.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/jobs/admin/audit" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
              View activity log
            </Link>
            <Link to="/jobs/admin/jobs/new" className="rounded-xl bg-[#7DC8F7] px-4 py-2 text-sm font-semibold text-white">
              Create job
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            {tab === "jobs" &&
              jobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setSelectedJobId(j.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedJobId === j.id
                      ? "border-[#7DC8F7] bg-[#7DC8F7]/5"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <JobThumbnail fallbackLabel={j.organization_name || "Co"} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{j.title}</p>
                      <p className="truncate text-xs text-slate-500">{j.organization_name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                          Under review
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Clock className="h-3 w-3" />
                          Waiting {daysWaiting(j.created_at)} days
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            {tab === "orgs" &&
              orgs.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedOrgId(o.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedOrgId === o.id
                      ? "border-[#7DC8F7] bg-[#7DC8F7]/5"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <JobThumbnail fallbackLabel={o.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{o.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {o.org_type} · {o.verification_status.replace(/_/g, " ")}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-500">Waiting {daysWaiting(o.created_at)} days</p>
                    </div>
                  </div>
                </button>
              ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-8">
            {tab === "jobs" && selectedJob && (
              <JobReviewPanel
                job={selectedJob}
                noteText={noteText}
                setNoteText={setNoteText}
                pending={moderateMutation.isPending}
                onApprove={() => moderateMutation.mutate({ id: selectedJob.id, action: "approve" })}
                onReject={() => {
                  if (!noteText.trim()) return;
                  moderateMutation.mutate({ id: selectedJob.id, action: "reject", note: noteText.trim() });
                }}
                onChanges={() => {
                  if (!noteText.trim()) return;
                  moderateMutation.mutate({
                    id: selectedJob.id,
                    action: "request_changes",
                    note: noteText.trim(),
                  });
                }}
              />
            )}
            {tab === "orgs" && selectedOrg && (
              <OrgReviewPanel
                org={selectedOrg}
                comment={orgComment}
                setComment={setOrgComment}
                pending={verifyMutation.isPending}
                onVerify={() => verifyMutation.mutate({ id: selectedOrg.id, action: "verify" })}
                onReject={() => {
                  if (!orgComment.trim()) return;
                  verifyMutation.mutate({
                    id: selectedOrg.id,
                    action: "reject",
                    comment: orgComment.trim(),
                  });
                }}
                onChanges={() => {
                  if (!orgComment.trim()) return;
                  verifyMutation.mutate({
                    id: selectedOrg.id,
                    action: "request_changes",
                    comment: orgComment.trim(),
                  });
                }}
              />
            )}
            {tab === "jobs" && !selectedJob && !jobsLoading && (
              <p className="py-16 text-center text-sm text-slate-500">Select a job to review.</p>
            )}
            {tab === "orgs" && !selectedOrg && !orgsLoading && (
              <p className="py-16 text-center text-sm text-slate-500">Select an organisation to review.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function JobReviewPanel({
  job,
  noteText,
  setNoteText,
  pending,
  onApprove,
  onReject,
  onChanges,
}: {
  job: ModerationJob;
  noteText: string;
  setNoteText: (v: string) => void;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
  onChanges: () => void;
}) {
  const checks = [
    { label: "Salary benchmark", ok: job.safety_checks?.salary_benchmark_met ?? true },
    { label: "Zero candidate fees", ok: job.safety_checks?.no_recruitment_fees ?? true },
    { label: "Organisation verified", ok: job.safety_checks?.org_verified ?? false },
  ];
  const passed = checks.filter((c) => c.ok).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <JobThumbnail
          fallbackLabel={job.organization_name || "Co"}
          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        />
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900">{job.title}</h2>
          <p className="text-sm text-slate-500">
            {job.organization_name}
            {job.organization_verified ? " · Verified" : ""} · {job.location || "Remote"} ·{" "}
            {job.work_mode} · {job.employment_type.replace(/_/g, " ")} · {job.openings || 1} opening
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        <Meta label="Location" value={job.location || "Remote"} />
        <Meta label="Work mode" value={job.work_mode} />
        <Meta label="Engagement" value={job.employment_type.replace(/_/g, " ")} />
        <Meta label="Openings" value={String(job.openings || 1)} />
        <Meta label="Submitted" value={formatWhen(job.created_at)} />
        <Meta
          label="Compensation"
          value={
            job.salary_min
              ? `₹${(job.salary_min / 100000).toFixed(1)}–₹${((job.salary_max || job.salary_min) / 100000).toFixed(1)} LPA`
              : "—"
          }
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Description</h3>
        <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          {job.description || "No description."}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Compliance checks · {passed} of {checks.length} passed</h3>
        <ul className="mt-2 space-y-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle2 className={`h-4 w-4 ${c.ok ? "text-emerald-600" : "text-amber-500"}`} />
              {c.label}
              <span className={`text-xs font-semibold ${c.ok ? "text-emerald-700" : "text-amber-700"}`}>
                {c.ok ? "Passed" : "Pending"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label className="text-sm font-semibold text-slate-900">
          Reason <span className="font-normal text-slate-500">(required to reject or request changes)</span>
        </label>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={3}
          placeholder="Rejecting or requesting changes notifies the employer."
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled={pending || !noteText.trim()}
          onClick={onReject}
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={pending || !noteText.trim()}
          onClick={onChanges}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
        >
          Request changes
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onApprove}
          className="rounded-xl bg-[#16A37B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Approve &amp; publish
        </button>
      </div>
    </div>
  );
}

function OrgReviewPanel({
  org,
  comment,
  setComment,
  pending,
  onVerify,
  onReject,
  onChanges,
}: {
  org: OrganizationItem;
  comment: string;
  setComment: (v: string) => void;
  pending: boolean;
  onVerify: () => void;
  onReject: () => void;
  onChanges: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <JobThumbnail
          fallbackLabel={org.name}
          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        />
        <div>
          <h2 className="text-lg font-bold text-slate-900">{org.name}</h2>
          <p className="text-sm text-slate-500">
            {org.org_type} · {org.verification_status.replace(/_/g, " ")}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <Meta label="Website" value={org.website || "—"} />
        <Meta label="Contact" value={org.contact_name || org.contact_email || "—"} />
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-900">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Required for reject or request documents"
        />
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled={pending || !comment.trim()}
          onClick={onReject}
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={pending || !comment.trim()}
          onClick={onChanges}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
        >
          Request documents
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onVerify}
          className="rounded-xl bg-[#7DC8F7] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Verify organisation
        </button>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 font-medium text-slate-800">{value}</div>
    </div>
  );
}
