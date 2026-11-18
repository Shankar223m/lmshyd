import { Link, useNavigate } from "react-router-dom";

import { formatDateTime } from "@/core/lib/format";
import { cn } from "@/core/lib/cn";
import { useListHomeTestsQuery } from "@/modules/dashboard/api/homeApi";
import { useListMyCoursesQuery } from "@/modules/learning/common/api/myCoursesApi";
import { PAYMENTS_ENABLED } from "@/core/config/features";
import { useCan } from "@/modules/user-management/common/permissions/useCan";
import { Badge, Button, Icon, type IconName } from "@/shared/ui";

const COURSE_TONES = [
  { panel: "from-sky-50 to-sky-100/80", icon: "text-sky-700 bg-white", ring: "hover:ring-sky-300" },
  { panel: "from-violet-50 to-violet-100/70", icon: "text-violet-700 bg-white", ring: "hover:ring-violet-300" },
  { panel: "from-amber-50 to-amber-100/80", icon: "text-amber-700 bg-white", ring: "hover:ring-amber-300" },
  { panel: "from-brand-50 to-emerald-100/70", icon: "text-brand-700 bg-white", ring: "hover:ring-brand-300" },
] as const;

const COURSE_ICONS: IconName[] = ["graduation", "layers", "book", "sparkles"];

/**
 * Student "right now" strip in Ace Academy card language:
 * pastel course cards + upcoming assessments list — wired to real enrollments/tests APIs.
 */
export function TodayCards() {
  const navigate = useNavigate();
  const { holds } = useCan();
  const studies = holds("learning.study");
  const takesTests = holds("assessments.take");
  const { data: courses = [] } = useListMyCoursesQuery(undefined, { skip: !studies });
  const { data: tests = [] } = useListHomeTestsQuery(undefined, { skip: !takesTests });
  if (!studies && !takesTests) return null;

  const courseHref = (courseId: string) => `/courses/${courseId}/learn`;

  return (
    <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      {studies && (
        <section aria-labelledby="dash-my-courses">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 id="dash-my-courses" className="text-lg font-bold text-navy-950">
                My Courses
              </h2>
              <p className="text-sm text-slate-500">Continue where you left off</p>
            </div>
            <Link to="/courses/my" className="text-sm font-semibold text-brand-700 hover:underline">
              View all ({courses.length})
            </Link>
          </div>

          {courses.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-card">
              <Icon name="graduation" size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No active course enrollments</p>
              {PAYMENTS_ENABLED && holds("store.buy") ? (
                <p className="mt-1 text-xs text-slate-500">
                  Buy a course in the{" "}
                  <Link to="/store" className="font-semibold text-brand-700 hover:underline">
                    course store
                  </Link>{" "}
                  and it appears here.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Your institution enrols you into batches. Active courses will appear here.
                </p>
              )}
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {courses.slice(0, 6).map((c, idx) => {
                const tone = COURSE_TONES[idx % COURSE_TONES.length]!;
                const icon = COURSE_ICONS[idx % COURSE_ICONS.length]!;
                return (
                  <li key={c.course_id}>
                    <Link
                      to={courseHref(c.course_id)}
                      className={cn(
                        "group flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-gradient-to-br p-5 shadow-card ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-lift",
                        tone.panel,
                        tone.ring,
                      )}
                    >
                      <span
                        className={cn(
                          "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm",
                          tone.icon,
                        )}
                      >
                        <Icon name={icon} size={22} />
                      </span>
                      <span className="line-clamp-2 text-[15px] font-bold text-navy-950 group-hover:text-brand-800">
                        {c.title}
                      </span>
                      <span className="mt-1 text-xs font-medium text-slate-500">
                        {c.batch_id ? "Active enrollment" : "Enrolled"}
                      </span>
                      <span className="mt-auto flex items-center justify-between pt-5 text-sm font-semibold text-brand-700">
                        Continue
                        <Icon
                          name="chevronRight"
                          size={16}
                          className="transition-transform group-hover:translate-x-0.5"
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {takesTests && (
        <aside
          aria-labelledby="dash-upcoming-tasks"
          className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-card"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id="dash-upcoming-tasks" className="text-base font-bold text-navy-950">
              Upcoming tasks
            </h2>
            <Link to="/my-tests" className="text-xs font-semibold text-brand-700 hover:underline">
              All tests
            </Link>
          </div>

          {tests.length === 0 ? (
            <div className="py-8 text-center">
              <Icon name="check" size={28} className="mx-auto mb-2 text-brand-500" />
              <p className="text-sm font-semibold text-slate-700">All caught up</p>
              <p className="mt-1 text-xs text-slate-500">No tests open or pending right now.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tests.slice(0, 5).map((t, idx) => {
                const tones = ["bg-sky-50 text-sky-700", "bg-violet-50 text-violet-700", "bg-amber-50 text-amber-700"] as const;
                const chip = tones[idx % tones.length]!;
                return (
                  <li key={t.test_id}>
                    <Link
                      to="/my-tests"
                      className="group flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          chip,
                        )}
                      >
                        <Icon name="clipboardCheck" size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy-950 group-hover:text-brand-800">
                          {t.title}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {t.open_attempt_id ? (
                            <Badge tone="amber">In progress</Badge>
                          ) : t.can_start ? (
                            <Badge tone="green">Open now</Badge>
                          ) : (
                            <Badge tone="blue">Opens {formatDateTime(t.opens_at)}</Badge>
                          )}
                        </span>
                      </span>
                      <Icon
                        name="chevronRight"
                        size={16}
                        className="mt-1 shrink-0 text-slate-300 group-hover:text-brand-600"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            variant="secondary"
            className="mt-4 w-full rounded-2xl"
            icon="fileText"
            onClick={() => navigate("/my-tests")}
          >
            Open assessments
          </Button>
        </aside>
      )}
    </div>
  );
}
