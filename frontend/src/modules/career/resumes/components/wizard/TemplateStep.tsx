import { ResumeDocumentView } from "@/modules/career/common/components/ResumeDocumentView";
import type { ResumeDocument } from "@/modules/career/common/types";
import { cn } from "@/core/lib/cn";
import type { ResumeTemplate } from "@/modules/career/resumes/types";
import { Icon } from "@/shared/ui";

/** Made-up person, used only to show what each layout looks like. Never saved. */
const SAMPLE: ResumeDocument = {
  personal: { name: "Your Name", email: "you@email.com", headline: "Target role", phone: "+91 00000 00000", location: "City", links: [] },
  summary: "A short summary of who you are and what you bring to the role.",
  sections: [
    { key: "experience", title: "Experience", entries: [{ item_id: "1", kind: "experience", verified: false, heading: "Job title", subheading: "Company", dates: "2023 – Present", location: null, bullets: ["Delivered a result you are proud of", "Worked with a team to ship a feature"] }] },
    { key: "education", title: "Education", entries: [{ item_id: "2", kind: "education", verified: false, heading: "Degree", subheading: "College", dates: "2019 – 2023", location: null, bullets: [] }] },
    { key: "skills", title: "Skills", entries: [{ item_id: "3", kind: "skill", verified: false, heading: "Skill one, Skill two, Skill three", subheading: null, dates: null, location: null, bullets: [] }] },
  ],
};

/** Pick a look from real thumbnails. It can be changed later in the editor's Design tab. */
export function TemplateStep({ templates, value, onChange, recommended = [], roleName }: { templates: ResumeTemplate[]; value: string; onChange: (key: string) => void; recommended?: string[]; roleName?: string | null }) {
  const ordered = [...templates].sort((a, b) => Number(recommended.includes(b.key)) - Number(recommended.includes(a.key)) || recommended.indexOf(a.key) - recommended.indexOf(b.key));
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Pick a layout. Every one is readable by hiring software, and you can change it any time.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((t) => {
          const selected = t.key === value;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(t.key)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border bg-white text-left transition",
                selected ? "border-brand-600 ring-2 ring-brand-600/30" : "border-slate-200 hover:border-slate-300 hover:shadow-card",
              )}
            >
              <div className="pointer-events-none relative h-[250px] overflow-hidden bg-slate-100">
                <div className="absolute left-1/2 top-3 w-[680px] origin-top -translate-x-1/2 scale-[0.33] bg-white shadow-lift">
                  <ResumeDocumentView document={SAMPLE} templateKey={t.key} accentColor="emerald" showVerified={false} />
                </div>
                {selected && (
                  <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-white shadow-card">
                    <Icon name="check" size={16} />
                  </span>
                )}
              </div>
              <div className="border-t border-slate-100 px-3.5 py-3">
                <p className="text-sm font-bold text-navy-950">{t.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.description}</p>
                {recommended.includes(t.key) && <span className="mt-1.5 mr-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Recommended{roleName ? ` for ${roleName}` : ""}</span>}
                {t.ats_safe && <span className="mt-1.5 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">ATS-safe</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
