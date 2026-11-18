const AREA = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-navy-950 focus:border-brand-500 focus:outline-none";

/**
 * The extra sections that matter in this profession (licences for a nurse, publications for a researcher, subjects taught
 * for a teacher), as the role catalogue defines them, plus a general one. Everything is optional: leave a box empty and
 * that section simply does not appear.
 */
export function ExtrasStep({ sections, achievementsLabel, value, onChange }: {
  sections: { label: string; hint: string }[];
  achievementsLabel: string;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const all = [...sections, { label: achievementsLabel, hint: "Awards, recognition, leadership, volunteering, languages: anything you are proud of and can stand behind." }];
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">All optional. One entry per line. Only add what is true and that you could show proof of.</p>
      {all.map((s) => (
        <label key={s.label} className="block">
          <span className="mb-1 block text-[13px] font-bold text-navy-950">{s.label}</span>
          <span className="mb-1.5 block text-xs text-slate-500">{s.hint}</span>
          <textarea rows={3} value={value[s.label] ?? ""} onChange={(e) => onChange({ ...value, [s.label]: e.target.value })} className={AREA} />
        </label>
      ))}
    </div>
  );
}
