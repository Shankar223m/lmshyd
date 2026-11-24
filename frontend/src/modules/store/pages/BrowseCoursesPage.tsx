import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, ArrowUpDown, BookOpen, X, Sparkles, TrendingUp, Flame } from "lucide-react";

import { useDebouncedValue } from "@/core/hooks/useDebouncedValue";
import { useNotify } from "@/core/hooks/useNotify";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { useStudentType } from "@/modules/user-management/auth/hooks/useStudentType";
import { useBrowsePublishedCoursesQuery } from "@/modules/store/api/studentSubscriptionsApi";
import { useGetStoreOffersQuery, useTestBuyCourseMutation } from "@/modules/store/api/storeApi";
import { CourseBrowseCard } from "@/modules/store/components/CourseBrowseCard";
import { CoursePurchaseModal } from "@/modules/store/components/CoursePurchaseModal";
import { useCourseBrowseActions } from "@/modules/store/hooks/useCourseBrowseActions";
import type { BrowseCourse } from "@/modules/store/types/courseBrowse";
import type { StoreOffer } from "@/modules/store/types";
import { inferCategory } from "@/modules/store/utils/courseCategory";
import { matchesLevel, getCoursePriceInr } from "@/modules/store/utils/courseBrowseAccess";
import { Alert, Pagination } from "@/shared/ui";

type SortOption = "popular" | "newest" | "price_asc" | "price_desc" | "duration_asc" | "duration_desc" | "title_asc";
type DiscoveryTab = "all" | "newest" | "popular" | "trending";

