import type { ReactNode } from "react";

export type ApplicationStatusInput = {
  status: string;
  pipeline_stage?: string | null;
};

function normalizeStage(app: ApplicationStatusInput): string {
  const stage = (app.pipeline_stage || "").trim();
  if (stage) return stage;
  const s = app.status.toUpperCase();
  if (s === "INTERVIEW_SCHEDULED") return "Interview";
  if (s === "SHORTLISTED") return "Shortlisted";
  if (s === "SCREENING") return "Screening";
  if (s === "ASSESSMENT") return "Assessment";
  if (s === "SELECTED" || s === "OFFER_ISSUED") return "Selected";
  if (s === "REJECTED" || s === "WITHDRAWN") return s === "WITHDRAWN" ? "Withdrawn" : "Rejected";
  if (s === "SUBMITTED" || s === "IN_REVIEW" || s === "UNDER_REVIEW") return "Application review";
  return "Under review";
}

function badgeClasses(app: ApplicationStatusInput): string {
  const s = app.status.toUpperCase();
  const stage = (app.pipeline_stage || "").toLowerCase();
  if (s === "REJECTED" || s === "WITHDRAWN") {
    return "bg-rose-50 text-rose-700 border-rose-200/60";
  }
  if (s === "SELECTED" || s === "OFFER_ISSUED" || stage.includes("select")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  }
  if (s === "SHORTLISTED" || stage.includes("shortlist")) {
    return "bg-sky-50 text-sky-700 border-sky-200/60";
  }
  if (s === "INTERVIEW_SCHEDULED" || stage.includes("interview")) {
    return "bg-violet-50 text-violet-700 border-violet-200/60";
  }
  if (s === "ASSESSMENT" || stage.includes("assess")) {
    return "bg-amber-50 text-amber-800 border-amber-200/60";
  }
  if (s === "SCREENING" || stage.includes("screen")) {
    return "bg-slate-100 text-slate-700 border-slate-200/80";
  }
  return "bg-amber-50 text-amber-700 border-amber-200/60";
}

export function applicationStageLabel(app: ApplicationStatusInput): string {
  return normalizeStage(app);
}

export function ApplicationStatusBadge({
  application,
  className = "",
}: {
  application: ApplicationStatusInput;
  className?: string;
}): ReactNode {
  const label = applicationStageLabel(application);
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${badgeClasses(application)} ${className}`}
    >
      {label}
    </span>
  );
}