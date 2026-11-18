import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Edit3,
  MapPin,
  Briefcase,
  X,
} from 'lucide-react';
import { JobThumbnail } from '../../../components/JobThumbnail';
import { apiFetch, type ApiResponse } from '../../../services/api';

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
  safety_checks?: {
    salary_benchmark_met: boolean;
    no_recruitment_fees: boolean;
    duplicate_detected: boolean;
    org_verified: boolean;
  };
};

export function JobModerationPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'queue' | 'flagged' | 'decided'>('queue');
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState<ModerationJob | null>(null);
  const [previewJob, setPreviewJob] = useState<ModerationJob | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'request_changes' | 'reject' | null>(null);
  const [noteText, setNoteText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-jobs', tab],
    queryFn: () => apiFetch<ApiResponse<ModerationJob[]>>(`/admin/jobs?tab=${tab}`),
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      apiFetch(`/admin/jobs/${id}/moderate`, {
        method: 'POST',
        body: JSON.stringify({ action, note }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-jobs'] });
      setSelectedJob(null);
      setActionType(null);
      setNoteText('');
    },
  });

  const allJobs = data?.data || [];
  const jobs = allJobs.filter((j) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return j.title.toLowerCase().includes(q) || (j.organization_name || '').toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col w-full space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">Job Moderation</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review job postings for safety, salary benchmarks, and compliance before publication
          </p>
        </div>

        {/* SLA Pill */}
        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-xs text-xs font-medium text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Compliance SLA: <strong className="text-slate-900">99.4%</strong></span>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="inline-flex p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('queue')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              tab === 'queue' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Review Queue ({tab === 'queue' ? allJobs.length : '—'})
          </button>
          <button
            type="button"
            onClick={() => setTab('flagged')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              tab === 'flagged' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Flagged ({tab === 'flagged' ? allJobs.length : '—'})
          </button>
          <button
            type="button"
            onClick={() => setTab('decided')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              tab === 'decided' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Decided ({tab === 'decided' ? allJobs.length : '—'})
          </button>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or company…"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200/60 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-300"
          />
        </div>
      </div>

      {isLoading && (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#635BFF] border-t-transparent animate-spin" />
          <p className="text-xs text-slate-500">Loading moderation queue…</p>
        </div>
      )}

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.length === 0 && !isLoading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 px-6 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Queue is clear</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              All submitted job postings have been reviewed.
            </p>
          </div>
        ) : (
          jobs.map((j) => (
            <div
              key={j.id}
              className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-sm transition-shadow space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <JobThumbnail
                    fallbackLabel={j.organization_name || 'CO'}
                    className="w-11 h-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-xs overflow-hidden shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">{j.title}</h3>
                      <span className="text-xs font-semibold text-slate-500">{j.organization_name}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          j.status === 'PUBLISHED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : j.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        }`}
                      >
                        {j.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                      {j.description}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-auto">
                  <button
                    type="button"
                    onClick={() => setPreviewJob(j)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  {j.status !== 'PUBLISHED' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJob(j);
                          setActionType('request_changes');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Request Changes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJob(j);
                          setActionType('reject');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                      <button
                        type="button"
                        disabled={moderateMutation.isPending}
                        onClick={() => moderateMutation.mutate({ id: j.id, action: 'approve' })}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#16A37B] hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve &amp; Publish</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Meta details */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {j.location || 'Bengaluru'} • {j.work_mode}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  {j.employment_type.replace(/_/g, ' ')}
                </span>
                {j.salary_min && (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-slate-900">
                      ₹{(j.salary_min / 100000).toFixed(1)}–₹{((j.salary_max || j.salary_min) / 100000).toFixed(1)} LPA
                    </span>
                  </>
                )}
                {j.openings && (
                  <>
                    <span>•</span>
                    <span>{j.openings} Openings</span>
                  </>
                )}
              </div>

              {/* Compliance checks */}
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 flex flex-wrap items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Salary Benchmark Met
                </span>
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Zero Candidate Fees
                </span>
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Org Verified
                </span>
              </div>

              {j.moderation_note && (
                <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200/60">
                  <span className="font-semibold">Note: </span>
                  {j.moderation_note}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Preview Modal */}
      {previewJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{previewJob.title}</h3>
                <div className="text-xs text-slate-500">{previewJob.organization_name}</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewJob(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-60 overflow-y-auto">
                {previewJob.description}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewJob(null)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action / Note Modal */}
      {selectedJob && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {actionType === 'request_changes' ? 'Request Changes to Job Posting' : 'Reject Job Posting'}
            </h3>
            <p className="text-xs text-slate-500">
              Provide feedback for <strong className="text-slate-800">{selectedJob.title}</strong> by {selectedJob.organization_name}.
            </p>
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Please clarify job location and compensation breakdown…"
              className="w-full rounded-lg border border-slate-200 p-3 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-400"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedJob(null);
                  setActionType(null);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={moderateMutation.isPending}
                onClick={() =>
                  moderateMutation.mutate({
                    id: selectedJob.id,
                    action: actionType,
                    note: noteText,
                  })
                }
                className={`rounded-lg px-5 py-2 text-xs font-semibold text-white shadow-xs ${
                  actionType === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#635BFF] hover:bg-[#5046E5]'
                }`}
              >
                {moderateMutation.isPending ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
