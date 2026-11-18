import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, type ApiResponse } from '../../../services/api';

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

type JobSummary = {
  id: string;
  title: string;
  status: string;
  applicant_count: number;
};

export function HiringPipelinePage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const queryJobId = params.get('jobId') || '';

  const [selectedCandidate, setSelectedCandidate] = useState<PipelineCandidate | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Fetch employer's jobs to populate selector
  const { data: jobsData } = useQuery({
    queryKey: ['employer-jobs'],
    queryFn: () => apiFetch<ApiResponse<{ jobs: JobSummary[] }>>('/employers/me/jobs'),
  });

  const jobs = jobsData?.data.jobs || [];
  const activeJobId = queryJobId || jobs[0]?.id || '';

  useEffect(() => {
    if (!queryJobId && jobs[0]?.id) {
      setParams({ jobId: jobs[0].id });
    }
  }, [queryJobId, jobs, setParams]);

  // Fetch pipeline for active job
  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ['pipeline', activeJobId],
    enabled: !!activeJobId,
    queryFn: () => apiFetch<ApiResponse<PipelineData>>(`/jobs/${activeJobId}/pipeline`),
  });

  const stages = pipelineData?.data.stages || ['Screening', 'Shortlisted', 'Assessment', 'Interview', 'Selected'];
  const columns = pipelineData?.data.columns || {};

  // Mutations
  const transitionMutation = useMutation({
    mutationFn: ({ appId, toStatus, stage }: { appId: string; toStatus: string; stage: string }) =>
      apiFetch(`/applications/${appId}/transition`, {
        method: 'POST',
        body: JSON.stringify({ to_status: toStatus, pipeline_stage: stage }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline', activeJobId] });
      setSelectedCandidate(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ appId, reason }: { appId: string; reason: string }) =>
      apiFetch(`/applications/${appId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ to_status: 'REJECTED', reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline', activeJobId] });
      setShowRejectModal(false);
      setSelectedCandidate(null);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header & Job Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Pipeline</h1>
          <p className="text-sm text-slate-500">Track candidates across evaluation and interview stages.</p>
        </div>

        {/* Job selector dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase text-slate-500">Select Job:</label>
          <select
            value={activeJobId}
            onChange={(e) => setParams({ jobId: e.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-none"
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.applicant_count} applicants)
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex py-16 items-center justify-center text-slate-500 text-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mr-2" />
          Loading candidate pipeline…
        </div>
      )}

      {/* Kanban Pipeline Board */}
      <div className="flex gap-4 overflow-x-auto pb-6">
        {stages.map((stage, idx) => {
          const list = columns[stage] || [];
          return (
            <div
              key={stage}
              className="flex flex-col min-w-[280px] w-80 shrink-0 rounded-xl border border-slate-200 bg-slate-100/70 p-3 shadow-2xs"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 px-1">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-700 font-extrabold">
                    {idx + 1}
                  </span>
                  {stage}
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 border border-slate-200 shadow-2xs">
                  {list.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="space-y-2.5 flex-1 overflow-y-auto">
                {list.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
                    No candidates in {stage}
                  </div>
                ) : (
                  list.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCandidate(c)}
                      className={`cursor-pointer rounded-xl border bg-white p-4 shadow-xs transition hover:shadow-md hover:border-indigo-400 ${
                        selectedCandidate?.id === c.id ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{c.student_name || 'Candidate'}</div>
                          <div className="text-xs text-slate-500">{c.program || 'Student'}</div>
                        </div>
                        {c.match_percent !== undefined && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              c.match_percent >= 80
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : c.match_percent >= 50
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {c.match_percent}%
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2">
                        <span>{c.institution_name || 'Institute'}</span>
                        <span>{c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Recent'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Candidate Detail Modal / Drawer */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 animate-in fade-in duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedCandidate.student_name}</h3>
                <div className="text-xs text-slate-500">
                  {selectedCandidate.student_email} · {selectedCandidate.program}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Match Score</div>
                <div className="text-base font-extrabold text-indigo-600">{selectedCandidate.match_percent ?? 0}%</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">CGPA</div>
                <div className="text-base font-extrabold text-slate-800">{selectedCandidate.cgpa ?? '—'} / 10</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Batch</div>
                <div className="text-base font-extrabold text-slate-800">{selectedCandidate.graduation_year ?? '2026'}</div>
              </div>
            </div>

            {/* Answers */}
            {selectedCandidate.answers && Object.keys(selectedCandidate.answers).length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                <div className="text-xs font-bold uppercase text-slate-500">Application Response</div>
                {Object.entries(selectedCandidate.answers).map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="font-semibold text-slate-700 capitalize">{k}: </span>
                    <span className="text-slate-600">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Reject candidate
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => nav(`/jobs/employer/offers/new?applicationId=${selectedCandidate.id}`)}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  Create offer →
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const fallback = stages[0] ?? 'Applied';
                    const currentIndex = stages.indexOf(selectedCandidate.pipeline_stage || fallback);
                    const nextStage = stages[currentIndex + 1] ?? stages[stages.length - 1] ?? fallback;
                    const toStatus = nextStage === 'Shortlisted' ? 'SHORTLISTED' : nextStage === 'Interview' ? 'INTERVIEW_SCHEDULED' : nextStage === 'Selected' ? 'SELECTED' : 'ASSESSMENT';
                    transitionMutation.mutate({ appId: selectedCandidate.id, toStatus, stage: nextStage });
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
                >
                  Advance to next stage
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedCandidate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Reject Candidate</h3>
            <p className="text-xs text-slate-500">Provide an internal reason for not moving forward with {selectedCandidate.student_name}.</p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Requirements do not match current openings..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => rejectMutation.mutate({ appId: selectedCandidate.id, reason: rejectReason })}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Confirm rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
