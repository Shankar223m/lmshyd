import { Badge } from "@/shared/ui";

const TONE_MAP: Record<string, "green" | "blue" | "amber" | "red" | "gray" | "purple"> = {
  PUBLISHED: "green",
  VERIFIED: "green",
  ACCEPTED: "green",
  SELECTED: "green",
  SCHEDULED: "blue",
  UNDER_REVIEW: "blue",
  SUBMITTED: "blue",
  SHORTLISTED: "blue",
  ASSESSMENT: "purple",
  INTERVIEW: "purple",
  CHANGES_REQUIRED: "amber",
  CHANGES_REQUESTED: "amber",
  NEEDS_REVIEW: "amber",
  PENDING_APPROVAL: "amber",
  REJECTED: "red",
  DECLINED: "red",
  CANCELLED: "red",
  EXPIRED: "gray",
  CLOSED: "gray",
  DRAFT: "gray",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const key = status.toUpperCase().replace(/\s+/g, "_");
  const tone = TONE_MAP[key] || "gray";
  const text = label || status.replace(/_/g, " ");

  return (
    <Badge tone={tone}>
      {text}
    </Badge>
  );
}
