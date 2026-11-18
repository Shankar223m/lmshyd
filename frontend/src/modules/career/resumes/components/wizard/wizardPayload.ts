import type { ItemKind } from "@/modules/career/common/types";
import type { AboutDraft, WizardData } from "@/modules/career/resumes/components/wizard/wizardTypes";

/** Only what the student actually typed. Nothing is filled in on their behalf. */
export function buildItems(data: WizardData): { kind: ItemKind; data: Record<string, unknown> }[] {
  const items: { kind: ItemKind; data: Record<string, unknown> }[] = [];
  for (const e of data.experience) {
    if (!e.company.trim() || !e.title.trim()) continue;
    items.push({
      kind: "experience",
      data: {
        company: e.company.trim(),
        title: e.title.trim(),
        current: e.current,
        ...(e.start ? { start_date: e.start } : {}),
        ...(!e.current && e.end ? { end_date: e.end } : {}),
        bullets: e.bullets.split("\n").map((b) => b.trim()).filter(Boolean),
      },
    });
  }
  for (const e of data.education) {
    if (!e.institution.trim() || !e.degree.trim()) continue;
    items.push({
      kind: "education",
      data: {
        institution: e.institution.trim(),
        degree: e.degree.trim(),
        ...(e.field.trim() ? { field_of_study: e.field.trim() } : {}),
        ...(e.grade.trim() ? { grade: e.grade.trim() } : {}),
        ...(e.start ? { start_date: e.start } : {}),
        ...(e.end ? { end_date: e.end } : {}),
      },
    });
  }
  for (const skill of data.skills.slice(0, 40)) items.push({ kind: "skill", data: { name: skill.name, ...(skill.category ? { category: skill.category } : {}) } });
  for (const [label, lines] of Object.entries(data.extras)) {
    for (const line of lines.split("\n").map((l) => l.trim()).filter(Boolean)) items.push({ kind: "achievement", data: { title: line.slice(0, 150), description: label.slice(0, 400) } });
  }
  for (const p of data.projects) {
    if (p.name.trim()) items.push({ kind: "project", data: { name: p.name.trim(), description: p.description.trim() } });
  }
  return items;
}

export function buildProfileFields(about: AboutDraft) {
  const links = [
    about.linkedin.trim() && { label: "LinkedIn", url: about.linkedin.trim() },
    about.github.trim() && { label: "GitHub", url: about.github.trim() },
  ].filter(Boolean) as { label: string; url: string }[];
  return {
    ...(about.headline.trim() ? { headline: about.headline.trim() } : {}),
    ...(about.summary.trim() ? { summary: about.summary.trim() } : {}),
    ...(about.phone.trim() ? { phone: about.phone.trim() } : {}),
    ...(about.location.trim() ? { location: about.location.trim() } : {}),
    ...(links.length ? { links } : {}),
  };
}
