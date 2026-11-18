import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Download,
  MapPin,
  X,
} from 'lucide-react';
import { JobThumbnail } from '../../../components/JobThumbnail';
import { apiFetch, filesApi, type ApiResponse } from '../../../services/api';

type OfferItem = {
  id: string;
  role_title: string;
  company_name?: string;
  status: string;
  annual_package: number;
  location?: string;
  joining_date?: string;
  respond_by?: string;
  offer_letter_file_id?: string;
};

export function StudentOffersPage() {
  const qc = useQueryClient();
  const [showDeclineModal, setShowDeclineModal] = useState<string | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState<OfferItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-offers'],
    queryFn: () => apiFetch<ApiResponse<OfferItem[]>>('/offers/me'),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      apiFetch(`/offers/${id}/respond`, { method: 'POST', body: JSON.stringify({ accept }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-offers'] });
      qc.invalidateQueries({ queryKey: ['my-placement'] });
      setShowDeclineModal(null);
      setShowAcceptModal(null);
    },
  });

  const offers = data?.data || [];
  const acceptedOffer = offers.find((o) => o.status === 'ACCEPTED');
  const pendingOffers = offers.filter((o) => o.status === 'ISSUED');

  return (
    <div className="flex flex-col w-full space-y-7">
      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">Offers &amp; placement</h1>
          <p className="text-sm text-slate-500 mt-1">
            Respond to offers and submit placement evidence for your institution
          </p>
        </div>
        <Link
          to="/jobs/student/placement"
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Placement evidence →
        </Link>

        {/* Status Pill */}
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200/80 shadow-xs self-start sm:self-auto">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#635BFF] flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Decision Status</div>
            <div className="text-xs font-bold text-slate-900">
              {pendingOffers.length > 0 ? `${pendingOffers.length} Decision Pending` : 'All Responded'}
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#635BFF] border-t-transparent animate-spin" />
          <p className="text-xs text-slate-500">Loading your job offers…</p>
        </div>
      )}

      {/* Accepted Offer Banner */}
      {acceptedOffer && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <div className="font-bold text-sm text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Congratulations! Offer Accepted</span>
            </div>
            <p className="mt-1 text-xs text-emerald-800">
              You accepted the {acceptedOffer.role_title} offer from {acceptedOffer.company_name}. Submit your official placement documents for verification.
            </p>
          </div>
          <Link
            to="/jobs/student/placement"
            className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition"
          >
            Submit Placement Proof →
          </Link>
        </div>
      )}

      {/* Main Grid: Offers & Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          {offers.length === 0 && !isLoading ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 px-6 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No job offers yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Formal offer letters from recruiters will appear here after interview completion.
              </p>
            </div>
          ) : (
            offers.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs hover:shadow-sm transition-shadow space-y-5"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <JobThumbnail
                      fallbackLabel={o.company_name || 'Google'}
                      className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-xs overflow-hidden shrink-0"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-500">
                        {o.company_name || 'Enterprise Recruiter'}
                      </span>
                      <h2 className="text-lg font-bold text-slate-900 mt-0.5">{o.role_title}</h2>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{o.location || 'Bengaluru, India'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        o.status === 'ACCEPTED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : o.status === 'ISSUED'
                          ? 'bg-indigo-50 text-[#635BFF] border border-indigo-200/60'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {o.status === 'ACCEPTED' ? 'Accepted' : o.status === 'ISSUED' ? 'Decision Pending' : o.status}
                    </span>
                  </div>
                </div>

                {/* Offer Details Strip */}
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <div className="text-slate-400 font-medium">Annual Salary</div>
                    <div className="text-base font-bold text-slate-900 mt-0.5">
                      ₹{(o.annual_package / 100000).toFixed(1)} LPA
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Joining Date</div>
                    <div className="font-semibold text-slate-800 mt-1">
                      {o.joining_date ? new Date(o.joining_date).toLocaleDateString() : 'To be confirmed'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Decision Deadline</div>
                    <div className="font-semibold text-slate-800 mt-1">
                      {o.respond_by ? new Date(o.respond_by).toLocaleDateString() : 'Rolling'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Offer Letter</div>
                    <div className="mt-1">
                      {o.offer_letter_file_id ? (
                        <button
                          type="button"
                          onClick={() => filesApi.openDownload(o.offer_letter_file_id!).catch(() => undefined)}
                          className="font-semibold text-[#635BFF] hover:underline flex items-center gap-1"
                        >
                          <span>Download PDF</span>
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-slate-400">Digital Copy</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {o.status === 'ISSUED' && (
                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowDeclineModal(o.id)}
                      className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAcceptModal(o)}
                      className="px-5 py-2.5 rounded-lg bg-[#635BFF] hover:bg-[#5046E5] text-white text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Accept Offer</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right Column: FAQ & Policy */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Offer Acceptance FAQ</h3>
            <div className="space-y-3 text-xs text-slate-600">
              <div>
                <h4 className="font-semibold text-slate-800">What happens when I accept?</h4>
                <p className="mt-0.5">
                  Accepting an offer reserves your position with the employer and records your placement on the portal.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800">Can I apply for higher CTC roles?</h4>
                <p className="mt-0.5">
                  Students holding a standard offer may remain eligible for higher dream offer listings per placement policy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accept Offer Modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Accept Employment Offer</h3>
              <button
                type="button"
                onClick={() => setShowAcceptModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to accept the offer for <strong className="text-slate-900">{showAcceptModal.role_title}</strong> at{' '}
              <strong className="text-slate-900">{showAcceptModal.company_name || 'the recruiter'}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAcceptModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => respondMutation.mutate({ id: showAcceptModal.id, accept: true })}
                disabled={respondMutation.isPending}
                className="px-5 py-2.5 rounded-lg bg-[#635BFF] hover:bg-[#5046E5] text-white text-xs font-semibold transition shadow-xs"
              >
                {respondMutation.isPending ? 'Accepting…' : 'Confirm Acceptance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Offer Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Decline Job Offer?</h3>
              <button
                type="button"
                onClick={() => setShowDeclineModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you wish to decline this offer? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeclineModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => respondMutation.mutate({ id: showDeclineModal, accept: false })}
                disabled={respondMutation.isPending}
                className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-xs"
              >
                {respondMutation.isPending ? 'Declining…' : 'Decline Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
