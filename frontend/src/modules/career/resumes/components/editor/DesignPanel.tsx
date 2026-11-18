import { cn } from "@/core/lib/cn";
import type { ResumeTemplate } from "@/modules/career/resumes/types";

export interface Look {
  fontFamily: "sans" | "serif" | "mono";
  fontSize: "sm" | "base" | "lg";
  spacing: "compact" | "normal" | "spacious";
  accentColor: "indigo" | "navy" | "emerald" | "slate" | "black";
}

const FONTS: { value: Look["fontFamily"]; label: string }[] = [
  { value: "sans", label: "Modern" },
  { value: "serif", label: "Classic" },
  { value: "mono", label: "Technical" },
];
const SIZES: { value: Look["fontSize"]; label: string }[] = [
  { value: "sm", label: "Compact" },
  { value: "base", label: "Regular" },
  { value: "lg", label: "Large" },
];
const SPACING: { value: Look["spacing"]; label: string }[] = [
  { value: "compact", label: "Tight" },
  { value: "normal", label: "Standard" },
  { value: "spacious", label: "Airy" },
];
const COLOURS: { value: Look["accentColor"]; label: string; swatch: string }[] = [
  { value: "emerald", label: "Green", swatch: "bg-emerald-600" },
  { value: "navy", label: "Navy", swatch: "bg-slate-800" },
  { value: "indigo", label: "Indigo", swatch: "bg-indigo-600" },
  { value: "slate", label: "Slate", swatch: "bg-slate-500" },
  { value: "black", label: "Black", swatch: "bg-black" },
];

function Group<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold text-slate-500">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-slate-100/80 p-1 ring-1 ring-slate-200/60">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn("h-8 flex-1 rounded-lg text-[13px] font-semibold", o.value === value ? "bg-white text-navy-950 shadow-card" : "text-slate-600 hover:text-navy-950")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Everything about how the page looks, in one place: template, colour, font, size and spacing. Changes show at once in the preview. */
export function DesignPanel({ templates, templateKey, onTemplate, look, onLook }: {
  templates: ResumeTemplate[];
  templateKey: string;
  onTemplate: (key: string) => void;
  look: Look;
  onLook: (next: Partial<Look>) => void;
}) {
  return (
    <div className="space-y-5 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/60">
      <div>
        <p className="mb-1.5 text-xs font-bold text-slate-500">Template</p>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={t.key === templateKey}
              onClick={() => onTemplate(t.key)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                t.key === templateKey ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600/30" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <span className="block text-[13px] font-bold text-navy-950">{t.name}</span>
              {t.description && <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 line-clamp-2">{t.description}</span>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-bold text-slate-500">Accent colour</p>
        <div role="radiogroup" aria-label="Accent colour" className="flex gap-2">
          {COLOURS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={c.value === look.accentColor}
              aria-label={c.label}
              title={c.label}
              onClick={() => onLook({ accentColor: c.value })}
              className={cn("h-8 w-8 rounded-full ring-offset-2 transition", c.swatch, c.value === look.accentColor ? "ring-2 ring-navy-950" : "hover:scale-110")}
            />
          ))}
        </div>
      </div>

      <Group label="Font" value={look.fontFamily} options={FONTS} onChange={(fontFamily) => onLook({ fontFamily })} />
      <Group label="Text size" value={look.fontSize} options={SIZES} onChange={(fontSize) => onLook({ fontSize })} />
      <Group label="Spacing" value={look.spacing} options={SPACING} onChange={(spacing) => onLook({ spacing })} />
    </div>
  );
}
