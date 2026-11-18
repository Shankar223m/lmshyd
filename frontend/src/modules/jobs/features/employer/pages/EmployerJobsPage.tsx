import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, type ApiResponse } from '../../../services/api';

type JobItem = {
  id: string;
  title: string;
  status: string;
  location?: string;
  employment_type: string;
  salary_min?: number;
  salary_max?: number;
  openings: number;
  closes_on?: string;
  applicant_count: number;
};

type EmployerJobsData = {
  stats: Record<string, number>;
  jobs: JobItem[];
};

export function EmployerJobsPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['employer-jobs'],
    queryFn: () => apiFetch<ApiResponse<EmployerJobsData>>('/employers/me/jobs'),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/jobs/${id}/publish`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer-jobs'] }),
  });
  const submitMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/jobs/${id}/submit`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer-jobs'] }),
  });
  const closeMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/jobs/${id}/close`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer-jobs'] }),
  });

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-slate-500">Loading jobs…</p>;
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load jobs.
      </div>
    );
  }

  const allJobs = data?.data.jobs || [];
  const filteredJobs = allJobs.filter((j) => {
    const matchesFilter =
      filter === 'ALL'
        ? true
        : filter === 'PUBLISHED'
          ? j.status === 'PUBLISHED'
          : filter === 'IN_REVIEW'
            ? j.status === 'UNDER_REVIEW' || j.status === 'SUBMITTED'
            : filter === 'DRAFTS'
              ? j.status === 'DRAFT' || j.status === 'CHANGES_REQUIRED'
              : filter === 'CLOSED'
                ? j.status === 'CLOSED'
                : true;
    const matchesSearch =
      !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      (j.location && j.location.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const statusLabel = (status: string) => {
    if (status === 'PUBLISHED') return 'Published';
    if (status === 'UNDER_REVIEW' || status === 'SUBMITTED') return 'In review';
    if (status === 'CHANGES_REQUIRED') return 'Changes required';
    if (status === 'CLOSED') return 'Closed';
    return 'Draft';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Jobs</h1>
        <Link
          to="/jobs/employer/jobs/new"
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Create job
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {[
            ['ALL', 'All'],
            ['PUBLISHED', 'Published'],
            ['IN_REVIEW', 'In review'],
            ['DRAFTS', 'Drafts'],
            ['CLOSED', 'Closed'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key!)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                filter === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm sm:w-56"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Applicants</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No jobs yet.{' '}
                  <Link to="/jobs/employer/jobs/new" className="font-semibold text-slate-900 underline">
                    Create one
                  </Link>
                </td>
              </tr>
            ) : (
              filteredJobs.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{j.title}</div>
                    <div className="text-xs text-slate-500">
                      {j.location || 'Remote'} · {j.employment_type.replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => nav(`/jobs/employer/pipeline?jobId=${j.id}`)}
                      className="font-medium text-slate-800 hover:underline"
                    >
                      {j.applicant_count}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-600">{statusLabel(j.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {j.status !== 'CLOSED' && j.status !== 'CANCELLED' && (
                        <Link
                          to={`/jobs/employer/jobs/new?edit=${j.id}`}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                        >
                          Edit
                        </Link>
                      )}
                      {j.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => submitMutation.mutate(j.id)}
                          className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                        >
                          Submit
                        </button>
                      )}
                      {(j.status === 'APPROVED' || j.status === 'DRAFT') && (
                        <button
                          type="button"
                          onClick={() => publishMutation.mutate(j.id)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                        >
                          Publish
                        </button>
                      )}
                      {j.status === 'PUBLISHED' && (
                        <button
                          type="button"
                          onClick={() => closeMutation.mutate(j.id)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
