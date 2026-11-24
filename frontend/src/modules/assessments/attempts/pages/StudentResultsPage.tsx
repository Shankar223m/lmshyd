import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { formatDateTime } from "@/core/lib/format";
import { useListAttemptsQuery, useListMyTestsQuery } from "@/modules/assessments/attempts/api/attemptsApi";
import type { AttemptResult } from "@/modules/assessments/common/types";
import { Badge, Button, Card, EmptyState, Icon, PageHeader, PageLoader, StatTile } from "@/shared/ui";
import { cn } from "@/core/lib/cn";

export function StudentResultsPage() {
  const navigate = useNavigate();
  const [filterResult, setFilterResult] = useState<"all" | "passed" | "failed">("all");
  const [search, setSearch] = useState("");

  const { data: attemptsData, isLoading: loadingAttempts } = useListAttemptsQuery({ page: 1, per_page: 100 });
  const { data: myTests, isLoading: loadingTests } = useListMyTestsQuery({});

  const testsMap = useMemo(() => {
    const map = new Map<string, { title: string; passMark: number; totalMarks: number | null }>();
    if (myTests) {
      for (const t of myTests) {
        map.set(t.test_id, {
          title: t.title,
          passMark: t.pass_mark_percent,
          totalMarks: t.total_marks,
        });
      }
    }
    return map;
  }, [myTests]);

  const attempts = attemptsData?.items ?? [];

  // Summary stats
  const completedAttempts = attempts.filter((a) => a.status === "graded" || a.status === "submitted");
  const passedAttempts = completedAttempts.filter((a) => a.result === "passed");
  const scores = completedAttempts.filter((a) => a.percent != null).map((a) => a.percent as number);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highestScore = scores.length ? Math.max(...scores) : 0;

  // Filtered list
  const filteredAttempts = useMemo(() => {
    return completedAttempts.filter((a) => {
      if (filterResult !== "all" && a.result !== (filterResult as AttemptResult)) return false;
      if (search) {
        const testInfo = testsMap.get(a.test_id);
        const title = testInfo?.title?.toLowerCase() ?? "";
        if (!title.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [completedAttempts, filterResult, search, testsMap]);

  if (loadingAttempts && loadingTests) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Test Results"
        description="Review your completed test attempts, scores, and comprehensive scorecards."
        actions={
          <Button onClick={() => navigate("/my-tests")} className="bg-[#7DC8F7] hover:bg-[#5CB8EC] text-white">
            <Icon name="clipboardCheck" size={16} className="mr-1.5" />
            My Tests
          </Button>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          icon="clipboardCheck"
          label="Tests Attempted"
          value={completedAttempts.length}
        />
        <StatTile
          icon="check"
          label="Passed Tests"
          value={passedAttempts.length}
        />
        <StatTile
          icon="chart"
          label="Average Score"
          value={`${avgScore}%`}
        />
        <StatTile
          icon="award"
          label="Highest Score"
          value={`${highestScore}%`}
        />
      </div>

      {/* Results Card */}
      <Card
        title="Attempt History"
        description="All your submitted test sessions and evaluation results"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search tests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-44 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs placeholder:text-slate-400 focus:border-[#7DC8F7] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex rounded-xl bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setFilterResult("all")}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition-colors cursor-pointer",
                  filterResult === "all" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-500 hover:text-slate-900"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterResult("passed")}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition-colors cursor-pointer",
                  filterResult === "passed" ? "bg-white text-emerald-700 shadow-xs font-semibold" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Passed
              </button>
              <button
                type="button"
                onClick={() => setFilterResult("failed")}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition-colors cursor-pointer",
                  filterResult === "failed" ? "bg-white text-rose-700 shadow-xs font-semibold" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Failed
              </button>
            </div>
          </div>
        }
      >
        {filteredAttempts.length === 0 ? (
          <EmptyState
            icon="chart"
            title={attempts.length === 0 ? "No test results yet" : "No matching results"}
            description={
              attempts.length === 0
                ? "When you take tests, your scores and detailed performance scorecards will appear here."
                : "Try adjusting your search or result status filter."
            }
            action={
              attempts.length === 0 ? (
                <Button onClick={() => navigate("/my-tests")} className="bg-[#7DC8F7] hover:bg-[#5CB8EC] text-white">
                  Browse Available Tests
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden">
            {filteredAttempts.map((attempt) => {
              const testInfo = testsMap.get(attempt.test_id);
              const testTitle = testInfo?.title ?? `Test (${attempt.test_id.substring(0, 8)})`;
              const isPassed = attempt.result === "passed";
              const isFail = attempt.result === "failed";
              const percent = attempt.percent != null ? Math.round(attempt.percent) : null;

              return (
                <div
                  key={attempt.attempt_id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4 px-2 hover:bg-slate-50/70 transition-colors rounded-xl"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-xs",
                        isPassed ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : isFail ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      <Icon name={isPassed ? "check" : isFail ? "x" : "clock"} size={20} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {testTitle}
                        </h4>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          Attempt #{attempt.attempt_no}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {attempt.submitted_at && (
                          <span>Submitted {formatDateTime(attempt.submitted_at)}</span>
                        )}
                        {attempt.score != null && attempt.max_score != null && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span>
                              Score: <strong className="text-slate-700">{attempt.score} / {attempt.max_score}</strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      {percent != null ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-lg font-bold text-slate-900">{percent}%</span>
                          <Badge tone={isPassed ? "green" : isFail ? "red" : "gray"}>
                            {isPassed ? "Passed" : isFail ? "Failed" : "Submitted"}
                          </Badge>
                        </div>
                      ) : (
                        <Badge tone="gray">Evaluating</Badge>
                      )}
                    </div>

                    <Link
                      to={`/attempts/${attempt.attempt_id}/result`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:border-[#7DC8F7] hover:text-[#7DC8F7] hover:bg-[#E8F6FE]/30 transition-all cursor-pointer"
                    >
                      <span>View Scorecard</span>
                      <Icon name="chevronRight" size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
