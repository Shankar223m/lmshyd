import type { ReactNode } from "react";

import {
  emptyEducation,
  emptyExperience,
  type AboutDraft,
  type EducationDraft,
  type ExperienceDraft,
} from "@/modules/career/resumes/components/wizard/wizardTypes";
import { Button, Input } from "@/shared/ui";

const AREA = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-navy-950 focus:border-brand-500 focus:outline-none";

function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[13px] font-bold text-navy-950">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Card({ title, onRemove, children }: { title: string; onRemove?: () => void; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-navy-950">{title}</p>
        {onRemove && <button type="button" onClick={onRemove} className="text-xs font-semibold text-slate-500 hover:text-rose-600">Remove</button>}
      </div>
      {children}
    </div>
  );
}

export function AboutStep({ value, onChange }: { value: AboutDraft; onChange: (next: Partial<AboutDraft>) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Headline" hint="One line under your name, e.g. “Final-year CSE student”" className="sm:col-span-2">
        <Input value={value.headline} maxLength={160} onChange={(e) => onChange({ headline: e.target.value })} />
      </Field>
      <Field label="Phone"><Input value={value.phone} inputMode="tel" onChange={(e) => onChange({ phone: e.target.value })} /></Field>
      <Field label="City"><Input value={value.location} onChange={(e) => onChange({ location: e.target.value })} /></Field>
      <Field label="LinkedIn"><Input value={value.linkedin} placeholder="https://linkedin.com/in/…" onChange={(e) => onChange({ linkedin: e.target.value })} /></Field>
      <Field label="GitHub or portfolio"><Input value={value.github} placeholder="https://…" onChange={(e) => onChange({ github: e.target.value })} /></Field>
      <Field label="Summary" hint="2–3 sentences. You can let the AI polish it later." className="sm:col-span-2">
        <textarea rows={4} value={value.summary} maxLength={600} onChange={(e) => onChange({ summary: e.target.value })} className={AREA} />
      </Field>
    </div>
  );
}

export function ExperienceStep({ value, onChange, label = "Work experience" }: { value: ExperienceDraft[]; onChange: (next: ExperienceDraft[]) => void; label?: string }) {
  const set = (i: number, patch: Partial<ExperienceDraft>) => onChange(value.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{label}: jobs, internships, clinical placements, teaching posts or freelance work. None yet? Skip this step.</p>
      {value.map((e, i) => (
        <Card key={i} title={e.title || e.company || `Role ${i + 1}`} onRemove={() => onChange(value.filter((_, idx) => idx !== i))}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Job title"><Input value={e.title} onChange={(ev) => set(i, { title: ev.target.value })} /></Field>
            <Field label="Company"><Input value={e.company} onChange={(ev) => set(i, { company: ev.target.value })} /></Field>
            <Field label="Start"><Input type="month" value={e.start} onChange={(ev) => set(i, { start: ev.target.value })} /></Field>
            <Field label="End"><Input type="month" value={e.end} disabled={e.current} onChange={(ev) => set(i, { end: ev.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={e.current} onChange={(ev) => set(i, { current: ev.target.checked, end: "" })} /> I work here now
            </label>
            <Field label="What did you do?" hint="One achievement per line. Numbers help." className="sm:col-span-2">
              <textarea rows={3} value={e.bullets} onChange={(ev) => set(i, { bullets: ev.target.value })} className={AREA} />
            </Field>
          </div>
        </Card>
      ))}
      <Button variant="secondary" icon="plus" onClick={() => onChange([...value, emptyExperience()])}>{value.length ? "Add another role" : "Add a role"}</Button>
    </div>
  );
}

export function EducationStep({ value, onChange }: { value: EducationDraft[]; onChange: (next: EducationDraft[]) => void }) {
  const set = (i: number, patch: Partial<EducationDraft>) => onChange(value.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  return (
    <div className="space-y-4">
      {value.map((e, i) => (
        <Card key={i} title={e.institution || `Education ${i + 1}`} onRemove={() => onChange(value.filter((_, idx) => idx !== i))}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="College or school" className="sm:col-span-2"><Input value={e.institution} onChange={(ev) => set(i, { institution: ev.target.value })} /></Field>
            <Field label="Degree"><Input value={e.degree} placeholder="B.Tech" onChange={(ev) => set(i, { degree: ev.target.value })} /></Field>
            <Field label="Field of study"><Input value={e.field} placeholder="Computer Science" onChange={(ev) => set(i, { field: ev.target.value })} /></Field>
            <Field label="Start"><Input type="month" value={e.start} onChange={(ev) => set(i, { start: ev.target.value })} /></Field>
            <Field label="End (or expected)"><Input type="month" value={e.end} onChange={(ev) => set(i, { end: ev.target.value })} /></Field>
            <Field label="CGPA or percentage"><Input value={e.grade} onChange={(ev) => set(i, { grade: ev.target.value })} /></Field>
          </div>
        </Card>
      ))}
      <Button variant="secondary" icon="plus" onClick={() => onChange([...value, emptyEducation()])}>{value.length ? "Add more education" : "Add education"}</Button>
    </div>
  );
}
