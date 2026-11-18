import { cn } from "@/core/lib/cn";
import { useListCareerLevelsQuery, useListPurposesQuery } from "@/modules/career/resumes/api/taxonomyApi";
import { Input } from "@/shared/ui";

export interface CareerChoice {
  level: string;
  purpose: string;
  country: string;
  language: string;
  dateFormat: string;
}

export const EMPTY_CAREER: CareerChoice = { level: "", purpose: "job", country: "", language: "English", dateFormat: "MMM YYYY" };

const DATE_FORMATS = [
  { value: "MMM YYYY", label: "Jan 2024" },
  { value: "MM/YYYY", label: "01/2024" },
  { value: "YYYY-MM", label: "2024-01" },
];

function Cards<T extends { key: string; name: string; note: string }>({ items, value, onChange }: { items: T[]; value: string; onChange: (key: string) => void }) {
  return (
    <div role="radiogroup" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const on = item.key === value;
        return (
          <button key={item.key} type="button" role="radio" aria-checked={on} onClick={() => onChange(item.key)} className={cn("rounded-xl border p-3 text-left transition", on ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600/30" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")}>
            <span className="block text-[13px] font-bold text-navy-950">{item.name}</span>
            <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{item.note}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Where you are in your career, what the resume is for, and the conventions of your country. All options come from the server. */
export function CareerStep({ value, onChange }: { value: CareerChoice; onChange: (next: CareerChoice) => void }) {
  const { data: levels = [] } = useListCareerLevelsQuery();
  const { data: purposes = [] } = useListPurposesQuery();
  const patch = (next: Partial<CareerChoice>) => onChange({ ...value, ...next });
  return (
    <div className="space-y-7">
      <section className="space-y-2.5">
        <h3 className="text-sm font-bold text-navy-950">Where are you in your career?</h3>
        <Cards items={levels} value={value.level} onChange={(level) => patch({ level })} />
      </section>
      <section className="space-y-2.5">
        <h3 className="text-sm font-bold text-navy-950">What is this resume for?</h3>
        <Cards items={purposes} value={value.purpose} onChange={(purpose) => patch({ purpose })} />
      </section>
      <section className="space-y-2.5">
        <h3 className="text-sm font-bold text-navy-950">Where will you send it? <span className="font-normal text-slate-500">(optional)</span></h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label><span className="mb-1.5 block text-[13px] font-bold text-navy-950">Country</span><Input value={value.country} maxLength={2} placeholder="IN, US, UK, AE…" onChange={(e) => patch({ country: e.target.value.toUpperCase() })} /></label>
          <label><span className="mb-1.5 block text-[13px] font-bold text-navy-950">Language</span><Input value={value.language} maxLength={30} onChange={(e) => patch({ language: e.target.value })} /></label>
          <label>
            <span className="mb-1.5 block text-[13px] font-bold text-navy-950">Date style</span>
            <select value={value.dateFormat} onChange={(e) => patch({ dateFormat: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-950 focus:border-brand-500 focus:outline-none">
              {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-500">We never add a photo, date of birth or home address unless you choose to.</p>
      </section>
    </div>
  );
}
