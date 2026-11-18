import type { StartState } from "@/modules/career/resumes/components/new/StartChoices";
import type { CareerChoice } from "@/modules/career/resumes/components/wizard/CareerStep";
import type { RoleChoice } from "@/modules/career/resumes/components/wizard/RoleStep";

export interface ExperienceDraft {
  company: string;
  title: string;
  start: string; // YYYY-MM
  end: string;
  current: boolean;
  bullets: string; // one achievement per line
}

export interface EducationDraft {
  institution: string;
  degree: string;
  field: string;
  start: string;
  end: string;
  grade: string;
}

export interface ProjectDraft {
  name: string;
  description: string;
}

export interface AboutDraft {
  headline: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  summary: string;
}

export interface SkillDraft {
  name: string;
  category: string;
}

export interface WizardData {
  start: StartState;
  role: RoleChoice;
  career: CareerChoice;
  extras: Record<string, string>; // an extra section's label -> one entry per line
  templateKey: string;
  about: AboutDraft;
  experience: ExperienceDraft[];
  education: EducationDraft[];
  skills: SkillDraft[];
  projects: ProjectDraft[];
}

export type StepId = "role" | "career" | "start" | "review" | "template" | "about" | "experience" | "education" | "skills" | "extras" | "finish";

export const STEP_LABELS: Record<StepId, string> = {
  role: "Your role",
  career: "Your career",
  start: "Start",
  review: "Check import",
  template: "Template",
  about: "About you",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  extras: "More",
  finish: "Finish",
};

export const emptyExperience = (): ExperienceDraft => ({ company: "", title: "", start: "", end: "", current: false, bullets: "" });
export const emptyEducation = (): EducationDraft => ({ institution: "", degree: "", field: "", start: "", end: "", grade: "" });
export const emptyProject = (): ProjectDraft => ({ name: "", description: "" });
