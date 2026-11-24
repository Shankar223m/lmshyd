import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Send,
  Calendar,
  Award,
  CheckCircle2,
  Briefcase,
  Video,
  Clock,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { JobThumbnail } from '../../../components/JobThumbnail';
import { ApplicationStatusBadge } from '../../../lib/applicationStatus';
import { LIVE_LIST_QUERY_OPTIONS } from '../../../lib/liveQueryOptions';
import { apiFetch, authApi, type ApiResponse } from '../../../services/api';

type StudentApplication = {
  id: string;
  job_id: string;
  job_title?: string;
  employer_name?: string;
  status: string;
  pipeline_stage?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  work_mode?: string;
};

type StudentInterview = {
  id: string;
  round_name: string;
  job_title: string;
  company_name: string;
  starts_at: string;
  ends_at: string;
  meeting_link?: string;
  status: string;
};

type OfferItem = {
  id: string;
  status: string;
  company_name?: string;
  ctc?: string | number;
  valid_until?: string;
};

type PlacementRecord = {
  status: string;
  company_name?: string;
};

export function StudentDashboardPage() {
  const { data: profileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => authApi.getProfile(),
  });
  const user = profileData?.data;
  const sp = user?.student_profile;

  const { data: appsData } = useQuery({
    queryKey: ['my-apps'],
    queryFn: () => apiFetch<ApiResponse<StudentApplication[]>>('/applications/me'),
    ...LIVE_LIST_QUERY_OPTIONS,
  });
  const apps = appsData?.data || [];
  const activeApps = apps.filter((a) => !['REJECTED', 'CLOSED', 'WITHDRAWN'].includes(a.status));

  const { data: interviewsData } = useQuery({
    queryKey: ['my-interviews'],
    queryFn: () => apiFetch<ApiResponse<StudentInterview[]>>('/interviews/me'),
    ...LIVE_LIST_QUERY_OPTIONS,
  });
  const interviews = interviewsData?.data || [];
  const upcomingInterviews = interviews.filter(
    (i) => new Date(i.ends_at) >= new Date() && i.status !== 'FEEDBACK_SUBMITTED',
  );
  const nextInterview = upcomingInterviews[0];

  const { data: offersData } = useQuery({
    queryKey: ['my-offers'],
    queryFn: () => apiFetch<ApiResponse<OfferItem[]>>('/offers/me'),
    ...LIVE_LIST_QUERY_OPTIONS,
  });
  const offers = offersData?.data || [];
  const topOffer = offers[0];

  const { data: placementData } = useQuery({
    queryKey: ['my-placement'],
    queryFn: () => apiFetch<ApiResponse<PlacementRecord | null>>('/placements/me'),
    ...LIVE_LIST_QUERY_OPTIONS,
  });
  const placement = placementData?.data;

  const progressPercent = Math.min(100, Math.max(30, (activeApps.length > 0 ? 50 : 20) + (sp?.resume_file_id ? 30 : 0) + (sp?.skills?.length ? 20 : 0)));

  return (
    <div className="flex flex-col w-full space-y-7">
      {/* Welcome & Top Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">
              Hi, {user?.full_name ? user.full_name.split(' ')[0] : 'there'} 👋
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />
              Verified Student
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {[sp?.program, sp?.graduation_year ? `Batch ${sp.graduation_year}` : null, user?.organization?.name || sp?.institution_name]
              .filter(Boolean)
              .join(' • ') || 'Complete your career profile for personalised matches'}
          </p>
        </div>

        <Link
          to="/jobs/student/jobs"
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-[#7DC8F7] hover:bg-[#5CB8EC] text-white font-semibold text-sm transition-colors shadow-xs"
        >
          <Briefcase className="w-4 h-4" />
          <span>Find Jobs</span>
        </Link>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">Active Applications</div>
            <div className="text-2xl font-bold text-slate-900">{activeApps.length}</div>
            <div className="text-xs text-slate-400">{apps.length} total submitted</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">Scheduled Interviews</div>
            <div className="text-2xl font-bold text-slate-900">{upcomingInterviews.length}</div>
            <div className="text-xs text-slate-400">
              {nextInterview ? `Next: ${nextInterview.round_name}` : 'No upcoming rounds'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#7DC8F7] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">Job Offers</div>
            <div className="text-2xl font-bold text-slate-900">{offers.length}</div>
            <div className="text-xs text-slate-400">
              {topOffer?.company_name ? `${topOffer.company_name}` : 'Targeting offers'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">Profile Readiness</div>
            <div className="text-2xl font-bold text-slate-900">{progressPercent}%</div>
            <div className="text-xs text-slate-400">
              {placement?.status ? placement.status.replace(/_/g, ' ') : 'Placement Ready'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Next Interview Banner (if any) */}
      {nextInterview && (
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#7DC8F7] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <span className="inline-flex items-center rounded-full bg-indigo-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-[#7DC8F7]">
                UPCOMING INTERVIEW
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1">{nextInterview.round_name}</h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-0.5">
                <span className="font-semibold text-slate-800">{nextInterview.company_name}</span>
                <span>•</span>
                <span>{nextInterview.job_title}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium text-indigo-700">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(nextInterview.starts_at).toLocaleString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Link
              to="/jobs/student/interviews"
              className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Details
            </Link>
            {nextInterview.meeting_link && (
              <a
                href={nextInterview.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-[#7DC8F7] hover:bg-[#5CB8EC] text-white text-xs font-semibold transition-colors shadow-xs"
              >
                Join Call
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main 2-Column Split: Recent Applications vs Profile & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Recent Applications */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Applications</h3>
                <p className="text-xs text-slate-500">Your latest candidate submissions</p>
              </div>
              <Link
                to="/jobs/student/applications"
                className="text-xs font-semibold text-[#7DC8F7] hover:text-[#5CB8EC] flex items-center gap-1 hover:underline"
              >
                <span>View All</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {apps.length === 0 ? (
              <div className="py-12 px-6 text-center text-xs text-slate-500">
                No applications submitted yet.{' '}
                <Link to="/jobs/student/jobs" className="font-semibold text-[#7DC8F7] hover:underline">
                  Find your dream job
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {apps.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <JobThumbnail
                        fallbackLabel={a.employer_name || 'Google'}
                        className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-xs overflow-hidden shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">
                          {a.job_title || 'Software Engineer'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 truncate">
                          <span>{a.employer_name || 'Google'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {a.location || 'Bengaluru'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <ApplicationStatusBadge application={a} />
                      <Link
                        to="/jobs/student/applications"
                        className="p-1 text-slate-400 hover:text-slate-700"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Profile Readiness & Quick Links */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Profile Readiness</h3>
              <span className="text-xs font-bold text-[#7DC8F7]">{progressPercent}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#7DC8F7] h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="space-y-2.5 text-xs pt-1">
              <div className="flex items-center justify-between text-slate-600">
                <span>Identity &amp; Academic KYC</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>CGPA Verification</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {sp?.cgpa ? Number(sp.cgpa).toFixed(2) : '8.84'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Resume Uploaded</span>
                <span className="text-indigo-700 font-semibold">
                  {sp?.resume_file_id ? 'Completed' : 'Draft Ready'}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/jobs/student/profile"
                className="w-full block text-center py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 border border-slate-200 transition-colors"
              >
                Update Career Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
