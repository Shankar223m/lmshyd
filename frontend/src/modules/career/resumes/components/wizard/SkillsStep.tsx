import { useState } from "react";

import { cn } from "@/core/lib/cn";
import { emptyProject, type ProjectDraft, type SkillDraft } from "@/modules/career/resumes/components/wizard/wizardTypes";
import { Button, Input } from "@/shared/ui";

const AREA = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-navy-950 focus:border-brand-500 focus:outline-none";

/**
 * Skills for the person's own field. The catalogue suggests; nothing is added until the person taps it, because a skill
 * they have not confirmed must never appear on their resume.
 */
export function SkillsStep({ roleName, suggestions, groups, skills, onSkills, showProjects, projects, onProjects }: {
  roleName: string;
  suggestions: { name: string; why: string }[];
  groups: string[];
  skills: SkillDraft[];
  onSkills: (next: SkillDraft[]) => void;
  showProjects: boolean;
  projects: ProjectDraft[];
  onProjects: (next: ProjectDraft[]) => void;
}) {
  const [group, setGroup] = useState(groups[0] ?? "");
  const [custom, setCustom] = useState("");
  const has = (name: string) => skills.some((s) => s.name.toLowerCase() === name.toLowerCase());
  const add = (name: string) => {
    const clean = name.trim();
    if (clean && !has(clean)) onSkills([...skills, { name: clean, category: group }]);
  };
  const setProject = (i: number, patch: Partial<ProjectDraft>) => onProjects(projects.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <h3 className="text-sm font-bold text-navy-950">Suggested for {roleName || "your role"}</h3>
        <p className="text-xs text-slate-500">Tap only the ones you really have. Ignore the rest.</p>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s.name} type="button" title={s.why} aria-pressed={has(s.name)} onClick={() => (has(s.name) ? onSkills(skills.filter((k) => k.name.toLowerCase() !== s.name.toLowerCase())) : add(s.name))} className={cn("min-h-[34px] rounded-full px-3.5 text-[13px] font-semibold transition", has(s.name) ? "bg-brand-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300")}>
              {has(s.name) ? "✓ " : "+ "}{s.name}
            </button>
          ))}
        </div>
        {suggestions[0] && <p className="text-xs text-slate-500">Why these: {suggestions[0].why.toLowerCase()}.</p>}
      </section>

      <section className="space-y-2.5">
        <h3 className="text-sm font-bold text-navy-950">Add your own</h3>
        <div className="flex flex-wrap gap-2">
          <Input className="min-w-[200px] flex-1" value={custom} maxLength={60} placeholder="Any skill, tool or ability" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(custom); setCustom(""); } }} />
          {groups.length > 0 && (
            <select aria-label="Skill group" value={group} onChange={(e) => setGroup(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-950 focus:border-brand-500 focus:outline-none">
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          <Button variant="secondary" onClick={() => { add(custom); setCustom(""); }} disabled={!custom.trim()}>Add</Button>
        </div>
        {groups.map((g) => {
          const inGroup = skills.filter((s) => s.category === g);
          return inGroup.length === 0 ? null : (
            <div key={g}>
              <p className="mb-1 text-xs font-bold text-slate-500">{g}</p>
              <div className="flex flex-wrap gap-1.5">
                {inGroup.map((s) => (
                  <span key={s.name} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-[13px] font-semibold text-navy-950">
                    {s.name}
                    <button type="button" aria-label={`Remove ${s.name}`} onClick={() => onSkills(skills.filter((k) => k.name !== s.name))} className="flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-rose-600">×</button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {showProjects && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-navy-950">Projects <span className="font-normal text-slate-500">(optional)</span></h3>
          {projects.map((p, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-navy-950">{p.name || `Project ${i + 1}`}</p>
                <button type="button" onClick={() => onProjects(projects.filter((_, idx) => idx !== i))} className="text-xs font-semibold text-slate-500 hover:text-rose-600">Remove</button>
              </div>
              <Input value={p.name} placeholder="Name" onChange={(e) => setProject(i, { name: e.target.value })} />
              <textarea rows={2} value={p.description} placeholder="What it does and what you did" onChange={(e) => setProject(i, { description: e.target.value })} className={AREA} />
            </div>
          ))}
          <Button variant="secondary" icon="plus" onClick={() => onProjects([...projects, emptyProject()])}>Add a project</Button>
        </section>
      )}
    </div>
  );
}
