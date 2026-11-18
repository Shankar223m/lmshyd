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
};