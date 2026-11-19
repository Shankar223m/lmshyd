import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, Plus, Users } from 'lucide-react';
import { CampusPageHeader } from '@/shared/ui/CampusPageHeader';
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
  active_applicant_count?: number;
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
    return (
      <div className="lms-ui-kit-catalog loading-state">
        <div className="spinner" />
        Loading jobs…
      </div>
    );
  }
  if (error) {
    return (
      <div className="lms-ui-kit-catalog empty-state">
        <h3>Could not load jobs</h3>
        <p>Try refreshing the page.</p>
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

  const pillClass = (status: string) => {
    if (status === 'PUBLISHED') return 'status-pill published';
    if (status === 'UNDER_REVIEW' || status === 'SUBMITTED') return 'status-pill review';
    if (status === 'CLOSED') return 'status-pill draft';
    return 'status-pill pending';
  };

  const published = allJobs.filter((j) => j.status === 'PUBLISHED').length;
  const inReview = allJobs.filter((j) => j.status === 'UNDER_REVIEW' || j.status === 'SUBMITTED').length;
  const applicants = allJobs.reduce((n, j) => n + (j.active_applicant_count ?? j.applicant_count), 0);

  return (
    <div className="lms-ui-kit-catalog mx-auto w-full max-w-[1450px] pb-16">
      <CampusPageHeader
        eyebrow="Hiring management"
        title="Jobs & campus postings"
        description="Create roles, manage pipelines, and track applicants in one employer workspace."
        actions={
          <Link to="/jobs/employer/jobs/new" className="btn btn-primary">
            <Plus size={16} />
            Create job
          </Link>
        }
      />

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="stat-icon t0">
            <BriefcaseBusiness size={18} />
          </div>
          <small>Total roles</small>
          <strong>{allJobs.length}</strong>
          <span>● {published} live</span>
        </div>
        <div className="stat-tile">
          <div className="stat-icon t1">
            <Users size={18} />
          </div>
          <small>Active applicants</small>
          <strong>{applicants.toLocaleString()}</strong>
          <span>● Across open pipelines</span>
        </div>
        <div className="stat-tile">
          <div className="stat-icon t2">
            <BriefcaseBusiness size={18} />
          </div>
          <small>Published</small>
          <strong>{published}</strong>
          <span>● Accepting applications</span>
        </div>
        <div className="stat-tile">
          <div className="stat-icon t3">
            <BriefcaseBusiness size={18} />
          </div>
          <small>In review</small>
          <strong>{inReview}</strong>
          <span>● Awaiting moderation</span>
        </div>
      </div>

      <div className="section-head" style={{ marginBottom: 14 }}>
        <div>
          <h2>All job postings</h2>
          <p>Filter by status or search by title and location</p>
        </div>
      </div>

      <div className="catalog-toolbar" style={{ marginBottom: 13 }}>
        <div className="category-pills">
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
              className={`category-pill ${filter === key ? 'selected' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="search-field" style={{ flex: 1, maxWidth: 320 }}>
          <input
            type="search"
            placeholder="Search company or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Applicants</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-state" style={{ padding: '35px 16px' }}>
                  No jobs yet.{' '}
                  <Link to="/jobs/employer/jobs/new" className="text-link">
                    Create one
                  </Link>
                </td>
              </tr>
            ) : (
              filteredJobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <b style={{ display: 'block', fontSize: 11, color: '#29364b' }}>{j.title}</b>
                    <small style={{ fontSize: 9, color: '#8c96a6' }}>
                      {j.location || 'Remote'} · {j.employment_type.replace(/_/g, ' ')}
                    </small>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => nav(`/jobs/employer/pipeline/${j.id}`)}
                      className="text-link"
                      style={{ marginTop: 0 }}
                    >
                      {j.active_applicant_count ?? j.applicant_count}
                    </button>
                  </td>
                  <td>
                    <span className={pillClass(j.status)}>● {statusLabel(j.status)}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                      {j.status !== 'CLOSED' && j.status !== 'CANCELLED' && (
                        <Link to={`/jobs/employer/jobs/new?edit=${j.id}`} className="btn btn-outline btn-small">
                          Edit
                        </Link>
                      )}
                      {j.status === 'DRAFT' && (
                        <button type="button" onClick={() => submitMutation.mutate(j.id)} className="btn btn-primary btn-small">
                          Submit
                        </button>
                      )}
                      {(j.status === 'APPROVED' || j.status === 'DRAFT') && (
                        <button type="button" onClick={() => publishMutation.mutate(j.id)} className="btn btn-outline btn-small">
                          Publish
                        </button>
                      )}
                      {j.status === 'PUBLISHED' && (
                        <button type="button" onClick={() => closeMutation.mutate(j.id)} className="btn btn-outline btn-small">
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
