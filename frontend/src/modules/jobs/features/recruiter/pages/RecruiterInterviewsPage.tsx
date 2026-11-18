import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, type ApiResponse } from '../../../services/api';

type ScheduledInterview = {
  id: string;
  application_id: string;
  candidate_name?: string;
  job_title?: string;
  round_name: string;
  format: string;
  starts_at: string;
  ends_at: string;
  status: string;
  meeting_link?: string;
  instructions?: string;
  feedback?: {
    technical_skills: number;
    problem_solving: number;
    communication: number;
    culture_fit: number;
    comments: string;
    recommendation: string;
  };
};

type QueueCandidate = {
  id: string;
  student_name?: string;
  job_title?: string;
  status: string;
};

type RescheduleRequest = {
  id: string;
  interview_id: string;
  proposed_starts_at: string;
  proposed_ends_at: string;
  reason?: string;
  status: string;
};

export function RecruiterInterviewsPage() {
  const qc = useQueryClient();

  // Schedule Form State
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [roundName, setRoundName] = useState('Technical Round 1');
  const [format, setFormat] = useState('ONLINE');
  const [startDate, setStartDate] = useState('2026-11-20T10:00');
  const [endDate, setEndDate] = useState('2026-11-20T11:00');
  const [meetingLink, setMeetingLink] = useState('https://meet.google.com/xyz-123');
  const [instructions, setInstructions] = useState('Please ensure camera is turned on and keep your project repository ready.');
  const [scheduleSuccess, setScheduleSuccess] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  // Scorecard State
  const [selectedInterviewId, setSelectedInterviewId] = useState<string>('');
  const [technicalSkills, setTechnicalSkills] = useState(5);
  const [problemSolving, setProblemSolving] = useState(4);
  const [communication, setCommunication] = useState(5);
  const [cultureFit, setCultureFit] = useState(4);
  const [comments, setComments] = useState('Candidate demonstrated strong technical problem solving skills and clear communication.');
  const [recommendation, setRecommendation] = useState('Recommend for hire');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  // Fetch candidate queue to populate application selector
  const { data: queueData } = useQuery({
    queryKey: ['recruiter-queue'],
    queryFn: () => apiFetch<ApiResponse<QueueCandidate[]>>('/jobs/recruiter/applications'),
  });
  const candidates = queueData?.data || [];

  // Fetch interviews list
  const { data: interviewsData } = useQuery({
    queryKey: ['recruiter-interviews'],
    queryFn: () => apiFetch<ApiResponse<ScheduledInterview[]>>('/jobs/recruiter/interviews'),
  });
  const interviews = interviewsData?.data || [];

  const { data: rescheduleData, refetch: refetchReschedule } = useQuery({
    queryKey: ['recruiter-reschedule-requests'],
    queryFn: () => apiFetch<ApiResponse<RescheduleRequest[]>>('/jobs/recruiter/reschedule-requests'),
  });
  const pendingReschedules = rescheduleData?.data || [];

  const respondReschedule = useMutation({
    mutationFn: ({ id, approve, comment }: { id: string; approve: boolean; comment?: string }) =>
      apiFetch(`/interviews/reschedule-requests/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ approve, comment }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruiter-interviews'] });
      refetchReschedule();
    },
  });

  const activeInterview = interviews.find((i) => i.id === (selectedInterviewId || interviews[0]?.id)) || interviews[0];

  // Schedule Mutation
  const scheduleMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/applications/${selectedAppId || candidates[0]?.id}/interviews`, {
        method: 'POST',
        body: JSON.stringify({
          round_name: roundName.trim(),
          format,
          starts_at: new Date(startDate).toISOString(),
          ends_at: new Date(endDate).toISOString(),
          timezone: 'Asia/Kolkata',
          meeting_link: meetingLink.trim() || undefined,
          instructions: instructions.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruiter-interviews'] });
      qc.invalidateQueries({ queryKey: ['recruiter-queue'] });
      setScheduleSuccess('Interview invite successfully scheduled and candidate notified.');
      setScheduleError('');
    },
    onError: (err: Error) => {
      setScheduleError(err.message);
      setScheduleSuccess('');
    },
  });

  const handleSchedule = () => {
    setScheduleError('');
    setScheduleSuccess('');

    if (!startDate || !endDate) {
      setScheduleError('Please specify both interview start and end times.');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setScheduleError('Interview end time must be chronologically after the start time.');
      return;
    }

    scheduleMutation.mutate();
  };

  // Scorecard Mutation
  const scorecardMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/interviews/${activeInterview?.id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          technical_skills: technicalSkills,
          problem_solving: problemSolving,
          communication,
          culture_fit: cultureFit,
          comments,
          recommendation,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruiter-interviews'] });
      setFeedbackSuccess('Scorecard and evaluation successfully saved.');
      setFeedbackError('');
    },
    onError: (err: Error) => {
      setFeedbackError(err.message);
      setFeedbackSuccess('');
    },
  });

  const renderRatingButtons = (value: number, onChange: (v: number) => void) => (
    <div className="flex gap-1.5 mt-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`h-9 w-9 rounded-lg border text-xs font-bold transition ${
            value === n
              ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Interviews</h1>
        <p className="text-sm text-slate-500">Coordinate interview rounds, handle student reschedule requests, and log structured scorecards.</p>
      </div>

      {/* Reschedule Requests Alert Banner */}
      {pendingReschedules.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
            Pending Student Reschedule Requests ({pendingReschedules.length})
          </div>
          {pendingReschedules.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/60 pt-2 text-xs">
              <div>
                <span className="font-semibold text-slate-800">Proposed:</span>{' '}
                {new Date(r.proposed_starts_at).toLocaleString()} – {new Date(r.proposed_ends_at).toLocaleTimeString()}
                {r.reason && <span className="text-slate-500 ml-2">({r.reason})</span>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={respondReschedule.isPending}
                  onClick={() => respondReschedule.mutate({ id: r.id, approve: true })}
                  className="rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={respondReschedule.isPending}
                  onClick={() => respondReschedule.mutate({ id: r.id, approve: false, comment: 'Unable to accommodate proposed time.' })}
                  className="rounded border border-red-200 bg-red-50 px-3 py-1.5 font-semibold text-red-700"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Schedule Interview Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Schedule Interview Round</h2>
            <span className="text-xs text-indigo-600 font-semibold">New Invite</span>
          </div>

          {scheduleSuccess && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
              ✓ {scheduleSuccess}
            </div>
          )}
          {scheduleError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 font-medium">
              ⚠️ {scheduleError}
            </div>
          )}

          <div className="space-y-3.5">
            <div>
              <label htmlFor="rec-candidate-app" className="block text-xs font-semibold uppercase text-slate-600">Candidate / Application *</label>
              <select
                id="rec-candidate-app"
                value={selectedAppId || candidates[0]?.id || ''}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                {candidates.length === 0 ? (
                  <option value="">No candidate queue available</option>
                ) : (
                  candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.student_name} · {c.job_title} ({c.status})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rec-round-title" className="block text-xs font-semibold uppercase text-slate-600">Round Title</label>
                <input
                  id="rec-round-title"
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value)}
                  placeholder="e.g. Technical Round 1"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="rec-round-format" className="block text-xs font-semibold uppercase text-slate-600">Format</label>
                <select
                  id="rec-round-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ONLINE">Online Meeting</option>
                  <option value="IN_PERSON">In Person / On-site</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rec-start-date" className="block text-xs font-semibold uppercase text-slate-600">Start Time</label>
                <input
                  id="rec-start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="rec-end-date" className="block text-xs font-semibold uppercase text-slate-600">End Time</label>
                <input
                  id="rec-end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="rec-meeting-link" className="block text-xs font-semibold uppercase text-slate-600">Meeting Link / Room</label>
              <input
                id="rec-meeting-link"
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/xyz-123"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="rec-instructions" className="block text-xs font-semibold uppercase text-slate-600">Instructions for Candidate</label>
              <textarea
                id="rec-instructions"
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Preparation notes..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={scheduleMutation.isPending || candidates.length === 0}
              onClick={handleSchedule}
              className="mt-2 w-full rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-xs"
            >
              {scheduleMutation.isPending ? 'Scheduling…' : 'Send Interview Invite'}
            </button>
          </div>
        </div>

        {/* Right Column: Scorecard & Feedback */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Scorecard &amp; Panel Feedback</h2>
            <span className="text-xs text-slate-400">1 (Poor) to 5 (Excellent)</span>
          </div>

          {feedbackSuccess && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
              ✓ {feedbackSuccess}
            </div>
          )}
          {feedbackError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 font-medium">
              ⚠️ {feedbackError}
            </div>
          )}

          <div className="space-y-3.5">
            <div>
              <label htmlFor="scorecard-interview-select" className="block text-xs font-semibold uppercase text-slate-600">Select Interview Round *</label>
              <select
                id="scorecard-interview-select"
                value={activeInterview?.id || ''}
                onChange={(e) => setSelectedInterviewId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                {interviews.length === 0 ? (
                  <option value="">No completed or scheduled rounds</option>
                ) : (
                  interviews.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.candidate_name || 'Candidate'} — {i.round_name} ({new Date(i.starts_at).toLocaleDateString()})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Scorecard Rubric Buttons */}
            <div className="grid grid-cols-2 gap-3.5 border-t border-slate-100 pt-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">Technical Skills</label>
                {renderRatingButtons(technicalSkills, setTechnicalSkills)}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">Problem Solving</label>
                {renderRatingButtons(problemSolving, setProblemSolving)}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">Communication</label>
                {renderRatingButtons(communication, setCommunication)}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">Culture Fit</label>
                {renderRatingButtons(cultureFit, setCultureFit)}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <div>
                <label htmlFor="scorecard-recommendation" className="block text-xs font-semibold uppercase text-slate-600">Overall Recommendation</label>
                <select
                  id="scorecard-recommendation"
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Strong hire">Strong hire</option>
                  <option value="Recommend for hire">Recommend for hire</option>
                  <option value="Neutral / On the fence">Neutral / On the fence</option>
                  <option value="Do not recommend">Do not recommend</option>
                </select>
              </div>

              <div>
                <label htmlFor="scorecard-comments" className="block text-xs font-semibold uppercase text-slate-600">Evaluation Comments &amp; Summary</label>
                <textarea
                  id="scorecard-comments"
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={scorecardMutation.isPending || !activeInterview}
              onClick={() => scorecardMutation.mutate()}
              className="mt-2 w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs"
            >
              {scorecardMutation.isPending ? 'Saving Evaluation…' : 'Submit Scorecard Evaluation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
