import { cn } from "@/core/lib/cn";

export type CampusCollegeOption = {
  id: string;
  name: string;
  student_count: number;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const second = parts[1] ?? "";
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
}

type Props = {
  options: CampusCollegeOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
};

export function CampusCollegePicker({ options, selectedIds, onChange, loading }: Props) {
  const allSelected = options.length > 0 && selectedIds.length === options.length;

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const toggleAll = () => {
    onChange(allSelected ? [] : options.map((o) => o.id));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">
          {selectedIds.length} college{selectedIds.length === 1 ? "" : "s"} selected
        </p>
        <button
          type="button"
          disabled={!options.length || loading}
          onClick={toggleAll}
          className="text-sm font-semibold text-[#2b9fd4] hover:text-[#1e8fbe] disabled:opacity-50"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {loading && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Loading partner colleges…</p>
        )}
        {!loading && !options.length && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            No verified colleges are available yet.
          </p>
        )}
        {!loading &&
          options.map((college) => {
            const checked = selectedIds.includes(college.id);
            return (
              <label
                key={college.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0",
                  "hover:bg-slate-50/80",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(college.id)}
                  className="h-4 w-4 rounded border-slate-300 text-[#7DC8F7] focus:ring-[#7DC8F7]"
                />
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {initialsFromName(college.name)}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{college.name}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {college.student_count.toLocaleString()} students
                </span>
              </label>
            );
          })}
      </div>
      <p className="text-xs text-slate-500">
        Only students at selected colleges will see this job. Leave none selected to show it to all eligible
        students.
      </p>
    </div>
  );
}