import { useState, useMemo } from "react";
import { Search, SlidersHorizontal, BookOpen, Award } from "lucide-react";

import { useDebouncedValue } from "@/core/hooks/useDebouncedValue";
import { useStudentType } from "@/modules/user-management/auth/hooks/useStudentType";
import { useBrowsePublishedCoursesQuery } from "@/modules/store/api/studentSubscriptionsApi";
import { useGetStoreOffersQuery } from "@/modules/store/api/storeApi";
import { CourseBrowseCard } from "@/modules/store/components/CourseBrowseCard";
import { useCourseBrowseActions } from "@/modules/store/hooks/useCourseBrowseActions";
import type { StoreOffer } from "@/modules/store/types";
import { inferCategory } from "@/modules/store/utils/courseCategory";
import { matchesLevel } from "@/modules/store/utils/courseBrowseAccess";
import { Alert, Pagination } from "@/shared/ui";

const CATEGORIES = [
  "All courses",
  "Development",
  "Data Science",
  "Design",
  "Business",
  "Marketing",
] as const;

export function BrowseCoursesPage() {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [selectedCategory, setSelectedCategory] = useState<string>("All courses");
  const [selectedLevel, setSelectedLevel] = useState<string>("All levels");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);

  const { data, isLoading, isError, refetch } = useBrowsePublishedCoursesQuery({
    page,
    per_page: perPage,
    search_text: debounced || undefined,
  });

  const { data: storeOffersData } = useGetStoreOffersQuery();

  const courses = data?.courses ?? [];
  const pageCtx = data?.page_context;

  const { isInstitutionStudent, isExternalStudent, institutionName } = useStudentType();

  const offersMap = useMemo(() => {
    const map = new Map<string, StoreOffer>();
    (storeOffersData?.offers ?? []).forEach((o) => map.set(String(o.course_id), o));
    return map;
  }, [storeOffersData]);

  const { openDetail, handlePrimary } = useCourseBrowseActions(offersMap);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (!matchesLevel(c, selectedLevel)) return false;
      const category = inferCategory(c.title, c.summary);
      if (selectedCategory === "All courses") return true;
      if (selectedCategory === "Marketing") {
        return category === "Marketing" || `${c.title} ${c.summary}`.toLowerCase().includes("marketing");
      }
      return category === selectedCategory;
    });
  }, [courses, selectedCategory, selectedLevel]);

  const clearFilters = () => {
    setSearch("");
    setSelectedCategory("All courses");
    setSelectedLevel("All levels");
    setPage(1);
  };

  const catalogTotal = pageCtx?.total_records ?? courses.length;

  return (
    <div className="lms-ui-kit-catalog mx-auto w-full max-w-[1500px] pb-16">
      {isInstitutionStudent && institutionName && (
        <div className="soft-tag" style={{ marginBottom: 18 }}>
          <Award size={15} />
          <strong>{institutionName}</strong> — showing only courses your university has licensed for students.
        </div>
      )}
      {isExternalStudent && (
        <div className="soft-tag" style={{ marginBottom: 18 }}>
          <Award size={15} />
          Individual learner account — full catalog. Purchase unlocks access in My courses.
        </div>
      )}

      <div className="page-title-row">
        <div>
          <div className="eyebrow">LEARN AT YOUR PACE</div>
          <h1>Explore courses</h1>
          <p className="muted">
            {isInstitutionStudent
              ? "Your institution provides licensed courses. Details, duration, and access status come from the live catalog."
              : "Pick individual courses, review pricing, and enroll through the Unitic store."}
          </p>
        </div>
        <div className="catalog-count">
          <b>{catalogTotal}+</b>
          <small>Curated courses</small>
        </div>
      </div>

      <div className="course-search-banner">
        <div>
          <span className="hero-kicker">FIND YOUR NEXT SKILL</span>
          <h2>
            Make learning your <em>superpower.</em>
          </h2>
          <p>Each card shows the real instructor, duration, and lessons from the published course version.</p>
        </div>
        <div className="banner-orbit" aria-hidden>
          <BookOpen size={58} />
          <span>✦</span>
        </div>
      </div>

      <div className="catalog-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search courses, skills or topics..."
          />
        </label>
        <label className="select-field">
          <SlidersHorizontal size={16} />
          <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
            <option>All levels</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </label>
      </div>

      <div className="category-pills">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`category-pill ${selectedCategory === category ? "selected" : ""}`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="section-head">
        <div>
          <h2>Popular courses</h2>
          <p className="muted">Handpicked learning for your next step</p>
        </div>
        <span className="result-count">{filteredCourses.length} courses</span>
      </div>

      {isError && (
        <Alert tone="error">
          <div className="flex items-center justify-between gap-4">
            <span>Failed to load courses from catalog.</span>
            <button type="button" onClick={() => refetch()} className="text-link" style={{ marginTop: 0 }}>
              Retry
            </button>
          </div>
        </Alert>
      )}

      {isLoading && (
        <div className="loading-state">
          <div className="spinner" />
          Loading courses…
        </div>
      )}

      <div className="course-grid">
        {filteredCourses.map((c, idx) => (
          <CourseBrowseCard
            key={c.course_id}
            course={c}
            index={idx}
            isInstitutionStudent={isInstitutionStudent}
            offer={offersMap.get(String(c.course_id))}
            onOpen={openDetail}
            onPrimaryAction={(course) => void handlePrimary(course)}
          />
        ))}
      </div>

      {filteredCourses.length === 0 && !isLoading && (
        <div className="empty-state">
          <BookOpen size={32} />
          <h3>No courses found</h3>
          <p>Try a different keyword or category.</p>
          <button type="button" className="text-link" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}

      {pageCtx && pageCtx.total_pages > 1 && (
        <div className="pagination-wrap">
          <Pagination pageContext={pageCtx} onPageChange={setPage} onPerPageChange={setPerPage} />
        </div>
      )}
    </div>
  );
}