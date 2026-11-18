import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Video,
  ExternalLink,
  CheckCircle2,
  X,
} from 'lucide-react';
import { JobThumbnail } from '../../../components/JobThumbnail';
import { apiFetch, type ApiResponse } from '../../../services/api';

type StudentInterview = {
  id: string;
  round_name: string;
  job_title: string;
  company_name: string;
  starts_at: string;
  ends_at: string;
  format: string;
  meeting_link?: string;
  instructions?: string;
  status: string;
  outcome?: string;
};

export function MyInterviewsPage() {
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const qc = useQueryClient();

  const reschedule = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/interviews/${id}/reschedule-request`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setRescheduleFor(null);
      setRescheduleError('');
      qc.invalidateQueries({ queryKey: ['my-interviews'] });
    },
    onError: (err: Error) => {
      setRescheduleError(err.message || 'Failed to submit reschedule request');
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['my-interviews'],
    queryFn: () => apiFetch<ApiResponse<StudentInterview[]>>('/interviews/me'),
  });

  const interviews = data?.data || [];
  const now = new Date();

  const upcomingInterviews = interviews.filter(
    (i) => new Date(i.ends_at) >= now && i.status !== 'FEEDBACK_SUBMITTED'
  );
  const pastInterviews = interviews.filter(
    (i) => new Date(i.ends_at) < now || i.status === 'FEEDBACK_SUBMITTED'
  );

  return (
    <div className="flex flex-col w-full space-y-7">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">Interviews</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your upcoming evaluation rounds, live video sessions, and feedback
          </p>
        </div>

        {/* 3 Metric Pills */}
        <div className="flex items-center gap-4 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="px-3 text-center">
            <div className="text-lg font-bold text-[#635BFF]">{upcomingInterviews.length}</div>
            <div className="text-[11px] font-medium text-slate-500">Upcoming</div>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="px-3 text-center">
            <div className="text-lg font-bold text-slate-900">{pastInterviews.length}</div>
            <div className="text-[11px] font-medium text-slate-500">Completed</div>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="px-3 text-center">
            <div className="text-lg font-bold text-emerald-600">100%</div>
            <div className="text-[11px] font-medium text-slate-500">Attendance</div>
          </div>
        </div>
      </div>

      {reschedule.isSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Reschedule request submitted successfully. A coordinator will review your proposed timeslot.</span>
        </div>
      )}

      {isLoading && (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#635BFF] border-t-transparent animate-spin" />
          <p className="text-xs text-slate-500">Loading your scheduled rounds…</p>
        </div>
      )}

      {/* Main Grid: Scheduled Rounds */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Upcoming Sessions</h2>
            <span className="text-xs text-slate-500 font-medium">{upcomingInterviews.length} rounds scheduled</span>
          </div>

          {upcomingInterviews.length === 0 && !isLoading ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 px-6 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No upcoming interviews</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Recruiters will schedule interview sessions after reviewing your applications.
              </p>
            </div>
          ) : (
            upcomingInterviews.map((i) => {
              const sDate = new Date(i.starts_at);
              const eDate = new Date(i.ends_at);

              return (
                <div
                  key={i.id}
                  className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-sm transition-shadow space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <JobThumbnail
                        fallbackLabel={i.company_name || 'Google'}
                        className="w-11 h-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-xs overflow-hidden shrink-0"
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-500">{i.company_name}</span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">{i.round_name}</h3>
                        <div className="text-xs text-slate-600 mt-0.5">Role: {i.job_title}</div>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/60 text-xs font-medium text-[#635BFF] self-start">
                      <Video className="w-3.5 h-3.5" />
                      <span>{i.format || 'Google Meet'}</span>
                    </div>
                  </div>

                  {/* Scheduled Time Strip */}
                  <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="text-slate-500 font-medium">Scheduled Time</div>
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <Clock className="w-3.5 h-3.5 text-[#635BFF]" />
                        <span>
                          {sDate.toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          • {sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {eDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {i.meeting_link ? (
                        <a
                          href={i.meeting_link}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 rounded-lg bg-[#635BFF] hover:bg-[#5046E5] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Join Meeting</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Link pending</span>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setRescheduleFor(i.id);
                          setRescheduleError('');
                          setStartsAt(i.starts_at.slice(0, 16));
                          setEndsAt(i.ends_at.slice(0, 16));
                        }}
                        className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        Reschedule
                      </button>
                    </div>
                  </div>

                  {i.instructions && (
                    <div className="p-3 bg-slate-50/70 rounded-lg text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Preparation note: </span>
                      {i.instructions}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Past Interviews List */}
          {pastInterviews.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Past Interviews</h3>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
                {pastInterviews.map((pi) => (
                  <div key={pi.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{pi.round_name}</div>
                      <div className="text-slate-500 mt-0.5">{pi.company_name} • {pi.job_title}</div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                      Completed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interview Tips & Preparation */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Interview Guidelines</h3>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Test your camera, microphone, and internet connection 10 minutes prior.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Have a digital copy of your resume and project links ready for screenshare.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>Ensure a quiet, well-lit environment free of background noise.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Reschedule Modal */}
      {rescheduleFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Request Reschedule</h3>
              <button
                type="button"
                onClick={() => setRescheduleFor(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rescheduleError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs">
                {rescheduleError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Proposed Start Time</label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Proposed End Time</label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Reason for Rescheduling</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you require a different time slot..."
                  className="w-full p-3 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-400 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRescheduleFor(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  reschedule.mutate({
                    id: rescheduleFor,
                    body: {
                      proposed_starts_at: new Date(startsAt).toISOString(),
                      proposed_ends_at: new Date(endsAt).toISOString(),
                      reason,
                    },
                  })
                }
                disabled={reschedule.isPending || !startsAt || !endsAt || !reason}
                className="px-4 py-2 rounded-lg bg-[#635BFF] hover:bg-[#5046E5] text-white text-xs font-semibold disabled:opacity-50 transition"
              >
                {reschedule.isPending ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
