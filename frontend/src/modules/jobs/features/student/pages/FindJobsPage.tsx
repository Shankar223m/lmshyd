import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  MapPin,
  BriefcaseBusiness,
  ArrowUpRight,
  SlidersHorizontal,
  Bookmark,
  Clock3,
} from "lucide-react";
import { JobThumbnail } from "../../../components/JobThumbnail";
import {
  formatPostedAgo,
  formatSalaryCompact,
  formatSalaryRange,
  SALARY_DISCLOSURE,
} from "../../../utils/formatSalary";
import { apiFetch, type ApiResponse } from "../../../services/api";

type DiscoverJob = {
  id: string;
  title: string;
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
};

type FindJobsAudience = "student" | "admin";
type RoleFilter = "ALL" | "ENGINEERING" | "DESIGN";

export function FindJobsPage({ audience = "student" }: { audience?: FindJobsAudience }) {
  const isAdmin = audience === "admin";
  const detailBase = isAdmin ? "/jobs/admin/postings" : "/jobs/student/jobs";
  const [params, setParams] = useSearchParams();
  const [keyword, setKeyword] = useState(params.get("q") || "");
  const [locationQuery, setLocationQuery] = useState(params.get("loc") || "");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [eligibleOnly, setEligibleOnly] = useState(!isAdmin && params.get("eligible") === "1");
  const [jobType, setJobType] = useState(params.get("type") || "ALL");
  const [sortBy, setSortBy] = useState<"MATCH" | "CTC" | "LATEST">(
    (params.get("sort") as "MATCH" | "CTC" | "LATEST") || (isAdmin ? "LATEST" : "MATCH"),
  );
  const [bookmarked, setBookmarked] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("lms_job_bookmarks");
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleBookmark = (id: string) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("lms_job_bookmarks", JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["discover", audience, eligibleOnly, jobType, keyword, sortBy],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (keyword.trim()) qs.set("q", keyword.trim());
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
    const loc = locationQuery.trim().toLowerCase();
    if (loc) {
      list = list.filter((j) => (j.location || "").toLowerCase().includes(loc) || j.work_mode === "REMOTE");
    }
    if (roleFilter === "ENGINEERING") {
      list = list.filter((j) => {
        const blob = `${j.title} ${(j.skills || []).join(" ")}`.toLowerCase();
        return /engineer|developer|backend|frontend|full.?stack|devops|software/.test(blob);
      });
    }
    if (roleFilter === "DESIGN") {
      list = list.filter((j) => {
        const blob = `${j.title} ${(j.skills || []).join(" ")}`.toLowerCase();
        return /design|ui|ux|product designer|figma/.test(blob);
      });
    }
    if (sortBy === "MATCH") {
      list.sort((a, b) => (b.match_percent ?? 0) - (a.match_percent ?? 0));
    } else if (sortBy === "CTC") {
      list.sort((a, b) => (b.salary_max ?? b.salary_min ?? 0) - (a.salary_max ?? a.salary_min ?? 0));
    }
    return list;
  }, [rawJobs, locationQuery, roleFilter, sortBy]);

  const runSearch = () => {
    const p = new URLSearchParams(params);
    if (keyword.trim()) p.set("q", keyword.trim());
    else p.delete("q");
    if (locationQuery.trim()) p.set("loc", locationQuery.trim());
    else p.delete("loc");
    setParams(p, { replace: true });
  };

  const clearFilters = () => {
    setKeyword("");
    setLocationQuery("");
    setRoleFilter("ALL");
    setEligibleOnly(false);
    setJobType("ALL");
    setSortBy(isAdmin ? "LATEST" : "MATCH");
    setParams({}, { replace: true });
  };

  const rolePills: { id: RoleFilter; label: string }[] = [
    { id: "ALL", label: "All roles" },
    { id: "ENGINEERING", label: "Engineering" },
    { id: "DESIGN", label: "Design" },
  ];

  const featuredCount = rawJobs.length || filteredJobs.length;

  return (
    <div className="lms-ui-kit-catalog mx-auto w-full max-w-[1500px] pb-16">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">{isAdmin ? "JOB POSTINGS" : "CAREER OPPORTUNITIES"}</div>
          <h1>{isAdmin ? "Published postings" : "Find your next opportunity"}</h1>
          <p className="muted">
            {isAdmin
              ? "Live roles visible to students on the discover feed."
              : "Discover roles that match your skills, interests and ambitions."}
          </p>
        </div>
        <div className="catalog-count">
          <b>{featuredCount}</b>
          <small>{isAdmin ? "Live roles" : "Featured roles"}</small>
        </div>
      </div>

      <div className="job-hero">
        <div>
          <span className="hero-kicker">YOUR CAREER, YOUR NEXT MOVE</span>
          <h2>
            Find work that <em>moves you forward.</em>
          </h2>
          <p>Explore opportunities from teams building what comes next.</p>
        </div>
        <div className="job-hero-graphic" aria-hidden>
          <div className="briefcase-shape">
            <BriefcaseBusiness size={56} />
          </div>
          <span className="float-dot d1" />
          <span className="float-dot d2" />
        </div>
      </div>

      <div className="job-search-box">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Job title, company or keyword"
          />
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
        </label>
        <button type="button" className="btn btn-primary" onClick={runSearch}>
          Search jobs
        </button>
      </div>

      <div className="job-filter-row">
        <div className="category-pills">
          {rolePills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={`category-pill ${roleFilter === pill.id ? "selected" : ""}`}
              onClick={() => setRoleFilter(pill.id)}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <button type="button" className="filter-button" onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal size={16} />
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="filter-panel">
          {!isAdmin && (
            <label>
              <input
                type="checkbox"
                checked={eligibleOnly}
                onChange={(e) => setEligibleOnly(e.target.checked)}
              />
              Eligible only
            </label>
          )}
          <label>
            Type
            <select value={jobType} onChange={(e) => setJobType(e.target.value)}>
              <option value="ALL">All</option>
              <option value="FULL_TIME">Full-time</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="PART_TIME">Part-time</option>
            </select>
          </label>
          <label>
            Sort
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
              {!isAdmin && <option value="MATCH">Best match</option>}
              <option value="CTC">Highest CTC</option>
              <option value="LATEST">Latest</option>
            </select>
          </label>
          <button type="button" className="text-link" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}

      <div className="section-head">
        <div>
          <h2>{isAdmin ? "All postings" : "Recommended opportunities"}</h2>
          <p className="muted">
            {isAdmin ? "Manage and preview roles students see" : "Roles selected for your career interests"}
          </p>
        </div>
        <span className="result-count">{filteredJobs.length} jobs</span>
      </div>

      {isLoading && (
        <div className="loading-state">
          <div className="spinner" />
          Loading opportunities…
        </div>
      )}

      {error && (
        <p className="muted" role="alert">
          Failed to load jobs. Please refresh the page.
        </p>
      )}

      {!isLoading && !error && filteredJobs.length === 0 && (
        <div className="empty-state">
          <BriefcaseBusiness size={32} />
          <h3>No matching jobs</h3>
          <p>Try another search or category.</p>
          <button type="button" className="text-link" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}

      <ul className="job-list">
        {filteredJobs.map((j) => {
          const salaryText =
            formatSalaryCompact(j.salary_min, j.salary_max) ||
            formatSalaryRange(j.salary_min, j.salary_max) ||
            SALARY_DISCLOSURE;
          const workTypeLabel = (j.employment_type || "FULL_TIME").replace(/_/g, " ").toLowerCase();
          const posted = formatPostedAgo(j.created_at);
          const skills = (j.skills || []).slice(0, 3);
          const saved = bookmarked.has(j.id);

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
                    {posted ? (
                      <>
                        <span>·</span>
                        <small>{posted}</small>
                      </>
                    ) : null}
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
                    <span>
                      <Clock3 />
                      {j.work_mode === "REMOTE" ? "Remote OK" : j.work_mode?.replace(/_/g, " ").toLowerCase() || "On-site"}
                    </span>
                  </div>
                  {skills.length > 0 && (
                    <div className="skill-pills compact">
                      {skills.map((s) => (
                        <span key={s}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="job-card-side">
                  <b className="job-salary">{salaryText}</b>
                  <small>Annual salary</small>
                  <Link to={`${detailBase}/${j.id}`} className="btn btn-outline btn-small">
                    View details <ArrowUpRight size={14} />
                  </Link>
                </div>
                <button
                  type="button"
                  className={`bookmark-button ${saved ? "saved" : ""}`}
                  aria-label={saved ? "Remove bookmark" : "Bookmark job"}
                  onClick={() => toggleBookmark(j.id)}
                >
                  <Bookmark size={18} fill={saved ? "#635bff" : "none"} />
                </button>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}