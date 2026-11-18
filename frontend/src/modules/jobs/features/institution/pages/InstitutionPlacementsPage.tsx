import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, filesApi, type ApiResponse } from '../../../services/api';

type EvidenceDoc = {
  id: string;
  file_id: string;
  category: string;
  status: string;
  rejection_reason?: string;
};

type InstitutionPlacement = {
  id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  program?: string;
  cgpa?: number;
  graduation_year?: number;
  company_name?: string;
  designation?: string;
  annual_package?: number;
  work_location?: string;
  joining_date?: string;
  evidence_file_id?: string;
  evidence_documents?: EvidenceDoc[];
  status: string;
  verifier_comment?: string;
  submitted_at?: string;
};

type InstitutionPlacementsResponse = {
  stats: {
    students: number;
    placed: number;
    placed_percent: number;
    active_drives: number;
    to_verify: number;
  };
  placements: InstitutionPlacement[];
};

export function InstitutionPlacementsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'PENDING_VERIFICATION' | 'VERIFIED' | 'NEEDS_REVIEW' | 'ALL'>('PENDING_VERIFICATION');
  const [selectedPlacement, setSelectedPlacement] = useState<InstitutionPlacement | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [activeAction, setActiveAction] = useState<'ask_details' | 'reject' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inst-placements', tab],
    queryFn: () =>
      apiFetch<ApiResponse<InstitutionPlacementsResponse>>(
        `/institutions/me/placements${tab !== 'ALL' ? `?status=${tab}` : ''}`
      ),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, action, comment }: { id: string; action: string; comment?: string }) =>
      apiFetch(`/institutions/me/placements/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ action, comment }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inst-placements'] });
      setSelectedPlacement(null);
      setActiveAction(null);
      setActionComment('');
    },
  });

  const reviewDocMutation = useMutation({
    mutationFn: ({
      placementId,
      evidenceId,
      action,
      rejection_reason,
    }: {
      placementId: string;
      evidenceId: string;
      action: string;
      rejection_reason?: string;
    }) =>
      apiFetch(`/placements/${placementId}/evidence/${evidenceId}/review`, {
        method: 'POST',
        body: JSON.stringify({ action, rejection_reason }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inst-placements'] }),
  });

  const stats = data?.data.stats || {
    students: 0,
    placed: 0,
    placed_percent: 0,
    active_drives: 0,
    to_verify: 0,
  };
  const placements = data?.data.placements || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Placements</h1>
        <p className="text-sm text-slate-500">{stats.to_verify} pending verification</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {[
          ['PENDING_VERIFICATION', 'Pending'],
          ['VERIFIED', 'Verified'],
          ['NEEDS_REVIEW', 'Needs review'],
          ['ALL', 'All'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as typeof tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="py-16 text-center text-sm text-slate-500 flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mr-2" />
          Loading placement verification records…
        </div>
      )}

      {/* Verification Queue List */}
      <div className="space-y-4">
        {placements.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
            No placement records in this queue.
          </div>
        ) : (
          placements.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition hover:shadow-sm"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-slate-900">{p.student_name}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      p.status === 'VERIFIED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : p.status === 'PENDING_VERIFICATION'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {p.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">{p.company_name}</span> · {p.designation} · {p.work_location || 'Bengaluru'}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                  <span>Batch: {p.graduation_year || 2026}</span>
                  <span>· Package: <strong className="text-emerald-700">₹{p.annual_package ? (p.annual_package / 100000).toFixed(2) : '11.0'} LPA</strong></span>
                  {p.joining_date && <span>· Joining: {new Date(p.joining_date).toLocaleDateString()}</span>}
                </div>

                {p.verifier_comment && (
                  <div className="mt-2 text-xs text-amber-800 bg-amber-50/70 p-2 rounded border border-amber-100">
                    Remark: {p.verifier_comment}
                  </div>
                )}
              </div>

              {/* Actions & Document */}
              <div className="flex flex-wrap sm:flex-col items-end gap-2.5 shrink-0">
                {p.evidence_documents && p.evidence_documents.length > 0 ? (
                  <div className="mt-2 space-y-1.5 w-full">
                    {p.evidence_documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-800">{doc.category.replace(/_/g, ' ')}</span>
                          <span className="ml-2 text-slate-500">{doc.status}</span>
                          {doc.rejection_reason && (
                            <span className="ml-2 text-amber-700">— {doc.rejection_reason}</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => filesApi.openDownload(doc.file_id).catch(() => undefined)}
                            className="font-semibold text-indigo-600 hover:underline"
                          >
                            View
                          </button>
                          {doc.status === 'PENDING' && p.status !== 'VERIFIED' && (
                            <>
                              <button
                                type="button"
                                disabled={reviewDocMutation.isPending}
                                onClick={() =>
                                  reviewDocMutation.mutate({
                                    placementId: p.id,
                                    evidenceId: doc.id,
                                    action: 'approve',
                                  })
                                }
                                className="text-emerald-700 font-semibold"
                              >
                                Approve doc
                              </button>
                              <button
                                type="button"
                                disabled={reviewDocMutation.isPending}
                                onClick={() => {
                                  const reason = window.prompt('Rejection reason for this document?');
                                  if (reason)
                                    reviewDocMutation.mutate({
                                      placementId: p.id,
                                      evidenceId: doc.id,
                                      action: 'reject',
                                      rejection_reason: reason,
                                    });
                                }}
                                className="text-red-700 font-semibold"
                              >
                                Reject doc
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  p.evidence_file_id && (
                    <button
                      type="button"
                      onClick={() => filesApi.openDownload(p.evidence_file_id!).catch(() => undefined)}
                      className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <span>📄</span> View Letter Proof ↗
                    </button>
                  )
                )}

                {p.status !== 'VERIFIED' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlacement(p);
                        setActiveAction('ask_details');
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Ask for details
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlacement(p);
                        setActiveAction('reject');
                      }}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={verifyMutation.isPending}
                      onClick={() => verifyMutation.mutate({ id: p.id, action: 'verify' })}
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
                    >
                      Verify
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Dialog (Remarks / Rejection) */}
      {selectedPlacement && activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {activeAction === 'ask_details' ? 'Request Details from Student' : 'Reject Placement Evidence'}
            </h3>
            <p className="text-xs text-slate-500">
              {activeAction === 'ask_details'
                ? `Specify missing details or verification questions for ${selectedPlacement.student_name}.`
                : `Provide reason for rejecting placement submission of ${selectedPlacement.student_name}.`}
            </p>
            <textarea
              rows={3}
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              placeholder="Type verification notes here..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPlacement(null);
                  setActiveAction(null);
                }}
                className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={verifyMutation.isPending}
                onClick={() =>
                  verifyMutation.mutate({
                    id: selectedPlacement.id,
                    action: activeAction,
                    comment: actionComment,
                  })
                }
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold text-white shadow-xs ${
                  activeAction === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {verifyMutation.isPending ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
