import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { EmployerActionModal } from "../../../components/EmployerActionModal";
import { LIVE_LIST_QUERY_OPTIONS } from "../../../lib/liveQueryOptions";
import { apiFetch, filesApi, type ApiResponse } from "../../../services/api";

type PipelineCandidate = {
  id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  program?: string;
  cgpa?: number;
  graduation_year?: number;
  institution_name?: string;
  status: string;
  pipeline_stage?: string;
  match_percent?: number;
  answers?: Record<string, string>;
  resume_file_id?: string;
  created_at?: string;
};

type PipelineData = {
  job_id: string;
  stages: string[];
  columns: Record<string, PipelineCandidate[]>;
};

type JobDetail = {
  id: string;
  title: string;
  status: string;
  hiring_stages?: string[];
};

/** Per-job hiring pipeline (stages come from this role's hiring_stages config). */
export function JobHiringPipelinePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const qc = useQueryClient();
  const nav = useNavigate();

  const [selectedCandidate, setSelectedCandidate] = useState<PipelineCandidate | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: jobData, isLoading: jobLoading, error: jobError } = useQuery({
    queryKey: ["job", jobId],
    enabled: !!jobId,
    queryFn: () => apiFetch<ApiResponse<JobDetail>>(`/jobs/${jobId}`),
  });

  const { data: pipelineData, isLoading: pipeLoading } = useQuery({
    queryKey: ["pipeline", jobId],
    enabled: !!jobId,
    queryFn: () => apiFetch<ApiResponse<PipelineData>>(`/jobs/${jobId}/pipeline`),
    ...LIVE_LIST_QUERY_OPTIONS,
  });

  const isPipelineHidden = (status?: string) => {
    const s = (status || "").toUpperCase();
    return s === "WITHDRAWN" || s === "REJECTED";
  };

  const job = jobData?.data;
  const stages = pipelineData?.data.stages || job?.hiring_stages || ["Screening", "Shortlisted", "Assessment", "Interview", "Selected"];
  const rawColumns = pipelineData?.data.columns || {};
  const columns = Object.fromEntries(
    Object.entries(rawColumns).map(([stage, list]) => [
      stage,
      list.filter((c) => !isPipelineHidden(c.status)),
    ]),
  );
  const isLoading = jobLoading || pipeLoading;

  useEffect(() => {
    if (selectedCandidate && isPipelineHidden(selectedCandidate.status)) {
      setSelectedCandidate(null);
      setShowRejectModal(false);
    }
  }, [pipelineData, selectedCandidate]);

  const transitionMutation = useMutation({
    mutationFn: ({ appId, toStatus, stage }: { appId: string; toStatus: string; stage: string }) =>
      apiFetch(`/applications/${appId}/transition`, {
        method: "POST",
        body: JSON.stringify({ to_status: toStatus, pipeline_stage: stage }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pipeline", jobId] });
      setSelectedCandidate(null);
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message || "Could not update this candidate's stage.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ appId, reason }: { appId: string; reason: string }) =>
      apiFetch(`/applications/${appId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || "Candidate not moving forward" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline", jobId] });
      qc.invalidateQueries({ queryKey: ["employer-jobs"] });
      setShowRejectModal(false);
      setSelectedCandidate(null);
      setRejectReason("");
      setRejectError(null);
    },
    onError: (err: Error) => {
      const msg = err.message || "Could not reject this candidate.";
      setRejectError(
        /invalid transition/i.test(msg)
          ? "This application cannot be rejected in its current state (for example, the student may have withdrawn)."
          : msg,
      );
    },
  });

  if (!jobId) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-600">Missing job.</p>
        <Link to="/jobs/employer/pipeline" className="mt-2 inline-block text-sm font-semibold text-indigo-600">
          Back to pipelines
        </Link>
      </div>
    );
  }

  if (jobError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        This pipeline is not available for this role.
        <Link to="/jobs/employer/pipeline" className="mt-2 block font-semibold text-red-900">
          ← All pipelines
        </Link>
      </div>
    );
  }

  const stageToStatus = (stage: string): string => {
    const key = stage.toLowerCase();
    if (key.includes("shortlist")) return "SHORTLISTED";
    if (key.includes("interview")) return "INTERVIEW_SCHEDULED";
    if (key.includes("select")) return "SELECTED";
    if (key.includes("screen")) return "SCREENING";
    if (key.includes("assess")) return "ASSESSMENT";
    return "SCREENING";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/jobs/employer/pipeline"
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All role pipelines
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{job?.title ?? "Role pipeline"}</h1>
          <p className="text-sm text-slate-500">
            Candidates and stages for this job only — not shared with other openings.
          </p>
        </div>
        <Link
          to="/jobs/employer/jobs"
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Manage job posting
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-sm text-slate-500">
          <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          Loading pipeline for this role…
        </div>
      )}

      {!isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-6">
          {stages.map((stage, idx) => {
            const list = columns[stage] || [];
            return (
              <div
                key={stage}
                className="flex w-80 min-w-[280px] shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-100/70 p-3 shadow-2xs"
              >
                <div className="flex items-center justify-between px-1 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-extrabold text-slate-700">
                      {idx + 1}
                    </span>
                    {stage}
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-600 shadow-2xs">
                    {list.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2.5 overflow-y-auto">
                  {list.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
                      No candidates in {stage}
                    </div>
                  ) : (
                    list.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCandidate(c)}
                        className={`cursor-pointer rounded-xl border bg-white p-4 shadow-xs transition hover:border-indigo-400 hover:shadow-md ${
                          selectedCandidate?.id === c.id ? "border-indigo-600 ring-2 ring-indigo-100" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-bold text-slate-900">{c.student_name || "Candidate"}</div>
                            <div className="text-xs text-slate-500">{c.program || "Student"}</div>
                          </div>
                          {c.match_percent !== undefined && (
                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                              {c.match_percent}%
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                          <span>{c.institution_name || "Institute"}</span>
                          <span>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "Recent"}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showRejectModal && selectedCandidate ? (
        <EmployerActionModal
          open
          priority="confirm"
          title="Reject candidate"
          onClose={() => {
            setShowRejectModal(false);
            setRejectError(null);
          }}
        >
          <p className="text-xs text-slate-500">
            Reason for not moving forward with {selectedCandidate.student_name}.
          </p>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="mt-3 w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
          {rejectError ? <p className="mt-2 text-xs font-medium text-red-600">{rejectError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowRejectModal(false);
                setRejectError(null);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
            >
              Back
            </button>
            <button
              type="button"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate({ appId: selectedCandidate.id, reason: rejectReason })}
              className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {rejectMutation.isPending ? "Rejecting…" : "Confirm rejection"}
            </button>
          </div>
        </EmployerActionModal>
      ) : null}

      {selectedCandidate && !showRejectModal ? (
        <EmployerActionModal
          open
          title={selectedCandidate.student_name || "Candidate"}
          onClose={() => {
            setSelectedCandidate(null);
            setActionError(null);
          }}
        >
          <p className="text-xs text-slate-500">
            {selectedCandidate.student_email} · {selectedCandidate.program}
          </p>

          {selectedCandidate.resume_file_id ? (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="text-xs font-bold uppercase text-slate-500">Resume</div>
              <button
                type="button"
                disabled={downloading}
                onClick={async () => {
                  try {
                    setDownloading(true);
                    await filesApi.openDownload(
                      selectedCandidate.resume_file_id!,
                      `${(selectedCandidate.student_name || "Candidate").replace(/\s+/g, "_")}_Resume.pdf`,
                    );
                  } finally {
                    setDownloading(false);
                  }
                }}
                className="mt-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                {downloading ? "Opening…" : "Download resume"}
              </button>
            </div>
          ) : null}

          {actionError ? <p className="mt-3 text-xs font-medium text-red-600">{actionError}</p> : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setRejectError(null);
                setShowRejectModal(true);
              }}
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Reject candidate
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const q = new URLSearchParams({
                    applicationId: selectedCandidate.id,
                    ...(jobId ? { jobId } : {}),
                  });
                  setSelectedCandidate(null);
                  nav(`/jobs/employer/offers/new?${q.toString()}`);
                }}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                Create offer →
              </button>
              <button
                type="button"
                disabled={transitionMutation.isPending}
                onClick={() => {
                  const fallback = stages[0] ?? "Screening";
                  const stageKey = selectedCandidate.pipeline_stage || fallback;
                  let currentIndex = stages.indexOf(stageKey);
                  if (currentIndex < 0) currentIndex = stages.findIndex((s) => s.toLowerCase() === stageKey.toLowerCase());
                  if (currentIndex < 0) currentIndex = 0;
                  const nextStage = stages[Math.min(currentIndex + 1, stages.length - 1)] ?? fallback;
                  if (nextStage === stageKey) {
                    setActionError("Candidate is already in the final stage for this role.");
                    return;
                  }
                  transitionMutation.mutate({
                    appId: selectedCandidate.id,
                    toStatus: stageToStatus(nextStage),
                    stage: nextStage,
                  });
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60"
              >
                Advance to next stage
              </button>
            </div>
          </div>
        </EmployerActionModal>
      ) : null}
    </div>
  );
}