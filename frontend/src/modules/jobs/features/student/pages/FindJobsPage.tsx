import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Search, MapPin, BriefcaseBusiness, ArrowUpRight, Filter, X } from "lucide-react";
import { JobThumbnail } from "../../../components/JobThumbnail";
import {
  formatSalaryCompact,
  formatSalaryRange,
  SALARY_DISCLOSURE,
} from "../../../utils/formatSalary";
import { apiFetch, type ApiResponse } from "../../../services/api";

type DiscoverJob = {
  id: string;
  title: string;
  description?: string;
  organization_name?: string;
  thumbnail_file_id?: string | null;
  location?: string;
  employment_type: string;
  work_mode: string;
  salary_min?: number;
  salary_max?: number;
  closes_on?: string;
  skills?: string[];
  match_percent?: number;
  created_at?: string;
  status?: string;
};

type FindJobsAudience = "student" | "admin";

function formatApplyBy(closesOn?: string): string | null {
  if (!closesOn) return null;
  const d = new Date(closesOn);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function employmentLabel(type?: string): string {
  const raw = (type || "FULL_TIME").replace(/_/g, " ").toLowerCase();
  if (raw.includes("full")) return "Full time";
  if (raw.includes("intern")) return "Internship";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function statusPillClass(status?: string): string {
  const s = (status || "PUBLISHED").toUpperCase();
  if (s === "PUBLISHED") return "bg-emerald-50 text-emerald-700";
  if (s === "UNDER_REVIEW" || s === "APPROVED") return "bg-amber-50 text-amber-700";
  return "bg-sky-50 text-sky-700";
}

function statusPillLabel(status?: string): string {
  const s = (status || "PUBLISHED").toUpperCase();
  if (s === "PUBLISHED") return "Published";
  if (s === "UNDER_REVIEW") return "In review";
  if (s === "APPROVED") return "Approved";
  return "Open";
}

export function FindJobsPage({ audience = "student" }: { audience?: FindJobsAudience }) {
  const isAdmin = audience === "admin";
  const detailBase = isAdmin ? "/jobs/admin/postings" : "/jobs/student/jobs";
  const [params, setParams] = useSearchParams();
  const [keyword, setKeyword] = useState(params.get("q") || "");
  const [locationQuery, setLocationQuery] = useState(params.get("loc") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [eligibleOnly, setEligibleOnly] = useState(!isAdmin && params.get("eligible") === "1");
  const [jobType, setJobType] = useState(params.get("type") || "ALL");
  const [sortBy, setSortBy] = useState<"MATCH" | "CTC" | "LATEST">(
    (params.get("sort") as "MATCH" | "CTC" | "LATEST") || (isAdmin ? "LATEST" : "MATCH"),
  );

  useEffect(() => {
    setKeyword(params.get("q") || "");
    setLocationQuery(params.get("loc") || "");
  }, [params]);

  const querySearch = keyword.trim();
  const { data, isLoading, error } = useQuery({
    queryKey: ["discover", audience, eligibleOnly, jobType, querySearch, sortBy],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (querySearch) qs.set("q", querySearch);
      if (eligibleOnly) qs.set("eligible_only", "true");
      if (jobType !== "ALL") qs.set("employment_type", jobType);
      if (sortBy === "LATEST") qs.set("sort", "created_at_desc");
      const suffix = qs.toString();
      return apiFetch<ApiResponse<DiscoverJob[]>>(`/jobs/discover${suffix ? `?${suffix}` : ""}`);
    },
  });

  const rawJobs = useMemo(() => {
    const rows = data?.data || [];
    const seen = new Set<string>();
    return rows.filter((j) => {
      const key = `${j.organization_name || ""}::${(j.title || "").trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data?.data]);

  const filteredJobs = useMemo(() => {
    let list = [...rawJobs];
    const qClean = keyword.trim().toLowerCase();
    const qWords = qClean.split(/\s+/).filter(Boolean);
    if (qClean) {
      list = list.filter((j) => {
        const title = (j.title || "").toLowerCase();
        const company = (j.organization_name || "").toLowerCase();
        const loc = (j.location || "").toLowerCase();
        const skills = (j.skills || []).join(" ").toLowerCase();
        const desc = (j.description || "").toLowerCase();
        const blob = `${title} ${company} ${skills} ${loc} ${desc}`;
        return blob.includes(qClean) || qWords.every((w) => blob.includes(w));
      });
    }
    const loc = locationQuery.trim().toLowerCase();
    if (loc) {
      list = list.filter((j) => (j.location || "").toLowerCase().includes(loc) || j.work_mode === "REMOTE");
    }
    if (sortBy === "MATCH") {
      list.sort((a, b) => (b.match_percent ?? 0) - (a.match_percent ?? 0));
    } else if (sortBy === "CTC") {
      list.sort((a, b) => (b.salary_max ?? b.salary_min ?? 0) - (a.salary_max ?? a.salary_min ?? 0));
    }
    return list;
  }, [rawJobs, keyword, locationQuery, sortBy]);

  const runSearch = (nextKeyword?: string, nextLocation?: string) => {
    const k = (nextKeyword !== undefined ? nextKeyword : keyword).trim();
    const l = (nextLocation !== undefined ? nextLocation : locationQuery).trim();
    const p = new URLSearchParams(params);
    if (k) p.set("q", k);
    else p.delete("q");
    if (l) p.set("loc", l);
    else p.delete("loc");
    setParams(p, { replace: true });
  };

  const clearFilters = () => {
    setKeyword("");
    setLocationQuery("");
    setEligibleOnly(false);
    setJobType("ALL");
    setSortBy(isAdmin ? "LATEST" : "MATCH");
    setParams({}, { replace: true });
  };

  const useCardGrid = !isAdmin;

  return (
    <div
      className={
        useCardGrid
          ? "mx-auto w-full max-w-[1450px] pb-12"
          : "lms-ui-kit-catalog mx-auto w-full max-w-[1500px] pb-16"
      }
    >
      {isAdmin ? (
        <div className="page-title-row">
          <div>
            <div className="eyebrow">JOB POSTINGS</div>
            <h1>Published postings</h1>
            <p className="muted">Live roles visible to students on the discover feed.</p>
          </div>
          <div className="catalog-count">
            <b>{filteredJobs.length}</b>
            <small>Live roles</small>
          </div>
        </div>
      ) : (
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Career opportunities</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
            Discover roles
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Search campus and open-market postings that match your profile.
          </p>
        </div>
      )}

      <div
        className={
          useCardGrid
            ? "mb-4 flex flex-wrap items-center gap-2.5"
            : "job-search-box"
        }
      >
        {useCardGrid ? (
          <>
            <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400 shadow-xs">
              <Search className="h-4 w-4 shrink-0" strokeWidth={2} />
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search company, role or skill..."
                className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyword("");
                    runSearch("", locationQuery);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 shadow-xs hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" strokeWidth={2} />
              Filters
            </button>
            <span className="w-full text-xs text-slate-500 sm:ml-auto sm:w-auto">
              {filteredJobs.length} {filteredJobs.length === 1 ? "opportunity" : "opportunities"}
            </span>
          </>
        ) : (
          <>
            <label className="search-field">
              <Search size={18} />
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Job title, company or keyword"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyword("");
                    runSearch("", locationQuery);
                  }}
                  className="mr-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <label className="search-field location-search">
              <MapPin size={18} />
              <input
                type="search"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="City or remote"
              />
              {locationQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setLocationQuery("");
                    runSearch(keyword, "");
                  }}
                  className="mr-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <button type="button" className="btn btn-primary" onClick={() => runSearch()}>
              Search jobs
            </button>
            {(keyword || locationQuery) && (
              <button type="button" className="btn btn-outline" onClick={clearFilters}>
                Clear
              </button>
            )}
          </>
        )}
      </div>

      {showFilters && (
        <div
          className={
            useCardGrid
              ? "mb-5 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
              : "filter-panel"
          }
        >
          {!isAdmin && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={eligibleOnly}
                onChange={(e) => setEligibleOnly(e.target.checked)}
                className="rounded border-slate-300 text-[#7DC8F7]"
              />
              Eligible only
            </label>
          )}
          {isAdmin && (
            <label className="search-field location-search !min-w-[180px]">
              <MapPin size={16} />
              <input
                type="search"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="City or remote"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            Type
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-800"
            >
              <option value="ALL">All</option>
              <option value="FULL_TIME">Full-time</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="PART_TIME">Part-time</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            Sort
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-800"
            >
              {!isAdmin && <option value="MATCH">Best match</option>}
              <option value="CTC">Highest CTC</option>
              <option value="LATEST">Latest</option>
            </select>
          </label>
          {!isAdmin && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
              Location
              <input
                type="search"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="City or remote"
                className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-800"
              />
            </label>
          )}
          <button
            type="button"
            className={useCardGrid ? "text-sm font-semibold text-[#2b9fd4]" : "text-link"}
            onClick={clearFilters}
          >
            Clear all
          </button>
        </div>
      )}

      {isLoading && (
        <div className={useCardGrid ? "flex flex-col items-center gap-3 py-16 text-sm text-slate-500" : "loading-state"}>
          {useCardGrid ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7DC8F7] border-t-transparent" />
              Loading opportunities…
            </>
          ) : (
            <>
              <div className="spinner" />
              Loading opportunities…
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          Failed to load jobs. Please refresh the page.
        </p>
      )}

      {!isLoading && !error && filteredJobs.length === 0 && (
        <div
          className={
            useCardGrid
              ? "flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center"
              : "empty-state"
          }
        >
          <BriefcaseBusiness className={useCardGrid ? "h-8 w-8 text-slate-300" : ""} size={useCardGrid ? undefined : 32} />
          <h3 className={useCardGrid ? "text-base font-bold text-slate-800" : undefined}>No matching jobs</h3>
          <p className={useCardGrid ? "text-sm text-slate-500" : undefined}>Try another search or adjust filters.</p>
          <button type="button" className={useCardGrid ? "text-sm font-semibold text-[#2b9fd4]" : "text-link"} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}

      {useCardGrid ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((j) => {
            const salaryText =
              formatSalaryCompact(j.salary_min, j.salary_max) ||
              formatSalaryRange(j.salary_min, j.salary_max) ||
              SALARY_DISCLOSURE;
            const applyBy = formatApplyBy(j.closes_on) || "See role";
            const detailHref = `${detailBase}/${j.id}`;

            return (
              <article
                key={j.id}
                className="flex flex-col rounded-[11px] border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <JobThumbnail
                    fileId={j.thumbnail_file_id}
                    fallbackLabel={j.organization_name || "Co"}
                    className="!h-9 !w-9 shrink-0 !rounded-lg text-sm"
                    imgClassName="h-full w-full object-contain p-0.5"
                  />
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPillClass(j.status)}`}
                  >
                    ● {statusPillLabel(j.status)}
                  </span>
                </div>

                <span className="mt-3 block text-xs text-slate-500">{j.organization_name || "Employer"}</span>
                <h2 className="mt-0.5 min-h-[2.75rem] text-sm font-bold leading-snug text-slate-900 line-clamp-2">
                  {j.title}
                </h2>

                <div className="mt-2 flex flex-wrap gap-2.5 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {j.location || "India"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BriefcaseBusiness className="h-3.5 w-3.5" />
                    {employmentLabel(j.employment_type)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-y border-slate-100 py-3">
                  <div>
                    <p className="text-[10px] text-slate-400">Annual package</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">{salaryText}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Apply before</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">{applyBy}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 pt-0.5">
                  <Link
                    to={detailHref}
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#2b9fd4] hover:text-[#1e8fbe]"
                  >
                    View details <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    to={detailHref}
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-[#7DC8F7] px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#5CB8EC]"
                  >
                    View &amp; apply
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <>
          <div className="section-head">
            <div>
              <h2>All postings</h2>
              <p className="muted">Manage and preview roles students see</p>
            </div>
            <span className="result-count">{filteredJobs.length} jobs</span>
          </div>
          <ul className="job-list">
            {filteredJobs.map((j) => {
              const salaryText =
                formatSalaryCompact(j.salary_min, j.salary_max) ||
                formatSalaryRange(j.salary_min, j.salary_max) ||
                SALARY_DISCLOSURE;
              const workTypeLabel = (j.employment_type || "FULL_TIME").replace(/_/g, " ").toLowerCase();

              return (
                <li key={j.id}>
                  <article className="job-card">
                    <JobThumbnail
                      fileId={j.thumbnail_file_id}
                      fallbackLabel={j.organization_name || "Co"}
                      className="company-logo"
                      imgClassName="h-full w-full object-contain p-1"
                    />
                    <div className="job-card-main">
                      <div className="job-company-line">
                        <b>{j.organization_name || "Employer"}</b>
                      </div>
                      <Link to={`${detailBase}/${j.id}`} className="job-role">
                        {j.title}
                      </Link>
                      <div className="job-card-meta">
                        <span>
                          <MapPin />
                          {j.location || "India"}
                        </span>
                        <span className="capitalize">
                          <BriefcaseBusiness />
                          {workTypeLabel}
                        </span>
                      </div>
                    </div>
                    <div className="job-card-side">
                      <b className="job-salary">{salaryText}</b>
                      <small>Annual salary</small>
                      <Link to={`${detailBase}/${j.id}`} className="btn btn-outline btn-small">
                        View details <ArrowUpRight size={14} />
                      </Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}