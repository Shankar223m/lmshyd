import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { cn } from "@/core/lib/cn";
import { useGetResultsSummaryQuery } from "@/modules/assessments/results/api/resultsApi";
import { useListCoursesQuery } from "@/modules/catalog/courses/api/coursesApi";
import { useListTestsQuery } from "@/modules/assessments/tests/api/testsApi";
import { useGetAcademicsQuery, useGetSectionStudentsQuery } from "@/modules/user-management/academics/api/academicsApi";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { useInstitutionOptions } from "@/modules/user-management/common/hooks/useEntityOptions";
import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";
import { Alert, Button, Card, EmptyState, EntityPicker, Field, PageHeader, Select, Spinner, StatTile } from "@/shared/ui";

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A section's marks: one row per student, one column per test (best score, pass or not, attempts). */
export function ResultsPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const own = user?.institution?.organization_id;
  const organizationId = own ?? params.get("organization_id") ?? "";
  const courseFilter = params.get("course_id") ?? "";
  const testFilter = params.get("test_id") ?? "";

  const { data: structure } = useGetAcademicsQuery(organizationId, { skip: !organizationId });
  const sections = useMemo(
    () => (structure?.departments ?? []).flatMap((d) => d.programs.flatMap((p) => p.sections.map((s) => ({ value: s.section_id, label: `${s.label} · ${d.code}` })))),
    [structure],
  );
  const [sectionId, setSectionId] = useState("");
  const chosen = sectionId || sections[0]?.value || "";
  const { data: roster, isFetching: loadingRoster } = useGetSectionStudentsQuery({ organizationId, sectionId: chosen }, { skip: !organizationId || !chosen });
  const userIds = (roster?.students ?? []).map((s) => s.user_id);

  const { data: courseList } = useListCoursesQuery({ per_page: 100, published_only: false }, { skip: !can("catalog") && !can("assessments") });
  const courseOptions = useMemo(
    () => [{ value: "", label: "All courses" }, ...(courseList?.items ?? []).map((c) => ({ value: c.course_id, label: c.title }))],
    [courseList],
  );

  const { data: courseTests } = useListTestsQuery(
    { per_page: 200, target_id: courseFilter || undefined },
    { skip: !courseFilter },
  );
  const courseTestIds = useMemo(
    () => new Set((courseTests?.items ?? []).map((t) => t.test_id)),
    [courseTests],
  );

  const { data: results, isFetching: loadingResults } = useGetResultsSummaryQuery(
    { user_ids: userIds, test_id: testFilter || undefined },
    { skip: userIds.length === 0 },
  );

  const filteredTests = useMemo(() => {
    let tests = results?.tests ?? [];
    if (courseFilter) {
      tests = tests.filter((t) => courseTestIds.has(t.test_id));
    }
    if (testFilter) {
      tests = tests.filter((t) => t.test_id === testFilter);
    }
    return tests;
  }, [results?.tests, courseFilter, courseTestIds, testFilter]);

  const filteredTestIds = new Set(filteredTests.map((t) => t.test_id));
  const filteredRows = (results?.rows ?? []).filter((r) => filteredTestIds.has(r.test_id));

  const cell = new Map(filteredRows.map((r) => [`${r.user_id}:${r.test_id}`, r]));
  const attempted = new Set(filteredRows.map((r) => r.user_id)).size;
  const passes = filteredRows.filter((r) => r.passed).length;
  const average = filteredRows.length ? Math.round(filteredRows.reduce((sum, r) => sum + (r.best_percent ?? 0), 0) / filteredRows.length) : null;

  const testOptions = useMemo(
    () => [{ value: "", label: "All tests" }, ...filteredTests.map((t) => ({ value: t.test_id, label: t.title }))],
    [filteredTests],
  );

  const exportCsv = useCallback(() => {
    const header = ["Student", "Admission #", ...filteredTests.map((t) => t.title)];
    const lines = (roster?.students ?? []).map((s) => {
      const scores = filteredTests.map((t) => {
        const r = cell.get(`${s.user_id}:${t.test_id}`);
        if (!r) return "Not taken";
        if (r.best_percent == null) return "Pending";
        return `${Math.round(r.best_percent)}% (${r.passed ? "pass" : "fail"}, ${r.attempts} attempts)`;
      });
      return [s.full_name, s.admission_number ?? "", ...scores];
    });
    downloadCsv(`marks-section-${chosen || "export"}.csv`, [header, ...lines]);
  }, [cell, chosen, filteredTests, roster?.students]);

  const canSeeMarks = can("academics") || can("assessments");

  return (
    <>
      <PageHeader
        title="Marks & results"
        description="Each student's best score on every test, section by section."
        actions={
          <Link to="/academics/student-progress" className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Student progress
          </Link>
        }
      />

      {!canSeeMarks && (
        <Alert tone="warning" className="mb-5" title="Limited access">
          You need the Academics or Exams permission to view all students. If you were just granted access, sign out and back in so permissions refresh.
        </Alert>
      )}

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {!own && (
            <EntityPicker
              label="Institution"
              value={organizationId}
              selectedLabel={params.get("organization_label") ?? undefined}
              useOptions={useInstitutionOptions}
              onChange={(id, label) => {
                setSectionId("");
                const next = new URLSearchParams(params);
                if (id) {
                  next.set("organization_id", id);
                  next.set("organization_label", label);
                } else {
                  next.delete("organization_id");
                  next.delete("organization_label");
                }
                setParams(next);
              }}
            />
          )}
          <Field label="Section">
            {(p) => (
              <Select
                {...p}
                value={chosen}
                disabled={sections.length === 0}
                placeholder={sections.length ? undefined : "No sections yet"}
                options={sections}
                onChange={(e) => setSectionId(e.target.value)}
              />
            )}
          </Field>
          <Field label="Course (optional)" hint="Narrows to tests tied to this course target.">
            {(p) => (
              <Select
                {...p}
                value={courseFilter}
                options={courseOptions}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  const v = e.target.value;
                  if (v) next.set("course_id", v);
                  else next.delete("course_id");
                  next.delete("test_id");
                  setParams(next);
                }}
              />
            )}
          </Field>
          <Field label="Test (optional)">
            {(p) => (
              <Select
                {...p}
                value={testFilter}
                disabled={filteredTests.length === 0}
                options={testOptions}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  const v = e.target.value;
                  if (v) next.set("test_id", v);
                  else next.delete("test_id");
                  setParams(next);
                }}
              />
            )}
          </Field>
        </div>
      </Card>

      {!organizationId ? (
        <EmptyState icon="building" title="Choose an institution" description="Platform staff pick an institution above. Institution admins see their own org automatically." />
      ) : sections.length === 0 ? (
        <EmptyState icon="layers" title="No sections yet" description="Set up departments, programs and sections under Academic structure first." />
      ) : loadingRoster || loadingResults ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : userIds.length === 0 ? (
        <EmptyState icon="users" title="No students in this section" description="Place students in it under Academic structure." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="grid flex-1 grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon="users" label="Students" value={userIds.length} />
              <StatTile icon="fileText" label="Took a test" value={attempted} />
              <StatTile icon="check" label="Passes" value={passes} />
              <StatTile icon="chart" label="Average best score" value={average == null ? "—" : `${average}%`} />
            </div>
            {filteredTests.length > 0 && (
              <Button variant="secondary" onClick={exportCsv}>
                Export CSV
              </Button>
            )}
          </div>
          {filteredTests.length === 0 ? (
            <EmptyState
              icon="fileText"
              title="No test results yet"
              description={
                courseFilter
                  ? "No submitted attempts match this course filter yet, or topic tests use a different target. Clear the course filter to see all tests."
                  : "Results appear here once these students submit a test."
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-card">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">Student</th>
                    {filteredTests.map((t) => (
                      <th key={t.test_id} className="px-4 py-3" title={`Pass mark ${t.pass_mark_percent}%`}>
                        <span className="block max-w-48 truncate normal-case tracking-normal text-navy-950">{t.title}</span>
                        <span className="block font-normal normal-case tracking-normal">pass {t.pass_mark_percent}%</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(roster?.students ?? []).map((s) => (
                    <tr key={s.user_id}>
                      <td className="sticky left-0 z-10 bg-white px-4 py-3">
                        <span className="block font-semibold text-navy-950">{s.full_name}</span>
                        <span className="block text-xs text-slate-500">{s.admission_number}</span>
                      </td>
                      {filteredTests.map((t) => {
                        const r = cell.get(`${s.user_id}:${t.test_id}`);
                        return (
                          <td key={t.test_id} className="px-4 py-3">
                            {r ? (
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ring-1",
                                    r.passed ? "bg-brand-50 text-brand-700 ring-brand-100" : "bg-accent-50 text-accent-700 ring-accent-100",
                                  )}
                                >
                                  {r.best_percent == null ? "Pending" : `${Math.round(r.best_percent)}%`}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {r.attempts} try{r.attempts === 1 ? "" : "s"}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Not taken</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
