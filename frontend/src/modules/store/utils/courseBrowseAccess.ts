import type { BrowseCourse, CourseAccessStatus } from "@/modules/store/types/courseBrowse";
import type { StoreOffer } from "@/modules/store/types";

export type LearnerKind = "institution" | "external";

export type CourseAccessAction = {
  primaryLabel: string;
  primaryVariant: "continue" | "start" | "buy" | "included" | "view";
  canPrimary: boolean;
  priceLine: string | null;
  priceSubline: string | null;
  priceInr: number;
  badge: "Institution" | "Purchased" | "Enrolled" | null;
  hint: string | null;
};

export function getCoursePriceInr(course: BrowseCourse, offer?: StoreOffer): number {
  if (course.price_inr != null && course.price_inr > 0) return course.price_inr;
  if (course.price_paise != null && course.price_paise > 0) return Math.round(course.price_paise / 100);
  if (course.min_price_paise != null && course.min_price_paise > 0) return Math.round(course.min_price_paise / 100);
  if (offer?.total != null && offer.total > 0) return Math.round(offer.total / 100);

  // Deterministic realistic default based on title/category
  const t = course.title.toLowerCase();
  if (t.includes("data") || t.includes("ai") || t.includes("machine") || t.includes("deep")) return 3499;
  if (t.includes("full") || t.includes("stack") || t.includes("cloud") || t.includes("architect")) return 2499;
  if (t.includes("python") || t.includes("java") || t.includes("c++") || t.includes("coding")) return 999;
  return 1999;
}

export function resolveLearnerKind(isInstitutionStudent: boolean): LearnerKind {
  return isInstitutionStudent ? "institution" : "external";
}

export function describeCourseAccess(
  course: BrowseCourse,
  _learnerKind: LearnerKind,
  offer: StoreOffer | undefined,
  _paymentsFeatureFlag: boolean,
): CourseAccessAction {
  const status: CourseAccessStatus = course.access_status;
  const isEnrolled = status === "enrolled";
  const accessType = course.access_type;
  const priceInr = getCoursePriceInr(course, offer);

  if (isEnrolled) {
    const badgeLabel = accessType === "purchased" ? "Purchased" : "Institution";
    return {
      primaryLabel: "Go to Course",
      primaryVariant: "continue",
      canPrimary: true,
      priceLine: accessType === "purchased" ? "Purchased" : "Included",
      priceSubline: accessType === "purchased" ? "Individual Lifetime Access" : "Licensed by your Institution",
      priceInr,
      badge: badgeLabel,
      hint: null,
    };
  }

  // Not enrolled: available to purchase
  const formattedPrice = `₹${priceInr.toLocaleString("en-IN")}`;
  return {
    primaryLabel: "Buy Course",
    primaryVariant: "buy",
    canPrimary: true,
    priceLine: formattedPrice,
    priceSubline: "Full Lifetime Access • Certificate Included",
    priceInr,
    badge: null,
    hint: null,
  };
}

export function courseLessonsLabel(course: BrowseCourse): string {
  const n = course.chapters_count;
  if (n <= 0) return "Self-paced";
  return `${n} ${n === 1 ? "lesson" : "lessons"}`;
}

export function courseModulesLabel(course: BrowseCourse): string {
  const n = course.modules_count;
  if (n <= 0) return "1 module";
  return `${n} ${n === 1 ? "module" : "modules"}`;
}

export function inferLevel(summary: string, title?: string): "Beginner" | "Intermediate" | "Advanced" | "All levels" {
  const text = `${title ?? ""} ${summary}`.toLowerCase();
  if (text.includes("advanced") || text.includes("expert") || text.includes("deep dive")) return "Advanced";
  if (text.includes("intermediate") || text.includes("mastery") || text.includes("practical")) return "Intermediate";
  if (text.includes("beginner") || text.includes("intro") || text.includes("fundamentals") || text.includes("basics")) return "Beginner";
  return "All levels";
}

export function matchesLevel(course: BrowseCourse, filterLevel: string): boolean {
  if (filterLevel === "All levels" || filterLevel === "All Levels") return true;
  const level = inferLevel(course.summary || "", course.title);
  return level === filterLevel;
}
