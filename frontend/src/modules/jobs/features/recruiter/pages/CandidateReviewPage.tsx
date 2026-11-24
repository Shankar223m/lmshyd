import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LIVE_LIST_QUERY_OPTIONS } from '../../../lib/liveQueryOptions';
import { apiFetch, filesApi, type ApiResponse } from '../../../services/api';

type CandidateApplication = {
  id: string;
  job_id: string;
  job_title?: string;
  employer_name?: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  program?: string;
  graduation_year?: number;
  cgpa?: number;
  location?: string;
  skills?: string[];
  job_skills?: string[];
  institution_name?: string;
  status: string;
  pipeline_stage?: string;
  match_percent?: number;
  answers?: Record<string, string>;
  resume_file_id?: string;
  internal_note?: string;
  created_at?: string;
};

export function CandidateReviewPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [noteText, setNoteText] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadResume = async (fileId: string, studentName?: string) => {
    try {
      setDownloading(true);
      setDownloadError(null);
      await filesApi.openDownload(fileId, `${(studentName || 'Candidate').replace(/\s+/g, '_')}_Resume.pdf`);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Failed to download resume');
    } finally {
      setDownloading(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-queue'],
    queryFn: () => apiFetch<ApiResponse<CandidateApplication[]>>('/recruiter/applications'),
    ...LIVE_LIST_QUERY_OPTIONS,
  });

  const apps = data?.data || [];
  const filteredApps = apps.filter(
    (a) =>
      !search ||
      (a.student_name && a.student_name.toLowerCase().includes(search.toLowerCase())) ||
      (a.job_title && a.job_title.toLowerCase().includes(search.toLowerCase()))
  );

  const current = apps.find((a) => a.id === (selectedId || apps[0]?.id)) || apps[0];

  // Sync internal note text when current changes
  const [syncedAppId, setSyncedAppId] = useState<string | null>(null);
  if (current && current.id !== syncedAppId) {
    setNoteText(current.internal_note || '');
    setSyncedAppId(current.id);
  }

  // Mutations
  const shortlistMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/applications/${id}/shortlist`, { method: 'POST', body: '{}' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruiter-queue'] }),
  });

  const holdMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/applications/${id}/hold`, { method: 'POST', body: '{}' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruiter-queue'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/applications/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ to_status: 'REJECTED', reason: reason.trim() }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruiter-queue'] });
      setShowRejectModal(false);
    },
  });

  const saveNoteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiFetch(`/applications/${id}/note`, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim() }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruiter-queue'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Screening</h1>
        <p className="text-sm text-slate-500">Review submitted applications, verify requirements match, and shortlist candidates.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: Applicants list (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <input
            type="text"
            placeholder="Search candidate or job…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none shadow-xs"
          />

          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading screening queue…</div>
          ) : filteredApps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
              No candidates awaiting screening.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredApps.map((a) => {
                const isSelected = (current?.id === a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(a.id);
                      setNoteText(a.internal_note || '');
                    }}
                    className={`w-full text-left rounded-xl border p-4 transition shadow-xs ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{a.student_name || 'Applicant'}</div>
                        <div className="text-xs text-slate-500">{a.job_title}</div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          (a.match_percent ?? 0) >= 80
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {a.match_percent ?? 0}% match
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2">
                      <span>{a.program || 'Student'}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 uppercase text-[10px] font-semibold">
                        {a.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Detailed Candidate Review (7 cols) */}
        <div className="lg:col-span-7">
          {current ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{current.student_name}</h2>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Applied for <span className="font-semibold text-slate-800">{current.job_title}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {current.student_email} · {current.location || 'Bengaluru'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center">
                    <div className="text-[10px] font-bold uppercase text-emerald-700">Compatibility</div>
                    <div className="text-base font-extrabold text-emerald-800">{current.match_percent ?? 0}%</div>
                  </span>
                </div>
              </div>

              {/* Academic Details */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Academic &amp; Profile Summary</h3>
                <div className="mt-2.5 grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Degree / Program</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">{current.program || 'B.Tech CSE'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">CGPA</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">{current.cgpa !== undefined && current.cgpa !== null ? `${current.cgpa} / 10.0` : 'N/A'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Graduation Year</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">{current.graduation_year || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Skills Section - Distinguishing Job Required Skills vs Candidate Profile Skills */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Role Required Skills</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {current.job_skills && current.job_skills.length > 0 ? (
                      current.job_skills.map((s) => (
                        <span key={s} className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700">
                          ✓ {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">No specific required skills listed for this job.</span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Candidate Profile Skills</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {current.skills && current.skills.length > 0 ? (
                      current.skills.map((s) => (
                        <span key={s} className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                          • {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">No profile skills listed by candidate.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Application Questionnaire */}
              {current.answers && Object.keys(current.answers).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Candidate Answers</h3>
                  <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3.5 space-y-2 text-xs">
                    {Object.entries(current.answers).map(([q, ans]) => (
                      <div key={q}>
                        <div className="font-semibold text-slate-700 capitalize">{q}:</div>
                        <div className="text-slate-600 mt-0.5">{ans}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resume download / preview */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Resume / Documents</h3>
                <div className="mt-2.5 flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs bg-white">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📄</span>
                    <div>
                      <div className="font-semibold text-slate-800">{current.student_name}_Resume.pdf</div>
                      <div className="text-[10px] text-slate-400">Verified student profile document</div>
                    </div>
                  </div>
                  {current.resume_file_id ? (
                    <button
                      type="button"
                      disabled={downloading}
                      onClick={() => handleDownloadResume(current.resume_file_id!, current.student_name)}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {downloading ? (
                        <>
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                          Downloading...
                        </>
                      ) : (
                        'Download PDF'
                      )}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Document on file</span>
                  )}
                </div>
                {downloadError && (
                  <p className="mt-1.5 text-xs text-rose-600 font-medium">⚠️ {downloadError}</p>
                )}
              </div>

              {/* Internal Notes */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Team Internal Notes (Confidential)</h3>
                <div className="mt-2.5 space-y-2">
                  <textarea
                    rows={2}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add notes for your hiring team…"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={saveNoteMutation.isPending}
                      onClick={() => saveNoteMutation.mutate({ id: current.id, note: noteText })}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {saveNoteMutation.isPending ? 'Saving…' : 'Save note'}
                    </button>
                    {saveNoteMutation.isSuccess && (
                      <span className="text-xs text-emerald-600 font-medium">✓ Note saved</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                >
                  Reject
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={holdMutation.isPending}
                    onClick={() => holdMutation.mutate(current.id)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Put on hold
                  </button>
                  <button
                    type="button"
                    disabled={shortlistMutation.isPending}
                    onClick={() => shortlistMutation.mutate(current.id)}
                    className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    Shortlist candidate
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
              Select a candidate from the queue to inspect application.
            </div>
          )}
        </div>
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reject Candidate Application</h3>
            <p className="text-xs text-slate-500">
              Provide an internal or candidate-facing feedback reason for declining {current.student_name}.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Does not meet minimum required programming prerequisites..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: current.id, reason: rejectReason })}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
