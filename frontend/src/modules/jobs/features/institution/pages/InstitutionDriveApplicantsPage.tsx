import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LIVE_LIST_QUERY_OPTIONS } from '../../../lib/liveQueryOptions';
import { apiFetch, type ApiResponse } from '../../../services/api';

type ApplicantRow = {
  id: string;
  student_name?: string;
  student_email?: string;
  program?: string;
  cgpa?: number;
  status: string;
  pipeline_stage?: string;
  match_percent?: number;
  created_at?: string;
};

type DriveMeta = {
  id: string;
  title: string;
  employer_name?: string;
};

export function InstitutionDriveApplicantsPage() {
  const { jobId } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['inst-drive-apps', jobId],
    enabled: !!jobId,
    ...LIVE_LIST_QUERY_OPTIONS,
    queryFn: async () => {
      const [apps, dash] = await Promise.all([
        apiFetch<ApiResponse<ApplicantRow[]>>(`/institutions/me/campus-drives/${jobId}/applications`),
        apiFetch<ApiResponse<{ drives: DriveMeta[] }>>('/institutions/me/placement-dashboard'),
      ]);
      const drive = dash.data?.drives?.find((d) => d.id === jobId);
      return { applicants: apps.data || [], drive };
    },
  });

  const applicants = data?.applicants ?? [];
  const drive = data?.drive;

  const statusClass = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'SELECTED') return 'bg-emerald-50 text-emerald-700';
    if (s === 'REJECTED' || s === 'WITHDRAWN') return 'bg-red-50 text-red-700';
    if (s.includes('INTERVIEW')) return 'bg-violet-50 text-violet-700';
    if (s === 'SHORTLISTED') return 'bg-sky-50 text-sky-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <Link
        to="/jobs/institution/placements"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to placement dashboard
      </Link>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Campus drive</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          {drive?.employer_name ? `${drive.employer_name} · ` : ''}
          {drive?.title || 'Applicants'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Students from your campus who applied to this role.</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#7DC8F7] border-t-transparent" />
          Loading applicants…
        </div>
      )}

      {error && <p className="text-sm text-red-600">Could not load applicants for this drive.</p>}

      {!isLoading && !error && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">CGPA</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{row.student_name || '—'}</p>
                    <p className="text-xs text-slate-500">{row.student_email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.program || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.cgpa ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.pipeline_stage || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(row.status)}`}>
                      {row.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
              {!applicants.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    No applications from your students yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}