const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  SHORTLISTED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  SELECTED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  OFFER_ISSUED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 border-amber-200/60",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200/60",
  IN_REVIEW: "bg-blue-50 text-blue-700 border-blue-200/60",
  SCREENING: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
  INTERVIEW_SCHEDULED: "bg-purple-50 text-purple-700 border-purple-200/60",
  CHANGES_REQUIRED: "bg-amber-50 text-amber-700 border-amber-200/60",
  NEEDS_REVIEW: "bg-amber-50 text-amber-700 border-amber-200/60",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200/60",
  WITHDRAWN: "bg-slate-100 text-slate-600 border-slate-200/60",
  CLOSED: "bg-slate-100 text-slate-600 border-slate-200/60",
  DRAFT: "bg-slate-50 text-slate-600 border-slate-200/60",
};

type StatusBadgeProps = {
  status: string;
  label?: string;
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const key = status.toUpperCase().replace(/ /g, "_");
  const style = STATUS_STYLES[key] || "bg-slate-50 text-slate-700 border-slate-200/60";
  const rawText = label || status.replace(/_/g, " ");
  // Format as Title Case
  const text = rawText
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${style}`}>
      {text}
    </span>
  );
}
