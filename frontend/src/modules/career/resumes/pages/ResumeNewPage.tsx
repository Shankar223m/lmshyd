import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useNotify } from "@/core/hooks/useNotify";
import { cn } from "@/core/lib/cn";
import {
  useAddProfileItemsMutation,
  useGetMyCareerProfileQuery,
  useImportResumeFileMutation,
  useUpdateCareerProfileMutation,
} from "@/modules/career/profile/api/profileApi";
import type { ImportResult } from "@/modules/career/profile/types";
import {
  useCreateResumeMutation,
  useGetResumeOptionsQuery,
  useListResumeTemplatesQuery,
} from "@/modules/career/resumes/api/resumesApi";
import { useGetRoleProfileQuery } from "@/modules/career/resumes/api/taxonomyApi";
import { ImportReview } from "@/modules/career/resumes/components/new/ImportReview";
import { StartChoices } from "@/modules/career/resumes/components/new/StartChoices";
import { CareerStep, EMPTY_CAREER } from "@/modules/career/resumes/components/wizard/CareerStep";
import { AboutStep, EducationStep, ExperienceStep } from "@/modules/career/resumes/components/wizard/DetailSteps";
import { ExtrasStep } from "@/modules/career/resumes/components/wizard/ExtrasStep";
import { EMPTY_ROLE, RoleStep } from "@/modules/career/resumes/components/wizard/RoleStep";
import { SkillsStep } from "@/modules/career/resumes/components/wizard/SkillsStep";
import { TemplateStep } from "@/modules/career/resumes/components/wizard/TemplateStep";
import { buildItems, buildProfileFields } from "@/modules/career/resumes/components/wizard/wizardPayload";
import { STEP_LABELS, type StepId, type WizardData } from "@/modules/career/resumes/components/wizard/wizardTypes";
import { useShowTitleInTopBar } from "@/shared/layout/pageTitle";
import { Alert, Button, EmptyState, Icon, PageLoader } from "@/shared/ui";

const DRAFT_KEY = "lms.resumeWizard.v1";

function readDraft(): { data: WizardData; step: StepId } | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as { data: WizardData; step: StepId }) : null;
  } catch {
    return null;
  }
}

function writeDraft(value: { data: WizardData; step: StepId } | null) {
  try {
    if (value) window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...value, data: { ...value.data, start: { ...value.data.start, file: null } } }));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* private window or blocked storage: the wizard simply does not remember */
  }
}

const EMPTY_ABOUT = { headline: "", phone: "", location: "", linkedin: "", github: "", summary: "" };
const TITLES: Record<StepId, string> = {
  role: "What job are you aiming for?",
  career: "Tell us about your career",
  start: "How do you want to start?",
  review: "Check what we found",
  template: "Choose a template",
  about: "About you",
  experience: "Your experience",
  education: "Your education",
  skills: "Your skills",
  extras: "Anything else worth adding?",
  finish: "Ready to build",
};

