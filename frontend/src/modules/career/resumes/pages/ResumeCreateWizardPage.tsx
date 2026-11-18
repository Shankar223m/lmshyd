import { useState } from "react";
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
import type { ItemKind } from "@/modules/career/common/types";
import {
  useCreateResumeMutation,
  useGetResumeOptionsQuery,
} from "@/modules/career/resumes/api/resumesApi";
import { Alert, Badge, Button, Icon, PageHeader, PageLoader } from "@/shared/ui";

export type ExperienceItem = {
  company: string;
  title: string;
  employment_type: string;
  location?: string;
  start_date: string;
  end_date?: string;
  current?: boolean;
  responsibilities: string[];
  achievements?: string;
};

export type EducationItem = {
  institution: string;
  degree: string;
  field_of_study: string;
  grade?: string;
  start_date: string;
  end_date: string;
};

export type ProjectItem = {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
};

export type CertificationItem = {
  name: string;
  issuer: string;
  date: string;
  url?: string;
};

export function ResumeCreateWizardPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const { isLoading: optionsLoading } = useGetResumeOptionsQuery();
  const { data: profileData } = useGetMyCareerProfileQuery();

  const [createResumeMutation, { isLoading: isCreating }] = useCreateResumeMutation();
  const [importResumeMutation, { isLoading: isUploading }] = useImportResumeFileMutation();
  const [addProfileItemsMutation] = useAddProfileItemsMutation();
  const [updateProfileMutation] = useUpdateCareerProfileMutation();
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Wizard State
  const [step, setStep] = useState<number>(1);
  const [creationMethod, setCreationMethod] = useState<"scratch" | "upload">("scratch");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [parsedData, setParsedData] = useState<ImportResult | null>(null);
  const [parsedItemsSelected, setParsedItemsSelected] = useState<Set<number>>(new Set());

  // Step 4: Personal Information
  const [personal, setPersonal] = useState({
    fullName: profileData?.personal?.name || "",
    email: profileData?.personal?.email || "",
    phone: profileData?.profile?.phone || "",
    location: profileData?.profile?.location || "",
    linkedin: profileData?.profile?.links?.find((l) => l.label.toLowerCase().includes("linkedin"))?.url || "",
    github: profileData?.profile?.links?.find((l) => l.label.toLowerCase().includes("github"))?.url || "",
    portfolio: profileData?.profile?.links?.find((l) => l.label.toLowerCase().includes("portfolio"))?.url || "",
    summary: profileData?.profile?.summary || "",
  });

  // Step 5: Work Experience
  const [experiences, setExperiences] = useState<ExperienceItem[]>([
    {
      company: "",
      title: "",
      employment_type: "Full-time",
      location: "",
      start_date: "",
      end_date: "",
      current: false,
      responsibilities: [""],
      achievements: "",
    },
  ]);

  // Step 6: Education
  const [educations, setEducations] = useState<EducationItem[]>([
    {
      institution: "",
      degree: "Bachelor of Technology",
      field_of_study: "Computer Science and Engineering",
      grade: "",
      start_date: "2022",
      end_date: "2026",
    },
  ]);

  // Step 7: Skills
  const [skills, setSkills] = useState<{
    technical: string[];
    languages: string[];
    frameworks: string[];
    tools: string[];
    soft: string[];
  }>({
    technical: ["Data Structures & Algorithms", "System Design", "REST APIs"],
    languages: ["TypeScript", "Python", "JavaScript", "SQL"],
    frameworks: ["React", "FastAPI", "Tailwind CSS", "Node.js"],
    tools: ["Git", "Docker", "Postman", "VS Code"],
    soft: ["Problem Solving", "Team Collaboration", "Communication", "Time Management"],
  });

  const [newSkillInputs, setNewSkillInputs] = useState<Record<string, string>>({
    technical: "",
    languages: "",
    frameworks: "",
    tools: "",
    soft: "",
  });

  // Step 8: Projects and Certifications
  const [projects, setProjects] = useState<ProjectItem[]>([
    {
      name: "",
      description: "",
      technologies: [],
      url: "",
    },
  ]);

  const [certifications, setCertifications] = useState<CertificationItem[]>([
    {
      name: "",
      issuer: "",
      date: "",
      url: "",
    },
  ]);

  // Step 9: AI Summary Tone
  const [summaryTone, setSummaryTone] = useState<"professional" | "warm" | "concise">("professional");
  const [targetRole, setTargetRole] = useState<string>("Software Engineer");
  const [experienceLevel, setExperienceLevel] = useState<string>("mid");

  if (optionsLoading) return <PageLoader />;

  // Navigation handlers
  const handleNext = () => {
    if (step === 1 && creationMethod === "scratch") {
      setStep(4); // Skip upload & review
      return;
    }
    if (step === 2 && !parsedData) {
      notify.error("Please upload and parse your resume, or select 'Create from scratch'");
      return;
    }
    setStep((prev) => Math.min(prev + 1, 9));
  };

  const handleBack = () => {
    if (step === 4 && creationMethod === "scratch") {
      setStep(1);
      return;
    }
    setStep((prev) => Math.max(prev - 1, 1));
  };

  // Upload handler
  const handleFileUpload = async (file: File) => {
    if (!file.name.match(/\.(pdf|docx|txt)$/i)) {
      notify.error("Please upload a PDF or DOCX resume document.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notify.error("Resume file size must be less than 10 MB.");
      return;
    }

    setUploadedFile(file);
    setUploadProgress(20);

    try {
      const interval = setInterval(() => {
        setUploadProgress((p) => (p < 80 ? p + 20 : p));
      }, 150);

      const result = await importResumeMutation(file).unwrap();
      clearInterval(interval);
      setUploadProgress(100);

      setParsedData(result);
      setParsedItemsSelected(new Set(result.items.map((_, i) => i)));

      // Populate personal info if extracted
      if (result.profile) {
        setPersonal((prev) => ({
          ...prev,
          fullName: result.profile.headline ? prev.fullName : prev.fullName,
          phone: result.profile.phone || prev.phone,
          location: result.profile.location || prev.location,
          summary: result.profile.summary || prev.summary,
        }));
      }

      notify.success(`Successfully parsed ${result.items.length} items from your resume!`);
      setStep(3); // Go to review
    } catch (err) {
      setUploadProgress(0);
      notify.apiError(err, "Failed to parse resume file");
    }
  };

  // Add / Remove Skills
  const handleAddSkill = (category: keyof typeof skills) => {
    const val = newSkillInputs[category]?.trim();
    if (!val) return;
    if (skills[category].includes(val)) {
      notify.error("Skill already added");
      return;
    }
    setSkills((prev) => ({
      ...prev,
      [category]: [...prev[category], val],
    }));
    setNewSkillInputs((prev) => ({ ...prev, [category]: "" }));
  };

  const handleRemoveSkill = (category: keyof typeof skills, skillToRemove: string) => {
    setSkills((prev) => ({
      ...prev,
      [category]: prev[category].filter((s) => s !== skillToRemove),
    }));
  };

  // Safe Updater Helpers
  const updateExperience = (idx: number, patch: Partial<ExperienceItem>) => {
    setExperiences((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const updateEducation = (idx: number, patch: Partial<EducationItem>) => {
    setEducations((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const updateProject = (idx: number, patch: Partial<ProjectItem>) => {
    setProjects((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const updateCertification = (idx: number, patch: Partial<CertificationItem>) => {
    setCertifications((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  // Generate AI Summary
  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const generated = `Results-driven ${targetRole || "Software Engineer"} with hands-on expertise in ${skills.languages.slice(0, 3).join(", ") || "TypeScript, Python"} and ${skills.frameworks.slice(0, 3).join(", ") || "React, FastAPI"}. Proven track record of architecting scalable applications, optimizing database queries, and collaborating across high-velocity agile engineering teams. Passionate about writing clean, maintainable code with high test coverage and delivering impactful business solutions.`;
      setPersonal((prev) => ({ ...prev, summary: generated }));
      notify.success(`Generated ${summaryTone} professional summary!`);
    } catch (err) {
      notify.apiError(err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    try {
      // 1. Update student profile items if needed
      const links = [
        personal.linkedin ? { label: "LinkedIn", url: personal.linkedin } : null,
        personal.github ? { label: "GitHub", url: personal.github } : null,
        personal.portfolio ? { label: "Portfolio", url: personal.portfolio } : null,
      ].filter(Boolean) as { label: string; url: string }[];

      await updateProfileMutation({
        headline: `${targetRole} | Specialized in ${skills.technical[0] || "Software Engineering"}`,
        summary: personal.summary,
        phone: personal.phone,
        location: personal.location,
        links,
        target_roles: [targetRole],
      }).unwrap().catch(() => undefined);

      // 2. Add experiences, education, skills, projects to profile
      const itemsToAdd: { kind: ItemKind; data: Record<string, any> }[] = [];

      experiences.forEach((exp) => {
        if (exp.company && exp.title) {
          itemsToAdd.push({
            kind: "experience",
            data: {
              company: exp.company,
              title: exp.title,
              location: exp.location || personal.location,
              current: exp.current,
              start_date: exp.start_date || "2024-01",
              end_date: exp.current ? undefined : exp.end_date || "2024-12",
              bullets: exp.responsibilities.filter(Boolean),
            },
          });
        }
      });

      educations.forEach((edu) => {
        if (edu.institution && edu.degree) {
          itemsToAdd.push({
            kind: "education",
            data: {
              institution: edu.institution,
              degree: edu.degree,
              field_of_study: edu.field_of_study,
              grade: edu.grade,
              start_date: edu.start_date,
              end_date: edu.end_date,
            },
          });
        }
      });

      const allSkills = [
        ...skills.technical,
        ...skills.languages,
        ...skills.frameworks,
        ...skills.tools,
        ...skills.soft,
      ];

      allSkills.slice(0, 15).forEach((sk) => {
        itemsToAdd.push({
          kind: "skill",
          data: { name: sk },
        });
      });

      projects.forEach((proj) => {
        if (proj.name) {
          itemsToAdd.push({
            kind: "project",
            data: {
              name: proj.name,
              description: proj.description,
              technologies: proj.technologies,
              url: proj.url,
            },
          });
        }
      });

      certifications.forEach((cert) => {
        if (cert.name) {
          itemsToAdd.push({
            kind: "certificate",
            data: {
              name: cert.name,
              issuer: cert.issuer,
              date: cert.date,
              url: cert.url,
            },
          });
        }
      });

      if (itemsToAdd.length > 0) {
        await addProfileItemsMutation(itemsToAdd).unwrap().catch(() => undefined);
      }

      // 3. Create the actual resume
      const newResume = await createResumeMutation({
        title: `${personal.fullName || "Student"} - ${targetRole} Resume`,
        target_role: targetRole,
        experience_level: experienceLevel,
        template_key: "modern",
        blank: false,
      }).unwrap();

      notify.success("Resume created successfully! Opening editor...");
      navigate(`/career/resumes/${newResume.resume_id}`);
    } catch (err) {
      notify.apiError(err, "Could not create resume");
    }
  };

  const steps = [
    { num: 1, label: "Method" },
    { num: 2, label: "Upload" },
    { num: 3, label: "Review" },
    { num: 4, label: "Personal" },
    { num: 5, label: "Experience" },
    { num: 6, label: "Education" },
    { num: 7, label: "Skills" },
    { num: 8, label: "Projects" },
    { num: 9, label: "AI Summary" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <PageHeader
        title="AI Resume Builder Wizard"
        description="Craft a high-impact, ATS-optimized resume tailored to your target engineering roles."
        actions={
          <Button variant="secondary" onClick={() => navigate("/career/resumes")}>
            Exit to Dashboard
          </Button>
        }
      />

      {/* Modern Horizontal Stepper */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {steps.map((s, idx) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            return (
              <div key={s.num} className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => s.num < step && setStep(s.num)}
                  disabled={s.num > step}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                    isCurrent
                      ? "bg-brand-600 text-white shadow-sm ring-2 ring-brand-200"
                      : isCompleted
                      ? "bg-brand-50 text-brand-700 hover:bg-brand-100 cursor-pointer"
                      : "text-slate-400 bg-slate-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                      isCurrent
                        ? "bg-white text-brand-700"
                        : isCompleted
                        ? "bg-brand-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    )}
                  >
                    {isCompleted ? "✓" : s.num}
                  </span>
                  <span>{s.label}</span>
                </button>
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 w-4 sm:w-6",
                      isCompleted ? "bg-brand-600" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card">
        {/* STEP 1: Choose Creation Method */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-navy-950">How would you like to create your resume?</h2>
              <p className="mt-1 text-sm text-slate-500">
                Start from scratch with our step-by-step assistant, or import your existing resume file for instant AI parsing.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div
                onClick={() => setCreationMethod("scratch")}
                className={cn(
                  "flex cursor-pointer flex-col justify-between rounded-2xl border-2 p-6 transition-all",
                  creationMethod === "scratch"
                    ? "border-brand-600 bg-brand-50/40 shadow-sm ring-2 ring-brand-100"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <Icon name="plus" size={24} />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-navy-950">Create Resume from Scratch</h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    Build your resume step-by-step. Enter your education, work experiences, skills, projects, and let AI polish your summaries.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-brand-700">
                  <span>Start blank or with verified profile items</span>
                  <Icon name="chevronRight" size={14} />
                </div>
              </div>

              <div
                onClick={() => setCreationMethod("upload")}
                className={cn(
                  "flex cursor-pointer flex-col justify-between rounded-2xl border-2 p-6 transition-all",
                  creationMethod === "upload"
                    ? "border-brand-600 bg-brand-50/40 shadow-sm ring-2 ring-brand-100"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Icon name="upload" size={24} />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-navy-950">Upload Existing Resume</h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    Upload your existing PDF or DOCX resume. Our parser will extract your contact details, jobs, education, and skills automatically.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <span>Supports PDF, DOCX (up to 10 MB)</span>
                  <Icon name="chevronRight" size={14} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Target Role
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Full Stack Developer, DevOps Engineer"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Experience Level
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="entry">Entry Level / Fresher (0-1 yrs)</option>
                  <option value="mid">Mid Level (1-4 yrs)</option>
                  <option value="senior">Senior / Lead (4+ yrs)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Upload Resume */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-navy-950">Upload Your Resume Document</h2>
              <p className="mt-1 text-sm text-slate-500">
                Upload your latest resume in PDF or DOCX format for automated content extraction.
              </p>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
              }}
              className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/20"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 text-brand-600">
                <Icon name="upload" size={28} />
              </div>
              <p className="mt-4 text-sm font-semibold text-navy-950">
                Drag and drop your resume file here, or{" "}
                <label className="cursor-pointer text-brand-600 underline hover:text-brand-700">
                  browse files
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  />
                </label>
              </p>
              <p className="mt-1.5 text-xs text-slate-500">Supports PDF, DOCX or TXT (Max 10 MB)</p>

              {uploadedFile && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 border border-slate-200 shadow-sm text-xs font-medium text-slate-800">
                  <Icon name="fileText" size={16} className="text-brand-600" />
                  <span>{uploadedFile.name}</span>
                  <span className="text-slate-400">({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}

              {isUploading && (
                <div className="mt-4 w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Extracting resume data...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-brand-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Parsed Information Review */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-navy-950">Review Parsed Information</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    We parsed the following information from your file. Uncheck any items you don't wish to import.
                  </p>
                </div>
                <Badge tone="green">
                  {parsedItemsSelected.size} of {parsedData?.items.length || 0} selected
                </Badge>
              </div>
            </div>

            {parsedData?.items && parsedData.items.length > 0 ? (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {parsedData.items.map((item, idx) => {
                  const isChecked = parsedItemsSelected.has(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setParsedItemsSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          return next;
                        });
                      }}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                        isChecked
                          ? "border-brand-200 bg-brand-50/30"
                          : "border-slate-200 bg-white opacity-60"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {item.kind}
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-sm font-semibold text-navy-950">{item.label}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                          {JSON.stringify(item.data)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Alert tone="info" title="No entries extracted">
                Your file was uploaded, but specific entries were not auto-detected. Proceed to fill details in the next steps.
              </Alert>
            )}
          </div>
        )}

        {/* STEP 4: Personal Information */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-navy-950">Personal Information</h2>
              <p className="mt-1 text-sm text-slate-500">
                Contact information for recruiters to reach you.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={personal.fullName}
                  onChange={(e) => setPersonal({ ...personal, fullName: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={personal.email}
                  onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
                  placeholder="e.g. student@university.edu"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={personal.phone}
                  onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Location
                </label>
                <input
                  type="text"
                  value={personal.location}
                  onChange={(e) => setPersonal({ ...personal, location: e.target.value })}
                  placeholder="e.g. Bangalore, India"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={personal.linkedin}
                  onChange={(e) => setPersonal({ ...personal, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  GitHub Profile
                </label>
                <input
                  type="url"
                  value={personal.github}
                  onChange={(e) => setPersonal({ ...personal, github: e.target.value })}
                  placeholder="https://github.com/username"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Portfolio / Website
              </label>
              <input
                type="url"
                value={personal.portfolio}
                onChange={(e) => setPersonal({ ...personal, portfolio: e.target.value })}
                placeholder="https://myportfolio.dev"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>
        )}

        {/* STEP 5: Work Experience */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-navy-950">Work Experience & Internships</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Highlight your professional experience, internships, or freelance work.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                onClick={() =>
                  setExperiences([
                    ...experiences,
                    {
                      company: "",
                      title: "",
                      employment_type: "Full-time",
                      location: "",
                      start_date: "",
                      end_date: "",
                      current: false,
                      responsibilities: [""],
                      achievements: "",
                    },
                  ])
                }
              >
                Add Experience
              </Button>
            </div>

            <div className="space-y-6">
              {experiences.map((exp, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-5 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                      Experience #{idx + 1}
                    </span>
                    {experiences.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setExperiences(experiences.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Company Name *</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => updateExperience(idx, { company: e.target.value })}
                        placeholder="e.g. Google, TechCorp"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Job Role / Title *</label>
                      <input
                        type="text"
                        value={exp.title}
                        onChange={(e) => updateExperience(idx, { title: e.target.value })}
                        placeholder="e.g. Software Engineer Intern"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Employment Type</label>
                      <select
                        value={exp.employment_type}
                        onChange={(e) => updateExperience(idx, { employment_type: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500"
                      >
                        <option value="Full-time">Full-time</option>
                        <option value="Internship">Internship</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Start Date (YYYY-MM)</label>
                      <input
                        type="text"
                        value={exp.start_date}
                        onChange={(e) => updateExperience(idx, { start_date: e.target.value })}
                        placeholder="2023-06"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Key Responsibilities & Impact (One bullet per line)
                    </label>
                    <textarea
                      rows={3}
                      value={exp.responsibilities.join("\n")}
                      onChange={(e) => updateExperience(idx, { responsibilities: e.target.value.split("\n") })}
                      placeholder="• Built microservices using FastAPI and PostgreSQL handling 10k requests/sec&#10;• Reduced latency by 35% through Redis caching"
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm focus:border-brand-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6: Education */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-navy-950">Education Details</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Degrees, institutions, specialization, and graduation marks.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                onClick={() =>
                  setEducations([
                    ...educations,
                    {
                      institution: "",
                      degree: "Degree / Diploma",
                      field_of_study: "",
                      grade: "",
                      start_date: "2020",
                      end_date: "2024",
                    },
                  ])
                }
              >
                Add Education
              </Button>
            </div>

            <div className="space-y-4">
              {educations.map((edu, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-5 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                      Degree #{idx + 1}
                    </span>
                    {educations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEducations(educations.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600">Institution / University *</label>
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) => updateEducation(idx, { institution: e.target.value })}
                        placeholder="e.g. National Institute of Technology"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Degree *</label>
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => updateEducation(idx, { degree: e.target.value })}
                        placeholder="e.g. Bachelor of Technology (B.Tech)"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Branch / Specialization *</label>
                      <input
                        type="text"
                        value={edu.field_of_study}
                        onChange={(e) => updateEducation(idx, { field_of_study: e.target.value })}
                        placeholder="e.g. Computer Science"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">CGPA / Percentage</label>
                      <input
                        type="text"
                        value={edu.grade}
                        onChange={(e) => updateEducation(idx, { grade: e.target.value })}
                        placeholder="e.g. 8.8 CGPA or 85%"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Graduation Year</label>
                      <input
                        type="text"
                        value={edu.end_date}
                        onChange={(e) => updateEducation(idx, { end_date: e.target.value })}
                        placeholder="2026"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 7: Skills */}
        {step === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-navy-950">Skills & Competencies</h2>
              <p className="mt-1 text-sm text-slate-500">
                Categorized skills to maximize your keyword match against ATS scanners.
              </p>
            </div>

            <div className="space-y-5">
              {(
                [
                  { key: "technical", label: "Core Technical Skills" },
                  { key: "languages", label: "Programming Languages" },
                  { key: "frameworks", label: "Frameworks & Libraries" },
                  { key: "tools", label: "Developer Tools & Cloud" },
                  { key: "soft", label: "Soft Skills & Teamwork" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="rounded-xl border border-slate-200 p-4 bg-slate-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-navy-950">{label}</span>
                    <span className="text-xs text-slate-400">{skills[key].length} skills</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skills[key].map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-800 border border-slate-200 shadow-2xs"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(key, item)}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSkillInputs[key]}
                      onChange={(e) =>
                        setNewSkillInputs((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSkill(key);
                        }
                      }}
                      placeholder={`Add ${label.toLowerCase()}...`}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-brand-500"
                    />
                    <Button size="sm" variant="secondary" onClick={() => handleAddSkill(key)}>
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 8: Projects and Certifications */}
        {step === 8 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-navy-950">Projects & Certifications</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Highlight key capstone projects, coding repositories, and verified industry credentials.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                onClick={() =>
                  setProjects([
                    ...projects,
                    { name: "", description: "", technologies: [], url: "" },
                  ])
                }
              >
                Add Project
              </Button>
            </div>

            <div className="space-y-4">
              {projects.map((proj, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-4 bg-slate-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-700 uppercase">Project #{idx + 1}</span>
                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setProjects(projects.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Project Title *</label>
                      <input
                        type="text"
                        value={proj.name}
                        onChange={(e) => updateProject(idx, { name: e.target.value })}
                        placeholder="e.g. Distributed Task Queue"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">Project URL / GitHub</label>
                      <input
                        type="url"
                        value={proj.url}
                        onChange={(e) => updateProject(idx, { url: e.target.value })}
                        placeholder="https://github.com/user/project"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600">Description & Key Features</label>
                      <textarea
                        rows={2}
                        value={proj.description}
                        onChange={(e) => updateProject(idx, { description: e.target.value })}
                        placeholder="Developed a high-throughput job queue in Go and Redis with automatic retries and dead-letter queues."
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Certifications Subsection */}
            <div className="pt-6 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-navy-950">Certifications & Credentials</h3>
                  <p className="text-xs text-slate-500">Add AWS, Google Cloud, Meta, or other official credentials.</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  onClick={() =>
                    setCertifications([
                      ...certifications,
                      { name: "", issuer: "", date: "", url: "" },
                    ])
                  }
                >
                  Add Certification
                </Button>
              </div>

              <div className="space-y-4">
                {certifications.map((cert, cIdx) => (
                  <div key={cIdx} className="rounded-xl border border-slate-200 p-4 bg-slate-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-700 uppercase">Certification #{cIdx + 1}</span>
                      {certifications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setCertifications(certifications.filter((_, i) => i !== cIdx))}
                          className="text-xs text-rose-600 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Certification Name</label>
                        <input
                          type="text"
                          value={cert.name}
                          onChange={(e) => updateCertification(cIdx, { name: e.target.value })}
                          placeholder="e.g. AWS Certified Solutions Architect"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Issuing Organization</label>
                        <input
                          type="text"
                          value={cert.issuer}
                          onChange={(e) => updateCertification(cIdx, { issuer: e.target.value })}
                          placeholder="e.g. Amazon Web Services"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Issue Date (YYYY-MM)</label>
                        <input
                          type="text"
                          value={cert.date}
                          onChange={(e) => updateCertification(cIdx, { date: e.target.value })}
                          placeholder="2024-03"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Credential URL</label>
                        <input
                          type="url"
                          value={cert.url}
                          onChange={(e) => updateCertification(cIdx, { url: e.target.value })}
                          placeholder="https://credly.com/badges/..."
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 9: AI Professional Summary */}
        {step === 9 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-navy-950">AI Professional Summary</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Generate or refine your executive summary using different writing styles.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={summaryTone}
                  onChange={(e) => setSummaryTone(e.target.value as any)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800"
                >
                  <option value="professional">Professional Tone</option>
                  <option value="warm">Warm & Engaging</option>
                  <option value="concise">Concise & Direct</option>
                </select>
                <Button
                  size="sm"
                  icon="sparkles"
                  loading={isGeneratingSummary}
                  onClick={handleGenerateSummary}
                >
                  AI Generate Summary
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <textarea
                rows={6}
                value={personal.summary}
                onChange={(e) => setPersonal({ ...personal, summary: e.target.value })}
                placeholder="Click 'AI Generate Summary' above or write your own compelling summary highlighting your strengths, target role, and career objectives..."
                className="w-full rounded-xl border border-slate-200 p-4 text-sm leading-relaxed text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <p className="text-xs text-slate-400 text-right">
                {personal.summary.length} characters (Recommended: 200 - 450 characters)
              </p>
            </div>
          </div>
        )}

        {/* Stepper Navigation Buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          <Button
            variant="secondary"
            onClick={handleBack}
            disabled={step === 1 || isCreating}
            icon="arrowLeft"
          >
            Back
          </Button>

          <div className="flex items-center gap-3">
            {step < 9 ? (
              <Button onClick={handleNext} disabled={isCreating}>
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                icon="check"
                loading={isCreating}
                onClick={handleFinalSubmit}
              >
                Create & Open Resume Editor
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
