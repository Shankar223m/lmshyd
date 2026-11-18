import { Link } from "react-router-dom";

import type { MenuKey, Section } from "@/modules/user-management/common/permissions/types";
import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";
import { Icon, PageHeader } from "@/shared/ui";

const CARDS = [
  {
    title: "Marks & results",
    description: "Section marks, best scores, and CSV export by course or test.",
    to: "/results",
    icon: "chart" as const,
    show: (can: (s: Section) => boolean) => can("academics"),
  },
  {
    title: "Student progress",
    description: "Enrollment activity and completion without opening proctoring tools.",
    to: "/academics/student-progress",
    icon: "users" as const,
    show: (can: (s: Section) => boolean) => can("academics"),
  },
  {
    title: "Grading queue",
    description: "Subjective answers waiting for a staff member to mark.",
    to: "/grading/queue",
    icon: "check" as const,
    show: (_: (s: Section) => boolean, canOpen: (m: MenuKey) => boolean) => canOpen("grading"),
  },
  {
    title: "Attempts",
    description: "Follow live attempts and intervene when a student needs help.",
    to: "/attempts",
    icon: "fileText" as const,
    show: (_: (s: Section) => boolean, canOpen: (m: MenuKey) => boolean) => canOpen("attempts"),
  },
] as const;

export function AcademicsOutcomesPage() {
  const { can, canOpen } = usePermissions();
  const visible = CARDS.filter((c) => c.show(can, canOpen));

  return (
  <>
    <PageHeader
      title="Academic outcomes"
      description="One place for how your cohort is performing — marks, progress, and grading."
    />
    <ul className="grid gap-4 sm:grid-cols-2">
      {visible.map((card) => (
        <li key={card.to}>
          <Link
            to={card.to}
            className="group flex h-full gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <Icon name={card.icon} size={22} />
            </span>
            <span>
              <span className="block text-base font-bold text-navy-950 group-hover:text-brand-800">{card.title}</span>
              <span className="mt-1 block text-sm text-slate-600">{card.description}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
    {visible.length === 0 && (
      <p className="text-sm text-slate-600">Your role does not include academic outcome screens yet. Ask your administrator to grant academics or grading permissions.</p>
    )}
  </>
  );
}
