import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Search,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { JobThumbnail } from '../../../components/JobThumbnail';
import { apiFetch, type ApiResponse } from '../../../services/api';

type OrganizationItem = {
  id: string;
  name: string;
  org_type: string;
  verification_status: string;
  verification_comment?: string;
  registration_number?: string;
  website?: string;
  contact_name?: string;
  contact_email?: string;
  size_band?: string;
};

export function OrganisationVerificationPage() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EMPLOYER' | 'INSTITUTION'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<OrganizationItem | null>(null);
  const [actionType, setActionType] = useState<'verify' | 'request_changes' | 'reject' | null>(null);
  const [commentText, setCommentText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-organizations', typeFilter],
    queryFn: () =>
      apiFetch<ApiResponse<OrganizationItem[]>>(
        `/admin/organizations${typeFilter !== 'ALL' ? `?org_type=${typeFilter}` : ''}`
      ),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, action, comment }: { id: string; action: string; comment?: string }) =>
      apiFetch(`/admin/organizations/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ action, comment }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-organizations'] });
      setSelectedOrg(null);
      setActionType(null);
      setCommentText('');
    },
  });

  const allOrgs = data?.data || [];
  const orgs = allOrgs.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.name.toLowerCase().includes(q) || (o.registration_number || '').toLowerCase().includes(q);
  });

  const verifiedCount = allOrgs.filter((o) => o.verification_status === 'VERIFIED').length;

  return (
    <div className="flex flex-col w-full space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">Organisation Verification</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review corporate entity credentials and authorize campus recruitment privileges
          </p>
        </div>

        {/* Stats Pill */}
        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-xs text-xs font-medium text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Verified Entities: <strong className="text-slate-900">{verifiedCount}</strong></span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="inline-flex p-1 bg-slate-100 rounded-lg">
          {[
            ['ALL', 'All Organisations'],
            ['EMPLOYER', 'Employers'],
            ['INSTITUTION', 'Institutions'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key as 'ALL' | 'EMPLOYER' | 'INSTITUTION')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                typeFilter === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or registration number…"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200/60 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-300"
          />
        </div>
      </div>

      {isLoading && (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#635BFF] border-t-transparent animate-spin" />
          <p className="text-xs text-slate-500">Loading organisation verification queue…</p>
        </div>
      )}

      {/* Organisations List */}
      <div className="space-y-4">
        {orgs.length === 0 && !isLoading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 px-6 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No organisations in this view</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              All registered corporate and educational entities have been verified.
            </p>
          </div>
        ) : (
          orgs.map((o) => (
            <div
              key={o.id}
              className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-sm transition-shadow space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <JobThumbnail
                    fallbackLabel={o.name || 'Org'}
                    className="w-11 h-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-xs overflow-hidden shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">{o.name}</h3>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">{o.org_type}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          o.verification_status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : o.verification_status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        }`}
                      >
                        {o.verification_status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-600 mt-3">
                      <div>
                        <span className="text-slate-400 font-medium block text-[11px]">Registration No</span>
                        <span className="font-semibold text-slate-800">{o.registration_number || 'REG-2025-01'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block text-[11px]">Website</span>
                        <a
                          href={o.website ? `https://${o.website}` : '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[#635BFF] hover:underline flex items-center gap-1 truncate"
                        >
                          <span>{o.website || 'website.com'}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block text-[11px]">Contact Lead</span>
                        <span className="font-semibold text-slate-800 truncate block">{o.contact_name || 'HR Lead'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block text-[11px]">Company Size</span>
                        <span className="font-semibold text-slate-800">{o.size_band || '200+ employees'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap sm:flex-col items-end gap-2 shrink-0">
                  {o.verification_status !== 'VERIFIED' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrg(o);
                          setActionType('request_changes');
                        }}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                      >
                        Request Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrg(o);
                          setActionType('reject');
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={verifyMutation.isPending}
                        onClick={() => verifyMutation.mutate({ id: o.id, action: 'verify' })}
                        className="px-4 py-1.5 rounded-lg bg-[#16A37B] hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verify &amp; Approve</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Verification Comment Modal */}
      {selectedOrg && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {actionType === 'request_changes' ? 'Request Documentation Changes' : 'Reject Organisation'}
            </h3>
            <p className="text-xs text-slate-500">
              Provide instructions or justification for <strong className="text-slate-800">{selectedOrg.name}</strong>.
            </p>
            <textarea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="e.g. Please provide authorized incorporation certificate or GST registration..."
              className="w-full rounded-lg border border-slate-200 p-3 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-400"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrg(null);
                  setActionType(null);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={verifyMutation.isPending}
                onClick={() =>
                  verifyMutation.mutate({
                    id: selectedOrg.id,
                    action: actionType,
                    comment: commentText,
                  })
                }
                className={`rounded-lg px-5 py-2 text-xs font-semibold text-white shadow-xs ${
                  actionType === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#635BFF] hover:bg-[#5046E5]'
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
