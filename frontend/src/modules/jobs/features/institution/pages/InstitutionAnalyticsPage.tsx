import { KpiCard } from '../../../components/ui/KpiCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { apiDownload, apiFetch, type ApiResponse } from '../../../services/api';

type Analytics = {
  total_students: number;
  applications: number;
  shortlisted: number;
  offers: number;
  placed: number;
  placement_percentage: number;
};

export function InstitutionAnalyticsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['inst-analytics'],
    queryFn: () => apiFetch<ApiResponse<Analytics>>('/institutions/me/analytics'),
  });

  const m = data?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Placement analytics"
        description="Live metrics from your student roster and placement records."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => apiDownload('/institutions/me/analytics/export.csv', 'institution_analytics.csv')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => apiDownload('/institutions/me/analytics/export.pdf', 'institution_analytics.pdf')}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Export PDF
            </button>
          </div>
        }
      />

      {isLoading && <p className="text-sm text-slate-500">Loading analytics…</p>}
      {isError && <p className="text-sm text-red-600">Could not load analytics.</p>}

      {m && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Total students" value={m.total_students} />
          <KpiCard label="Applications" value={m.applications} />
          <KpiCard label="Shortlisted" value={m.shortlisted} accent="indigo" />
          <KpiCard label="Offers" value={m.offers} />
          <KpiCard label="Verified placements" value={m.placed} accent="success" />
          <KpiCard label="Placement %" value={`${m.placement_percentage}%`} accent="success" />
        </div>
      )}
    </div>
  );
}
