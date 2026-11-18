import type { BrowseCourse, CourseAccessStatus } from "@/modules/store/types/courseBrowse";
import type { StoreOffer } from "@/modules/store/types";
import { inr } from "@/modules/billing/common/format";

export type LearnerKind = "institution" | "external";

export type CourseAccessAction = {
  primaryLabel: string;
  primaryVariant: "continue" | "start" | "buy" | "included" | "view";
  canPrimary: boolean;
  priceLine: string | null;
  priceSubline: string | null;
  badge: string | null;
  hint: string | null;
};

function paiseToInr(paise: number | null | undefined): string | null {
  if (paise == null || paise <= 0) return null;
  return inr(paise);
}

export function resolveLearnerKind(isInstitutionStudent: boolean): LearnerKind {
  return isInstitutionStudent ? "institution" : "external";
}

export function describeCourseAccess(
  course: BrowseCourse,
  learnerKind: LearnerKind,
  offer: StoreOffer | undefined,
  paymentsFeatureFlag: boolean,
): CourseAccessAction {
  const status: CourseAccessStatus = course.access_status;
  const planName = course.active_plan_name;

  if (status === "enrolled") {
    return {
      primaryLabel: "Continue learning",
      primaryVariant: "continue",
      canPrimary: true,
      priceLine: learnerKind === "institution" ? "Included" : null,
      priceSubline: learnerKind === "institution" ? "Provided by your university" : null,
      badge: "Enrolled",
      hint: null,
    };
  }

  if (learnerKind === "institution") {
    if (status === "active_plan" || status === "eligible_under_plan") {
      return {
        primaryLabel: "Start learning",
        primaryVariant: "start",
        canPrimary: true,
        priceLine: "Included",
        priceSubline: planName ? `Under ${planName}` : "Licensed by your university",
        badge: status === "active_plan" ? "On your plan" : "Available",
        hint: null,
      };
    }
    // Listed courses for institution students are always licensed; other statuses should not appear.
    return {
      primaryLabel: "View course",
      primaryVariant: "view",
      canPrimary: true,
      priceLine: "Included",
      priceSubline: "Licensed by your university",
      badge: null,
      hint: null,
    };
  }

  const canPay = paymentsFeatureFlag && course.payments_enabled;
  const total = offer?.total ?? course.min_price_paise ?? null;
  const listHint = offer
    ? `incl. ${inr(offer.gst)} GST · ${offer.valid_days} days access`
    : course.min_price_paise
      ? "Checkout total may include GST"
      : null;

  if (status === "payments_disabled" || !canPay) {
    return {
      primaryLabel: "View course",
      primaryVariant: "view",
      canPrimary: true,
      priceLine: paiseToInr(total),
      priceSubline: listHint,
      badge: null,
      hint: canPay
        ? null
        : "Online checkout is disabled here. Contact support if you need access.",
    };
  }

  return {
    primaryLabel: "Buy & enroll",
    primaryVariant: "buy",
    canPrimary: Boolean(offer),
    priceLine: paiseToInr(total),
    priceSubline: listHint,
    badge: null,
    hint: offer ? null : "Pricing will appear when this course is listed in the store.",
  };
}

export function courseLessonsLabel(course: BrowseCourse): string {
  const n = course.chapters_count;
  if (n <= 0) return "Self-paced";
  return `${n} ${n === 1 ? "lesson" : "lessons"}`;
}

export function courseModulesLabel(course: BrowseCourse): string {
  const n = course.modules_count;
  if (n <= 0) return "";
  return `${n} ${n === 1 ? "module" : "modules"}`;
}

export function inferLevel(summary: string, title: string): string | null {
  const blob = `${title} ${summary}`.toLowerCase();
  if (/\b(advanced|expert)\b/.test(blob)) return "Advanced";
  if (/\b(intermediate)\b/.test(blob)) return "Intermediate";
  if (/\b(beginner|fundamentals|introduction)\b/.test(blob)) return "Beginner";
  return null;
}

export function matchesLevel(course: BrowseCourse, selectedLevel: string): boolean {
  if (selectedLevel === "All levels") return true;
  const level = inferLevel(course.summary || "", course.title);
  if (!level) return true;
  return level === selectedLevel;
}