import { ATTEMPT_RESULT_LABELS, ATTEMPT_STATUS_LABELS, INTEGRITY_STATUS_LABELS } from "@/modules/assessments/common/labels";
import type { AttemptFilters as Filters } from "@/modules/assessments/attempts/types";
import { Button, FilterRow, FilterSelect } from "@/shared/ui";

const STATUS_OPTIONS = Object.entries(ATTEMPT_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const RESULT_OPTIONS = Object.entries(ATTEMPT_RESULT_LABELS).map(([value, label]) => ({ value, label }));
const INTEGRITY_OPTIONS = Object.entries(INTEGRITY_STATUS_LABELS).map(([value, label]) => ({ value, label }));

interface AttemptFiltersProps {
  filters: Filters;
  activeCount: number;
  update(changes: Record<string, string | boolean | undefined>): void;
  reset(): void;
}

/** No free-text search: assessment-service's attempt list only filters by status/result/integrity. */
export function AttemptFilters({ filters, activeCount, update, reset }: AttemptFiltersProps) {
  return (
    <FilterRow activeCount={activeCount}>
      <FilterSelect label="Status" value={filters.status} options={STATUS_OPTIONS} onChange={(value) => update({ status: value })} />
      <FilterSelect label="Result" value={filters.result} options={RESULT_OPTIONS} onChange={(value) => update({ result: value })} />
      <FilterSelect label="Integrity" value={filters.integrity_status} options={INTEGRITY_OPTIONS} onChange={(value) => update({ integrity_status: value })} />
      {activeCount > 0 && (
        <Button variant="ghost" onClick={reset}>
          Clear ({activeCount})
        </Button>
      )}
    </FilterRow>
  );
}
