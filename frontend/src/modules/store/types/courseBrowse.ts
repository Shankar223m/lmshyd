/** Mirrors catalog-service `CourseBrowseOut` (browse list for learners). */
export type CourseAccessStatus =
  | "enrolled"
  | "active_plan"
  | "eligible_under_plan"
  | "available"
  | "payments_disabled";

export type BrowsePlanPreview = {
  plan_id: string;
  code: string;
  name: string;
  price_paise: number;
  billing_duration_days: number;
  billing_label: string;
  max_courses?: number | null;
  is_recommended?: boolean;
};

export type BrowseCourse = {
  course_id: string;
  title: string;
  slug: string;
  summary: string;
  thumbnail_media_id?: string | null;
  instructor_name?: string | null;
  modules_count: number;
  chapters_count: number;
  duration_seconds: number;
  duration_label: string;
  latest_published_version_id?: string | null;
  access_status: CourseAccessStatus;
  active_plan_name?: string | null;
  min_price_paise?: number | null;
  payments_enabled: boolean;
  plans_preview: BrowsePlanPreview[];
  access_type?: "institution" | "purchased" | null;
  price_paise?: number | null;
  price_inr?: number | null;
  skills?: string[];
};

export type ChapterPreview = {
  id: string;
  title: string;
  position: number;
  duration_seconds: number;
  items_count: number;
};

export type ModulePreview = {
  id: string;
  title: string;
  description?: string | null;
  position: number;
  chapters_count: number;
  duration_seconds: number;
  chapters: ChapterPreview[];
};

export type CourseCurriculumPreview = {
  course_id: string;
  version_id?: string | null;
  version_number?: number | null;
  modules: ModulePreview[];
  total_modules: number;
  total_chapters: number;
  total_duration_seconds: number;
  duration_label: string;
};