/** Making a resume for any profession, one clear step at a time. The suggestions, headings and extra sections adapt to the chosen role. */
export function ResumeNewPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  useShowTitleInTopBar("New resume");
  const { data: options } = useGetResumeOptionsQuery();
  const { data: templates = [] } = useListResumeTemplatesQuery();
  const { data: profile } = useGetMyCareerProfileQuery();
  const [readFile, { isLoading: reading }] = useImportResumeFileMutation();
  const [addItems] = useAddProfileItemsMutation();
  const [updateProfile] = useUpdateCareerProfileMutation();
  const [create, { isLoading: creating }] = useCreateResumeMutation();

  const [data, setData] = useState<WizardData | null>(null);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<StepId>("role");
  const [error, setError] = useState<string | null>(null);
  const prefilled = useRef(false);
  const templatePicked = useRef(false);

  const role = data?.role;
  const { data: roleProfile } = useGetRoleProfileQuery(
    { role: role?.roleKey || null, department: role?.departmentKey || null, customRole: role?.roleKey ? null : role?.roleName || null },
    { skip: !role?.roleName },
  );

  useEffect(() => {
    if (!options || data) return;
    const saved = readDraft();
    if (saved?.data?.role) {
      prefilled.current = true;
      templatePicked.current = Boolean(saved.data.templateKey);
      setData(saved.data);
      setStep(saved.step === "review" ? "start" : saved.step);
      return;
    }
    setData({
      start: { start: options.start_options[0]?.key ?? "profile", level: "", role: "", file: null },
      role: EMPTY_ROLE,
      career: EMPTY_CAREER,
      extras: {},
      templateKey: "",
      about: EMPTY_ABOUT,
      experience: [],
      education: [],
      skills: [],
      projects: [],
    });
  }, [options, data]);

  useEffect(() => {
    if (!data || !profile || prefilled.current) return;
    prefilled.current = true;
    const p = profile.profile;
    setData({ ...data, about: { ...data.about, headline: p.headline ?? "", phone: p.phone ?? "", location: p.location ?? "", summary: p.summary ?? "" } });
  }, [data, profile]);

  // The role decides which layout is recommended first; a layout the person picked themselves is never overridden.
  useEffect(() => {
    if (!data || templatePicked.current || templates.length === 0) return;
    const recommended = roleProfile?.template_keys.find((k) => templates.some((t) => t.key === k)) ?? templates[0]?.key ?? "";
    if (recommended && data.templateKey !== recommended) setData({ ...data, templateKey: recommended });
  }, [data, roleProfile, templates]);

  useEffect(() => {
    if (data) writeDraft({ data, step });
  }, [data, step]);

  const steps = useMemo<StepId[]>(
    () => (imported ? ["role", "career", "start", "review", "template", "about", "experience", "education", "skills", "extras", "finish"] : ["role", "career", "start", "template", "about", "experience", "education", "skills", "extras", "finish"]),
    [imported],
  );

  if (!options || !data) return <PageLoader />;
  if (templates.length === 0) return <EmptyState icon="alert" title="No templates available" description="Please try again in a moment." />;

  const patch = (next: Partial<WizardData>) => setData({ ...data, ...next });
  const index = steps.indexOf(step);
  const startOption = options.start_options.find((o) => o.key === data.start.start);
  const needsFile = Boolean(startOption?.accepts.length);
  const busy = reading || creating;
  const labels = roleProfile?.sections.labels;
  const roleName = data.role.roleName + (data.role.specialization ? ` (${data.role.specialization})` : "");

  const go = (delta: number) => {
    setError(null);
    const target = steps[index + delta];
    if (target) setStep(target);
    else if (delta < 0) navigate("/career/resumes");
  };

  const next = async () => {
    setError(null);
    if (step === "role" && !data.role.roleName.trim()) return setError("Pick your job title from the list, or type it and choose “Use … as my job title”.");
    if (step === "career" && !data.career.level) return setError("Choose where you are in your career. It decides how the resume is ordered.");
    if (step === "start" && needsFile && !imported) {
      if (!data.start.file) return setError("Choose the file to read, or pick another way to start.");
      try {
        const result = await readFile(data.start.file).unwrap();
        setImported(result);
        setChosen(new Set(result.items.map((_, i) => i)));
        setStep("review");
      } catch (e) {
        notify.apiError(e, "Could not read that file");
        setError("We could not read that file. Try another one, or start from your profile instead.");
      }
      return;
    }
    go(1);
  };

  const finish = async () => {
    setError(null);
    try {
      const entries = (imported ? imported.items.filter((_, i) => chosen.has(i)).map(({ kind, data: d }) => ({ kind, data: d })) : []).concat(buildItems(data));
      if (entries.length) await addItems(entries).unwrap();
      const fields = { ...(imported ? Object.fromEntries(Object.entries(imported.profile).filter(([, v]) => v)) : {}), ...buildProfileFields(data.about), target_roles: [data.role.roleName.trim()] };
      await updateProfile(fields).unwrap().catch(() => undefined);
      const resume = await create({
        title: roleName.slice(0, 120),
        target_role: data.role.roleName.trim(),
        role_key: data.role.roleKey || null,
        career_level: data.career.level,
        purpose: data.career.purpose,
        locale: { ...(data.career.country ? { country: data.career.country } : {}), language: data.career.language, date_format: data.career.dateFormat },
        template_key: data.templateKey,
        blank: data.start.start === "blank" && entries.length === 0,
      }).unwrap();
      writeDraft(null);
      notify.success("Your resume is ready");
      navigate(`/career/resumes/${resume.resume_id}`);
    } catch (e) {
      notify.apiError(e, "Could not create the resume");
    }
  };

  const counts = [
    ["Roles", data.experience.filter((e) => e.company && e.title).length],
    ["Education", data.education.filter((e) => e.institution && e.degree).length],
    ["Skills", data.skills.length],
    ["Extras", Object.values(data.extras).reduce((n, v) => n + v.split("\n").filter((l) => l.trim()).length, 0)],
  ];
  const last = step === "finish";
  const optional = ["experience", "education", "skills", "extras"].includes(step);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <ol aria-label="Progress" className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1" aria-current={s === step ? "step" : undefined}>
            <span className={cn("flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold", s === step ? "bg-brand-700 text-white" : i < index ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500")}>
              {i < index ? <Icon name="check" size={13} /> : <span>{i + 1}</span>}
              {s === "experience" && labels ? labels.experience.split(" ")[0] : STEP_LABELS[s]}
            </span>
            {i < steps.length - 1 && <span className="h-px w-3 bg-slate-200" />}
          </li>
        ))}
      </ol>

      <section className="space-y-5 rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/60 sm:p-7">
        <header>
          <h2 className="text-xl font-bold tracking-tight text-navy-950">{step === "experience" && labels ? labels.experience : TITLES[step]}</h2>
          {roleProfile && step !== "role" && <p className="mt-1 text-sm text-slate-500">{roleProfile.why}</p>}
        </header>

        {error && <Alert tone="warning" title="One more thing">{error}</Alert>}

        {step === "role" && <RoleStep value={data.role} onChange={(next) => patch({ role: next })} />}
        {step === "career" && <CareerStep value={data.career} onChange={(next) => patch({ career: next })} />}
        {step === "start" && <StartChoices onlyStart options={options} value={data.start} onChange={(n) => { setError(null); patch({ start: { ...data.start, ...n } }); }} />}
        {step === "review" && imported && (
          <ImportReview
            result={imported}
            chosen={chosen}
            onToggle={(i) => setChosen((c) => { const n = new Set(c); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
            onSelectAll={() => setChosen(new Set(imported.items.map((_, i) => i)))}
            onDeselectAll={() => setChosen(new Set())}
          />
        )}
        {step === "template" && <TemplateStep templates={templates} value={data.templateKey} onChange={(templateKey) => { templatePicked.current = true; patch({ templateKey }); }} recommended={roleProfile?.template_keys} roleName={data.role.roleName} />}
        {step === "about" && <AboutStep value={data.about} onChange={(n) => patch({ about: { ...data.about, ...n } })} />}
        {step === "experience" && <ExperienceStep label={labels?.experience} value={data.experience} onChange={(experience) => patch({ experience })} />}
        {step === "education" && <EducationStep value={data.education} onChange={(education) => patch({ education })} />}
        {step === "skills" && (
          <SkillsStep
            roleName={data.role.roleName}
            suggestions={roleProfile?.skills ?? []}
            groups={roleProfile?.sections.skill_groups ?? []}
            skills={data.skills}
            onSkills={(skills) => patch({ skills })}
            showProjects={roleProfile?.sections.projects_step ?? false}
            projects={data.projects}
            onProjects={(projects) => patch({ projects })}
          />
        )}
        {step === "extras" && <ExtrasStep sections={roleProfile?.sections.extra_sections ?? []} achievementsLabel={labels?.achievements ?? "Achievements"} value={data.extras} onChange={(extras) => patch({ extras })} />}
        {step === "finish" && (
          <div className="space-y-4 text-sm text-slate-700">
            <p>We will build a <b>{templates.find((t) => t.key === data.templateKey)?.name}</b> resume for <b>{roleName}</b> from:</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {counts.map(([label, n]) => (
                <li key={label} className="rounded-xl bg-slate-50 p-3 text-center ring-1 ring-slate-200/60"><span className="block text-2xl font-extrabold text-navy-950">{n}</span><span className="text-xs text-slate-500">{label}</span></li>
              ))}
            </ul>
            <p className="text-slate-500">In the editor you will see your score against what recruiters in your field look for, AI writing help in your field's own words, and you can change your role any time without losing your content.</p>
          </div>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-[272px]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => go(-1)} disabled={busy}>{index === 0 ? "Cancel" : "Back"}</Button>
            <Button variant="ghost" onClick={() => { notify.success("Saved. You can continue any time."); navigate("/career/resumes"); }} disabled={busy}>Save &amp; exit</Button>
          </div>
          <div className="flex items-center gap-2">
            {optional && <Button variant="ghost" onClick={() => go(1)}>Skip</Button>}
            <Button loading={busy} onClick={() => void (last ? finish() : next())}>{last ? "Create my resume" : "Continue"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
