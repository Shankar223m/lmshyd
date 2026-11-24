import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Users,
  ClipboardList,
  GraduationCap,
} from 'lucide-react';
import { JobThumbnail } from '../../../components/JobThumbnail';
import { formatSalaryCompact, formatSalaryRange, SALARY_DISCLOSURE } from '../../../utils/formatSalary';
import { LIVE_LIST_QUERY_OPTIONS } from '../../../lib/liveQueryOptions';
import { apiFetch, type ApiResponse } from '../../../services/api';

type DriveRow = {
  id: string;
  title: string;
  employer_name?: string;
  status: string;
  closes_on?: string;
  salary_min?: number;
  salary_max?: number;
  applicant_count: number;
};

type DashboardPayload = {
  stats: {
    assigned_drives: number;
    upcoming_drives: number;
    eligible_students: number;
    applications: number;
    selected: number;
    placed: number;
    placement_percentage: number;
  };
  drives: DriveRow[];
};

function formatDriveDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function driveStatusLabel(status: string): { label: string; className: string } {
  const s = status.toUpperCase();
  if (s === 'PUBLISHED') return { label: 'Published', className: 'bg-emerald-50 text-emerald-700' };
  if (s === 'PAUSED') return { label: 'Ongoing', className: 'bg-amber-50 text-amber-700' };
  return { label: 'Open', className: 'bg-sky-50 text-sky-700' };
}

const STAT_CARDS = [
  { key: 'assigned_drives', sub: 'upcoming_drives', label: 'Assigned drives', subLabel: 'upcoming', icon: BriefcaseBusiness, tone: 'bg-[#7DC8F7]/15 text-[#2b9fd4]' },
  { key: 'eligible_students', label: 'Eligible students', subLabel: 'on campus', icon: Users, tone: 'bg-blue-50 text-blue-600' },
  { key: 'applications', label: 'Applications', subLabel: 'from your students', icon: ClipboardList, tone: 'bg-emerald-50 text-emerald-600' },
  { key: 'selected', label: 'Selected', subLabel: 'this academic year', icon: GraduationCap, tone: 'bg-amber-50 text-amber-600' },
] as const;

export function InstitutionPlacementsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['inst-placement-dashboard'],
    queryFn: () => apiFetch<ApiResponse<DashboardPayload>>('/institutions/me/placement-dashboard'),
    ...LIVE_LIST_QUERY_OPTIONS,
  });

  const stats = data?.data?.stats;
  const drives = data?.data?.drives ?? [];

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 pb-12">
      <h1 className="sr-only">Placement dashboard</h1>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">College placement cell</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">College placement dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">
          Monitor drives assigned to your campus and student application status.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#7DC8F7] border-t-transparent" />
          Loading placement data…
        </div>
      )}

      {error && <p className="text-sm text-red-600">Could not load placement dashboard.</p>}

      {stats && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STAT_CARDS.map((card) => {
            const Icon = card.icon;
            const value = stats[card.key as keyof typeof stats];
            const subKey = 'sub' in card ? card.sub : null;
            const subValue = subKey ? stats[subKey as keyof typeof stats] : null;
            return (
              <div
                key={card.key}
                className="rounded-[11px] border border-slate-200 bg-white p-4 shadow-xs min-h-[120px]"
              >
                <div className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-[11px] text-slate-500">{card.label}</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {subValue != null && 'subLabel' in card && card.subLabel === 'upcoming'
                    ? `● ${subValue} ${card.subLabel}`
                    : `● ${card.subLabel}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <section className="rounded-[11px] border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-900">Drives assigned to your college</h3>
          <p className="text-xs text-slate-500">Review dates, applicants and participation for each drive.</p>
        </div>

        {!drives.length && !isLoading ? (
          <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
            No employer drives are assigned to your campus yet. When employers select your college on a job post, it
            will appear here.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {drives.map((drive) => {
              const salary =
                formatSalaryCompact(drive.salary_min, drive.salary_max) ||
                formatSalaryRange(drive.salary_min, drive.salary_max) ||
                SALARY_DISCLOSURE;
              const pill = driveStatusLabel(drive.status);
              return (
                <li key={drive.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0">
                  <JobThumbnail
                    fallbackLabel={drive.employer_name || 'Co'}
                    className="!h-9 !w-9 shrink-0 !rounded-lg text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">
                      {drive.employer_name || 'Employer'} · {drive.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      Apply by {formatDriveDate(drive.closes_on)} · {salary}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    {drive.applicant_count} applicant{drive.applicant_count === 1 ? '' : 's'}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pill.className}`}
                  >
                    ● {pill.label}
                  </span>
                  <Link
                    to={`/jobs/institution/drives/${drive.id}/students`}
                    className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
                  >
                    View students
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {stats && stats.placed > 0 && (
        <p className="text-xs text-slate-500">
          Placement stats: {stats.placed} verified placement{stats.placed === 1 ? '' : 's'} (
          {stats.placement_percentage}% of eligible students).
        </p>
      )}
    </div>
  );
}