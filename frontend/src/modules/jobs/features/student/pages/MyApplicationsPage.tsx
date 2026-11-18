import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Send,
  Hourglass,
  CheckCircle2,
  XCircle,
  ArrowRight,
  MapPin,
  X,
  AlertTriangle,
  FileText,
  Search,
  Calendar,
} from "lucide-react";
import { JobThumbnail } from '../../../components/JobThumbnail';
import { apiFetch, type ApiResponse } from '../../../services/api';

type StudentApplication = {
  id: string;
  job_id: string;
  job_title?: string;
  employer_name?: string;
  location?: string;
  status: string;
  pipeline_stage?: string;
  match_percent?: number;
  answers?: Record<string, string>;
  created_at?: string;
};

export function MyApplicationsPage() {
  const [filterText, setFilterText] = useState('');
  const [selectedApp, setSelectedApp] = useState<StudentApplication | null>(null);
  const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ["my-apps"],
    queryFn: () => apiFetch<ApiResponse<StudentApplication[]>>("/applications/me"),
  });

  const { data: interviewsData } = useQuery({
    queryKey: ["my-interviews", "apps-banner"],
    queryFn: () => apiFetch<ApiResponse<Array<{ id: string; round_name: string; starts_at: string }>>>("/interviews/me"),
  });
  const upcomingInterviewCount =
    interviewsData?.data?.filter((i) => new Date(i.starts_at) >= new Date()).length ?? 0;

  const qc = useQueryClient();

  const withdraw = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/applications/${id}/withdraw`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      setWithdrawError('');
      setConfirmWithdrawId(null);
      qc.invalidateQueries({ queryKey: ['my-apps'] });
    },
    onError: (err: Error) => {
      setWithdrawError(err.message || 'Withdrawal failed. Please try again.');
      setConfirmWithdrawId(null);
    },
  });

  const canWithdraw = (status: string) =>
    !['REJECTED', 'WITHDRAWN', 'SELECTED'].includes(status);

  const apps = data?.data || [];

  const filteredApps = apps.filter((a) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      a.job_title?.toLowerCase().includes(q) ||
      a.employer_name?.toLowerCase().includes(q) ||
      a.status?.toLowerCase().includes(q)
    );
  });

  // Calculate the 4 KPI card stats (matching reference UI)
  const totalCount = apps.length;
  const underReviewCount = apps.filter((a) =>
    ['SUBMITTED', 'IN_REVIEW', 'SCREENING', 'UNDER_REVIEW'].includes(a.status)
  ).length;
  const shortlistedCount = apps.filter((a) =>
    ['SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ISSUED'].includes(a.status)
  ).length;
  const rejectedCount = apps.filter((a) =>
    ['REJECTED', 'WITHDRAWN'].includes(a.status)
  ).length;

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (['SHORTLISTED', 'SELECTED', 'OFFER_ISSUED'].includes(s)) {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/60">
          Shortlisted
        </span>
      );
    }
    if (['REJECTED', 'WITHDRAWN'].includes(s)) {
      return (
        <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 border border-rose-200/60">
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200/60">
        Under Review
      </span>
    );
  };

  return (
    <div className="flex flex-col w-full space-y-7">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">My Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your job applications and their status
          </p>
        </div>

        <Link
          to="/jobs/student/jobs"
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-[#635BFF] hover:bg-[#5046E5] text-white font-semibold text-sm transition-colors shadow-xs"
        >
          <span>Browse Jobs</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* 4 Metric / KPI Cards (Matching Image 2 Reference) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Applications */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Applications</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalCount}</div>
          </div>
        </div>

        {/* Under Review */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Hourglass className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Under Review</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{underReviewCount}</div>
          </div>
        </div>

        {/* Shortlisted */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Shortlisted</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{shortlistedCount}</div>
          </div>
        </div>

        {/* Rejected */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Rejected</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{rejectedCount}</div>
          </div>
        </div>
      </div>

      {upcomingInterviewCount > 0 && (
        <Link
          to="/jobs/student/interviews"
          className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm transition hover:bg-indigo-50"
        >
          <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
            <Calendar className="h-4 w-4 text-[#635BFF]" />
            {upcomingInterviewCount} upcoming interview{upcomingInterviewCount === 1 ? "" : "s"}
          </span>
          <span className="text-xs font-semibold text-[#635BFF]">Open schedule →</span>
        </Link>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search your applications by role or company..."
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200/60 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-300"
          />
        </div>
        <div className="text-xs font-medium text-slate-500">
          Showing {filteredApps.length} of {totalCount} applications
        </div>
      </div>

      {/* Notifications */}
      {withdrawError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{withdrawError}</span>
        </div>
      )}
      {withdraw.isSuccess && !withdrawError && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Application withdrawn successfully.</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#635BFF] border-t-transparent animate-spin" />
          <p className="text-xs text-slate-500">Loading your applications…</p>
        </div>
      )}

      {/* Applications List Table / Card View (Exact layout from reference) */}
      {!isLoading && (
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden divide-y divide-slate-100">
          {filteredApps.length === 0 ? (
            <div className="py-16 px-6 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No applications found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                You haven't submitted any applications matching this filter yet.
              </p>
              <Link
                to="/jobs/student/jobs"
                className="mt-4 px-4 py-2 rounded-lg bg-[#635BFF] text-white text-xs font-semibold hover:bg-[#5046E5] transition"
              >
                Find Jobs
              </Link>
            </div>
          ) : (
            filteredApps.map((a) => {
              const formattedDate = a.created_at
                ? new Date(a.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '10 Oct, 2025';

              return (
                <div
                  key={a.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                >
                  {/* Left: Logo, Title, Company & Location */}
                  <div className="flex items-center gap-4 min-w-0">
                    <JobThumbnail
                      fallbackLabel={a.employer_name || 'Google'}
                      className="w-11 h-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-xs overflow-hidden shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">
                        {a.job_title || 'Software Engineer'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                        <span>{a.employer_name || 'Google'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {a.location || 'Bengaluru, India'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Applied Date, Status Pill, View Details */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                    <div className="text-xs text-slate-400">
                      Applied on {formattedDate}
                    </div>

                    <div>
                      {getStatusBadge(a.status)}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedApp(a)}
                      className="font-semibold text-xs text-[#635BFF] hover:text-[#5046E5] flex items-center gap-1 hover:underline"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Application Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <JobThumbnail
                  fallbackLabel={selectedApp.employer_name || 'CO'}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-xs shrink-0"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Application Details</h3>
                  <span className="text-[11px] text-slate-400">ID: APP-{selectedApp.id.slice(0, 8).toUpperCase()}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Target Role</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">{selectedApp.job_title}</p>
                <p className="text-slate-500">{selectedApp.employer_name}</p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status:</span>
                  {getStatusBadge(selectedApp.status)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Pipeline Stage:</span>
                  <span className="font-semibold text-slate-900">{selectedApp.pipeline_stage || 'Application Intake'}</span>
                </div>
                {selectedApp.created_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Submitted On:</span>
                    <span className="text-slate-800">{new Date(selectedApp.created_at).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {selectedApp.answers && Object.keys(selectedApp.answers).length > 0 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Screening Answers</span>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {Object.entries(selectedApp.answers).map(([q, ans]) => (
                      <div key={q} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="font-semibold text-slate-800">{q}</div>
                        <div className="text-slate-600 mt-0.5">{ans}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {canWithdraw(selectedApp.status) ? (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedApp.id;
                    setSelectedApp(null);
                    setConfirmWithdrawId(id);
                  }}
                  className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors"
                >
                  Withdraw Application
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Confirmation Modal */}
      {confirmWithdrawId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Withdraw Application?</h3>
                <p className="text-xs text-slate-500">This will cancel your candidacy for this role.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to withdraw your application?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmWithdrawId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => withdraw.mutate(confirmWithdrawId)}
                disabled={withdraw.isPending}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
              >
                {withdraw.isPending ? 'Withdrawing…' : 'Confirm Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