export function BrowseCoursesPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [selectedTab, setSelectedTab] = useState<DiscoveryTab>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Courses");
  const [selectedLevel, setSelectedLevel] = useState<string>("All levels");
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);

  // Purchase & auto-enroll state
  const [purchasingCourse, setPurchasingCourse] = useState<BrowseCourse | null>(null);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [testBuy] = useTestBuyCourseMutation();

  const { data, isLoading, isError, refetch } = useBrowsePublishedCoursesQuery({
    page,
    per_page: perPage,
    search_text: debounced || undefined,
  });

  const { data: storeOffersData } = useGetStoreOffersQuery();

  const courses = data?.courses ?? [];
  const pageCtx = data?.page_context;

  const { isInstitutionStudent } = useStudentType();

  const offersMap = useMemo(() => {
    const map = new Map<string, StoreOffer>();
    (storeOffersData?.offers ?? []).forEach((o) => map.set(String(o.course_id), o));
    return map;
  }, [storeOffersData]);

  const { openDetail } = useCourseBrowseActions(offersMap);

  // Dynamically derive category list from actual courses in catalog
  const dynamicCategories = useMemo(() => {
    const categorySet = new Set<string>();
    courses.forEach((c) => {
      const cat = inferCategory(c.title, c.summary);
      if (cat) categorySet.add(cat);
    });

    const standardPills = [
      "All Courses",
      "Development",
      "AI & Machine Learning",
      "Data Science",
      "Design",
      "Business",
      "Marketing",
    ];

    const activeList = standardPills.filter(
      (cat) => cat === "All Courses" || categorySet.has(cat),
    );

    if (activeList.length <= 1) {
      return standardPills;
    }

    return activeList;
  }, [courses]);

  // Tab & Category Filtering
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (!matchesLevel(c, selectedLevel)) return false;

      // Category filter
      const category = inferCategory(c.title, c.summary);
      if (selectedCategory !== "All Courses" && selectedCategory !== "All courses") {
        if (selectedCategory === "Marketing") {
          const match = category === "Marketing" || `${c.title} ${c.summary}`.toLowerCase().includes("marketing");
          if (!match) return false;
        } else if (category !== selectedCategory) {
          return false;
        }
      }

      // Quick discovery tab filter
      if (selectedTab === "popular") {
        return c.access_status === "enrolled" || (c.chapters_count >= 1);
      }
      if (selectedTab === "trending") {
        const text = `${c.title} ${c.summary}`.toLowerCase();
        return text.includes("ai") || text.includes("data") || text.includes("stack") || text.includes("python");
      }

      return true;
    });
  }, [courses, selectedCategory, selectedLevel, selectedTab]);

  // Sorting
  const sortedCourses = useMemo(() => {
    const list = [...filteredCourses];
    switch (sortBy) {
      case "newest":
        return list.reverse();
      case "price_asc":
        return list.sort((a, b) => getCoursePriceInr(a, offersMap.get(a.course_id)) - getCoursePriceInr(b, offersMap.get(b.course_id)));
      case "price_desc":
        return list.sort((a, b) => getCoursePriceInr(b, offersMap.get(b.course_id)) - getCoursePriceInr(a, offersMap.get(a.course_id)));
      case "duration_asc":
        return list.sort((a, b) => a.duration_seconds - b.duration_seconds);
      case "duration_desc":
        return list.sort((a, b) => b.duration_seconds - a.duration_seconds);
      case "title_asc":
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case "popular":
      default:
        return list.sort((a, b) => {
          if (a.access_status === "enrolled" && b.access_status !== "enrolled") return -1;
          if (b.access_status === "enrolled" && a.access_status !== "enrolled") return 1;
          return 0;
        });
    }
  }, [filteredCourses, sortBy, offersMap]);

  const clearFilters = () => {
    setSearch("");
    setSelectedTab("all");
    setSelectedCategory("All Courses");
    setSelectedLevel("All levels");
    setSortBy("popular");
    setPage(1);
  };

  const catalogTotal = pageCtx?.total_records ?? courses.length;

  const handleCardPrimaryAction = async (course: BrowseCourse) => {
    if (course.access_status === "enrolled") {
      // Go directly into learning room
      navigate(`/courses/${course.course_id}/learn`);
      return;
    }

    // Auto-enroll and automatically start learning!
    try {
      setEnrollingCourseId(course.course_id);
      await testBuy({
        courseId: course.course_id,
        name: user?.full_name || "Student",
        email: user?.email,
      }).unwrap();
      notify.success(`Enrolled in ${course.title}! Starting your course now...`);
      navigate(`/courses/${course.course_id}/learn`);
    } catch (err: any) {
      // If payment required or error, open checkout modal
      const msg = err?.data?.message || err?.message || "Enrollment in progress.";
      notify.info(msg);
      setPurchasingCourse(course);
    } finally {
      setEnrollingCourseId(null);
    }
  };

  return (
    <div className="lms-ui-kit-catalog mx-auto w-full max-w-[1500px] pb-16">
      {/* A. Page Header */}
      <div className="page-title-row">
        <div>
          <div className="eyebrow">COURSE MARKETPLACE</div>
          <h1>Explore Courses</h1>
          <p className="text-sm text-slate-500 mt-1">
            Discover new skills, learn from expert instructors, and take the next step in your career.
          </p>
        </div>
        <div className="catalog-count">
          <b>{catalogTotal}+</b>
          <small>Courses available</small>
        </div>
      </div>

      {/* B. Course discovery hero banner */}
      <div className="course-search-banner">
        <div>
          <span className="hero-kicker">MAKE LEARNING YOUR SUPERPOWER</span>
          <h2>
            Make learning your <em>superpower.</em>
          </h2>
          <p>
            Explore practical courses, master new skills, and build your future with learning that moves you forward.
          </p>
        </div>
        <div className="banner-orbit" aria-hidden>
          <BookOpen size={58} />
          <span>✦</span>
        </div>
      </div>

      {/* C. Quick Discovery Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200/80 mb-5">
        <button
          type="button"
          onClick={() => {
            setSelectedTab("all");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedTab === "all"
              ? "bg-[#635BFF] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <BookOpen size={14} />
          <span>All Courses</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedTab("newest");
            setSortBy("newest");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedTab === "newest"
              ? "bg-[#635BFF] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Sparkles size={14} />
          <span>Newly Launched</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedTab("popular");
            setSortBy("popular");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedTab === "popular"
              ? "bg-[#635BFF] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Flame size={14} />
          <span>Popular Courses</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedTab("trending");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedTab === "trending"
              ? "bg-[#635BFF] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <TrendingUp size={14} />
          <span>Trending Courses</span>
        </button>
      </div>

      {/* D. Search and filters toolbar */}
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
          {search ? (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
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

        <label className="select-field">
          <ArrowUpDown size={16} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
            <option value="popular">Popular</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="duration_asc">Duration: Short to Long</option>
            <option value="duration_desc">Duration: Long to Short</option>
            <option value="title_asc">Title A-Z</option>
          </select>
        </label>
      </div>

      {/* Category Pills */}
      <div className="category-pills">
        {dynamicCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`category-pill ${
              selectedCategory === category ||
              (selectedCategory === "All Courses" && category === "All courses")
                ? "selected"
                : ""
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* E. Section Head */}
      <div className="section-head">
        <div>
          <h2>
            {selectedTab === "newest"
              ? "Newly Launched Courses"
              : selectedTab === "popular"
                ? "Popular Courses"
                : selectedTab === "trending"
                  ? "Trending in Tech & Business"
                  : "All Courses"}
          </h2>
          <p className="muted">Handpicked learning with industry certifications and practical projects.</p>
        </div>
        <div className="section-head-meta">
          <span className="result-count">{sortedCourses.length} courses</span>
        </div>
      </div>

      {isError && (
        <Alert tone="error">
          <div className="flex items-center justify-between gap-4">
            <span>Failed to load courses from catalog.</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-link"
              style={{ marginTop: 0 }}
            >
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

      {/* Course Grid */}
      <div className="course-grid">
        {sortedCourses.map((c, idx) => (
          <CourseBrowseCard
            key={c.course_id}
            course={c}
            index={idx}
            isInstitutionStudent={isInstitutionStudent}
            offer={offersMap.get(String(c.course_id))}
            isEnrolling={enrollingCourseId === c.course_id}
            onOpen={openDetail}
            onPrimaryAction={handleCardPrimaryAction}
          />
        ))}
      </div>

      {sortedCourses.length === 0 && !isLoading && (
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

      {/* Purchase Modal */}
      <CoursePurchaseModal
        isOpen={Boolean(purchasingCourse)}
        course={purchasingCourse}
        offer={purchasingCourse ? offersMap.get(purchasingCourse.course_id) : undefined}
        onClose={() => setPurchasingCourse(null)}
      />
    </div>
  );
}

export default BrowseCoursesPage;
