import { useMemo, useState } from "react";
import { Building2, Plus, Users } from "lucide-react";

import { useDebouncedValue } from "@/core/hooks/useDebouncedValue";
import { useNotify } from "@/core/hooks/useNotify";
import { useGetCourseQuery } from "@/modules/catalog/courses/api/coursesApi";
import { useSearchDirectoryQuery } from "@/modules/user-management/common/api/directoryApi";
import {
  useGrantSubscriptionMutation,
  useListSubscriptionsQuery,
} from "@/modules/subscriptions/subscriptions/api/subscriptionsApi";
import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";
import { Button, PageLoader } from "@/shared/ui";

type InstitutionAccessRow = {
  organization_id: string;
  institution_name: string;
  seats_total: number;
  starts_at?: string | null;
  ends_at?: string | null;
};

type Props = {
  courseId: string;
};

export function CourseInstitutionAccessPanel({ courseId }: Props) {
  const notify = useNotify();
  const { holds } = usePermissions();
  const canGrant = holds("accounts.manage");

  const { data: course, isLoading: courseLoading } = useGetCourseQuery(courseId);
  const { data: subsData, isLoading: subsLoading, refetch } = useListSubscriptionsQuery(
    { status: "active", per_page: 200 },
    { skip: !canGrant },
  );

  const [institutionSearch, setInstitutionSearch] = useState("GenZ Test");
  const debouncedSearch = useDebouncedValue(institutionSearch, 250);
  const { data: directoryData } = useSearchDirectoryQuery(
    { type: "institution", search_text: debouncedSearch || undefined, per_page: 25 },
    { skip: !canGrant },
  );

  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [seats, setSeats] = useState("500");
  const [termDays, setTermDays] = useState("365");
  const [grant, { isLoading: granting }] = useGrantSubscriptionMutation();

  const accessFromCourse = (course as { institutions_with_access?: InstitutionAccessRow[] } | undefined)
    ?.institutions_with_access;

  const activeForCourse = useMemo(() => {
    const fromSubs =
      subsData?.items?.filter((s) => String(s.course_id) === String(courseId) && s.status === "active") ?? [];
    const orgNames = new Map(
      (accessFromCourse ?? []).map((r) => [String(r.organization_id), r.institution_name]),
    );
    return fromSubs.map((s) => ({
      subscription_id: s.subscription_id,
      organization_id: s.organization_id,
      institution_name: orgNames.get(String(s.organization_id)) ?? `Institution ${s.organization_id}`,
      seats_total: s.seats_total,
      seats_used: s.seats_used,
      ends_at: s.ends_at,
    }));
  }, [subsData, courseId, accessFromCourse]);

  const assignedOrgIds = useMemo(
    () => new Set(activeForCourse.map((r) => String(r.organization_id))),
    [activeForCourse],
  );

  const handleGrant = async () => {
    if (!selectedOrgId) {
      notify.error("Choose a college first.");
      return;
    }
    const seatN = Math.max(1, Number(seats) || 100);
    const termN = Math.max(1, Number(termDays) || 365);
    try {
      await grant({
        organization_id: selectedOrgId,
        course_id: courseId,
        seats: seatN,
        term_days: termN,
      }).unwrap();
      notify.success("College assigned", "Students at this institution can now see and open this course.");
      setSelectedOrgId("");
      void refetch();
    } catch (e) {
      notify.apiError(e, "Could not assign college");
    }
  };

  if (!canGrant) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-600">
        You need <strong>accounts.manage</strong> permission to assign colleges to courses.
      </div>
    );
  }

  if (courseLoading || subsLoading) {
    return <PageLoader label="Loading college access..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Assign colleges</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
            Grant this course to an institution. Licensed students only see courses their university holds — no extra
            purchase step.
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 lg:grid-cols-[1fr_120px_120px_auto]">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          College
          <input
            type="search"
            value={institutionSearch}
            onChange={(e) => setInstitutionSearch(e.target.value)}
            placeholder="Search e.g. GenZ Test College"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"
          />
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="mt-1 h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
          >
            <option value="">Select institution…</option>
            {(directoryData?.items ?? [])
              .filter((o) => !assignedOrgIds.has(String(o.organization_id)))
              .map((o) => (
                <option key={o.organization_id} value={o.organization_id}>
                  {o.name} ({o.code})
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          Seats
          <input
            type="number"
            min={1}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          Term (days)
          <input
            type="number"
            min={1}
            value={termDays}
            onChange={(e) => setTermDays(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"
          />
        </label>
        <div className="flex items-end">
          <Button type="button" variant="primary" loading={granting} className="h-10 w-full gap-1.5" onClick={() => void handleGrant()}>
            <Plus size={16} />
            Assign college
          </Button>
        </div>
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-700">
          <Building2 size={14} />
          Colleges with access
        </h4>
        {activeForCourse.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">
            No colleges assigned yet. Use the form above to grant access.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {activeForCourse.map((row) => (
              <li key={row.subscription_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{row.institution_name}</p>
                  <p className="text-[11px] text-slate-500">Org ID {row.organization_id}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Users size={14} className="text-slate-400" />
                  {row.seats_used} / {row.seats_total} seats
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}