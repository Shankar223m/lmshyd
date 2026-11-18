import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { store } from "@/app/store";
import { env } from "@/core/config/env";
import { EmployerOrgPicker } from "../../../components/EmployerOrgPicker";
import { JobThumbnail } from "../../../components/JobThumbnail";
import { useJobsAccess } from "@/modules/jobs/hooks/useJobsAccess";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { apiFetch, authApi, filesApi, type ApiResponse } from "../../../services/api";

type EligibilityForm = {
  programs: string;
  graduation_year_min: number;
  graduation_year_max: number;
  min_cgpa: number;
  required_skills: string;
  max_backlogs: string;
};

type EmployerOrg = { id: string; name: string };

const defaultEligibility: EligibilityForm = {
  programs: "B.Tech CSE, B.Tech ECE",
  graduation_year_min: new Date().getFullYear(),
  graduation_year_max: new Date().getFullYear() + 1,
  min_cgpa: 6.0,
  required_skills: "React, TypeScript, Node.js",
  max_backlogs: "",
};

const WIZARD_STEPS = [
  { id: 1, title: "Employer", subtitle: "Who is hiring" },
  { id: 2, title: "Role and pay", subtitle: "Details and salary" },
  { id: 3, title: "Eligibility", subtitle: "Who can apply" },
] as const;

export function CreateJobPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isModerator } = useJobsAccess();
  const orgName = user?.institution?.name;
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const formTopRef = useRef<HTMLDivElement>(null);
  const isPlatformAdmin = isModerator;
  const listPath = isPlatformAdmin ? "/jobs/admin/review" : "/jobs/employer/jobs";
  const cancelPath = isPlatformAdmin ? "/jobs/admin/dashboard" : "/jobs/employer/jobs";

  const [wizardStep, setWizardStep] = useState(1);
  const [title, setTitle] = useState("");
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [workMode, setWorkMode] = useState("HYBRID");
  const [openings, setOpenings] = useState(5);
  const [closesOn, setClosesOn] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Bengaluru, Karnataka, India");
  const [salaryMin, setSalaryMin] = useState(600000);
  const [salaryMax, setSalaryMax] = useState(1200000);
  const [eligibility, setEligibility] = useState<EligibilityForm>(defaultEligibility);
  const [stages, setStages] = useState<string[]>(["Screening", "Shortlisted", "Assessment", "Interview", "Selected"]);
  const [newStage, setNewStage] = useState("");
  const [questions, setQuestions] = useState<Array<{ text: string; required: boolean }>>([]);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [selectedRecruiterIds, setSelectedRecruiterIds] = useState<string[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [thumbnailFileId, setThumbnailFileId] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [allowBacklogs, setAllowBacklogs] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: recruitersData } = useQuery({
    queryKey: ["my-recruiters"],
    queryFn: () => authApi.listRecruiters(),
    enabled: !isPlatformAdmin,
  });
  const recruiters = recruitersData?.data || [];

  const { data: orgsData } = useQuery({
    queryKey: ["admin-employer-orgs"],
    enabled: isPlatformAdmin,
    queryFn: () =>
      apiFetch<ApiResponse<EmployerOrg[]>>("/admin/organizations?org_type=EMPLOYER&status=VERIFIED"),
  });
  const employerOrgs = orgsData?.data || [];

  const { data: editJob } = useQuery({
    queryKey: ["job-edit", editId],
    enabled: !!editId,
    queryFn: () => apiFetch<ApiResponse<Record<string, unknown>>>(`/jobs/${editId}`),
  });

  useEffect(() => {
    const j = editJob?.data;
    if (!j) return;
    setTitle(String(j.title || ""));
    setDescription(String(j.description || ""));
    setLocation(String(j.location || ""));
    setEmploymentType(String(j.employment_type || "FULL_TIME"));
    setWorkMode(String(j.work_mode || "HYBRID"));
    setOpenings(Number(j.openings || 1));
    setClosesOn(j.closes_on ? String(j.closes_on) : "");
    setSalaryMin(Number(j.salary_min || 0));
    setSalaryMax(Number(j.salary_max || 0));
    setOrganizationId(j.organization_id ? String(j.organization_id) : "");
    const thumbId = j.thumbnail_file_id ? String(j.thumbnail_file_id) : null;
    setThumbnailFileId(thumbId);
    setThumbnailPreview(null);
    if (thumbId) {
      void (async () => {
        try {
          const token = store.getState().auth.accessToken;
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          const res = await fetch(`${env.apiBaseUrl}/jcms/files/${thumbId}/download`, { headers });
          if (!res.ok) return;
          setThumbnailPreview(URL.createObjectURL(await res.blob()));
        } catch {
          /* ignore */
        }
      })();
    }
    const sk = Array.isArray(j.skills) ? (j.skills as string[]).join(", ") : "";
    if (Array.isArray(j.hiring_stages)) setStages(j.hiring_stages as string[]);
    if (Array.isArray(j.questions)) setQuestions(j.questions as Array<{ text: string; required: boolean }>);
    if (Array.isArray(j.recruiter_ids)) setSelectedRecruiterIds(j.recruiter_ids as string[]);
    const el = (j.eligibility || {}) as Record<string, unknown>;
    setEligibility({
      programs: Array.isArray(el.programs) ? (el.programs as string[]).join(", ") : "",
      graduation_year_min: Number(el.graduation_year_min ?? 2025),
      graduation_year_max: Number(el.graduation_year_max ?? 2027),
      min_cgpa: Number(el.min_cgpa ?? 7),
      required_skills: Array.isArray(el.required_skills) ? (el.required_skills as string[]).join(", ") : sk,
      max_backlogs: el.max_backlogs == null ? "" : String(el.max_backlogs),
    });
    setAllowBacklogs(el.max_backlogs != null && Number(el.max_backlogs) > 0);
    if ((j.questions as unknown[])?.length || (j.hiring_stages as unknown[])?.length) setShowAdvanced(true);
  }, [editJob?.data]);

  const buildEligibilityPayload = () => {
    const programs = eligibility.programs.split(",").map((s) => s.trim()).filter(Boolean);
    const required_skills = eligibility.required_skills.split(",").map((s) => s.trim()).filter(Boolean);
    return {
      programs,
      graduation_year_min: Number(eligibility.graduation_year_min),
      graduation_year_max: Number(eligibility.graduation_year_max),
      min_cgpa: Number(eligibility.min_cgpa),
      required_skills,
      max_backlogs: allowBacklogs
        ? eligibility.max_backlogs === ""
          ? 1
          : Number(eligibility.max_backlogs)
        : null,
    };
  };

  const validateStep = (step: number): boolean => {
    const errs: Record<string, string> = {};
    if (step === 1 && isPlatformAdmin && !organizationId) {
      errs.organization = "Please select an employer";
    }
    if (step === 2) {
      if (!title.trim()) errs.title = "Job title is required";
      if (!description.trim() || description.trim().length < 20) {
        errs.description = "Description must be at least 20 characters";
      }
      if (Number(salaryMin) > 0 && Number(salaryMax) > 0 && Number(salaryMin) > Number(salaryMax)) {
        errs.salaryMax = "Maximum salary must be greater than or equal to minimum salary";
      }
      if (!closesOn) errs.closesOn = "Application deadline is required";
    }
    if (step === 3) {
      const el = buildEligibilityPayload();
      if (!el.programs.length) errs.programs = "At least one programme required";
      if (el.graduation_year_min > el.graduation_year_max) errs.gradYears = "Invalid graduation year range";
      if (el.min_cgpa < 0 || el.min_cgpa > 10) errs.minCgpa = "CGPA must be between 0 and 10";
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setError("Please review the highlighted errors.");
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return false;
    }
    setError("");
    return true;
  };

  const validate = (): boolean => {
    for (const step of [1, 2, 3]) {
      if (!validateStep(step)) {
        setWizardStep(step);
        return false;
      }
    }
    return true;
  };

  const jobBody = () => {
    const el = buildEligibilityPayload();
    return {
      title: title.trim(),
      description,
      location,
      employment_type: employmentType,
      work_mode: workMode,
      salary_min: Number(salaryMin),
      salary_max: Number(salaryMax),
      salary_currency: "INR",
      openings: Number(openings),
      closes_on: closesOn || undefined,
      skills: el.required_skills,
      hiring_stages: stages,
      questions,
      recruiter_ids: selectedRecruiterIds,
      requires_moderation: !isPlatformAdmin,
      eligibility: el,
      thumbnail_file_id: thumbnailFileId || undefined,
      ...(isPlatformAdmin ? { organization_id: organizationId } : {}),
    };
  };

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Logo must be under 5MB.");
      return;
    }
    setUploadingLogo(true);
    setError("");
    try {
      const res = await filesApi.upload(file, "company_logo");
      const id = res.data?.id;
      if (!id) throw new Error("Upload failed");
      setThumbnailFileId(id);
      setThumbnailPreview(URL.createObjectURL(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (mode: "draft" | "submit") => {
      if (mode === "submit") {
        if (!validate()) throw new Error("Validation failed");
      } else if (isPlatformAdmin && !organizationId) {
        setFieldErrors({ organization: "Please select an employer" });
        setError("Select an employer before saving a draft.");
        setWizardStep(1);
        throw new Error("Validation failed");
      }
      const draftTitle = title.trim() || "Untitled draft";
      if (!title.trim()) setTitle(draftTitle);
      const body = { ...jobBody(), title: draftTitle, description: description.trim() || "Draft job description pending completion." };
      if (editId) {
        const res = await apiFetch<ApiResponse<{ id: string }>>(`/jobs/${editId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        if (mode === "submit") await apiFetch(`/jobs/${editId}/submit`, { method: "POST" });
        return res;
      }
      const res = await apiFetch<ApiResponse<{ id: string }>>("/jobs", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (mode === "submit" && res.data?.id) {
        await apiFetch(`/jobs/${res.data.id}/submit`, { method: "POST" });
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employer-jobs"] });
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      nav(listPath);
    },
    onError: (err: Error) => setError(err.message || "Save failed"),
  });

  const selectedOrgName = employerOrgs.find((o) => o.id === organizationId)?.name;
  const inputBaseClass =
    "w-full h-10 px-3 bg-slate-50 rounded-xl font-medium text-sm text-slate-900 border border-slate-200 focus:outline-none focus:bg-white focus:border-[#635BFF] transition-all";

  const completeness = useMemo(() => {
    let score = 0;
    if (isPlatformAdmin ? organizationId : true) score += 25;
    if (title.trim() && description.trim().length >= 20 && closesOn) score += 50;
    if (eligibility.programs.trim() && eligibility.required_skills.trim()) score += 25;
    return score;
  }, [isPlatformAdmin, organizationId, title, description, closesOn, eligibility.programs, eligibility.required_skills]);

  const goNext = () => {
    if (!validateStep(wizardStep)) return;
    setWizardStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => setWizardStep((s) => Math.max(1, s - 1));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (wizardStep < 3) {
      goNext();
      return;
    }
    saveMutation.mutate("submit");
  };

  const previewSkills = eligibility.required_skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="flex flex-col w-full space-y-5" ref={formTopRef}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-tight text-slate-900">
            {editId ? "Edit job" : "Create job"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Publish a campus recruitment role.{" "}
            {isPlatformAdmin ? "Students see it after you publish." : "Students see it after moderation."}
          </p>
        </div>
        <span className="text-xs font-medium text-emerald-700">All changes saved</span>
      </div>

      {/* Step indicator */}
      <ol className="grid gap-2 sm:grid-cols-3">
        {WIZARD_STEPS.map((s) => {
          const active = wizardStep === s.id;
          const done = wizardStep > s.id;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
                active
                  ? "border-[#635BFF] bg-[#635BFF]/5"
                  : done
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-slate-200 bg-white"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  active
                    ? "bg-[#635BFF] text-white"
                    : done
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : s.id}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {s.id} {s.title}
                </p>
                <p className="truncate text-xs text-slate-500">{s.subtitle}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form noValidate className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12" onSubmit={onSubmit}>
        <div className="flex flex-col gap-5 lg:col-span-8">
          {wizardStep === 1 && (
            <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div>
                <h2 className="text-base font-bold text-slate-900">Who is hiring?</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Pick a verified organisation. Its details fill the listing.
                </p>
              </div>

              {isPlatformAdmin ? (
                <div>
                  <EmployerOrgPicker
                    options={employerOrgs}
                    value={organizationId}
                    onChange={setOrganizationId}
                    invalid={Boolean(fieldErrors.organization)}
                  />
                  {fieldErrors.organization && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.organization}</p>
                  )}
                </div>
              ) : (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Posting as <strong>{orgName || "your organisation"}</strong>
                </p>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Company logo
                </label>
                <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {thumbnailPreview ? (
                      <img src={thumbnailPreview} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <JobThumbnail
                        fileId={thumbnailFileId}
                        fallbackLabel={selectedOrgName || "CO"}
                        className="flex h-full w-full items-center justify-center"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 text-center sm:text-left">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 self-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-100 sm:self-start">
                      <span>{uploadingLogo ? "Uploading…" : "Browse"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={uploadingLogo}
                        onChange={(e) => void handleLogoUpload(e.target.files?.[0])}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-slate-400">PNG, JPG or WEBP up to 5 MB. Initials are used if empty.</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {wizardStep === 2 && (
            <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div>
                <h2 className="text-base font-bold text-slate-900">Role and pay</h2>
                <p className="mt-0.5 text-sm text-slate-500">Details students see on the listing card.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Job title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Graduate Software Development Engineer"
                    className={inputBaseClass}
                  />
                  <p className="mt-1 text-xs text-slate-400">This is the headline students see.</p>
                  {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Engagement type
                  </label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className={inputBaseClass}
                  >
                    <option value="FULL_TIME">Full time</option>
                    <option value="INTERNSHIP">Internship</option>
                    <option value="PART_TIME">Part time</option>
                    <option value="CONTRACT">Contract</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Work mode
                  </label>
                  <select value={workMode} onChange={(e) => setWorkMode(e.target.value)} className={inputBaseClass}>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ONSITE">On-site</option>
                    <option value="REMOTE">Remote</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Openings <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={openings}
                    onChange={(e) => setOpenings(Number(e.target.value))}
                    className={inputBaseClass}
                  />
                  <p className="mt-1 text-xs text-slate-400">Total positions.</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Application deadline <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={closesOn}
                    onChange={(e) => setClosesOn(e.target.value)}
                    className={inputBaseClass}
                  />
                  {fieldErrors.closesOn && <p className="mt-1 text-xs text-red-600">{fieldErrors.closesOn}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Primary location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Bengaluru, India"
                    className={inputBaseClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Minimum (₹ annual CTC)
                  </label>
                  <input
                    type="number"
                    step={50000}
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(Number(e.target.value))}
                    className={inputBaseClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Maximum (₹ annual CTC)
                  </label>
                  <input
                    type="number"
                    step={50000}
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(Number(e.target.value))}
                    className={inputBaseClass}
                  />
                  {fieldErrors.salaryMax && <p className="mt-1 text-xs text-red-600">{fieldErrors.salaryMax}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Description and responsibilities <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe key responsibilities, role expectations, and technical stack…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:border-[#635BFF] focus:bg-white focus:outline-none"
                  />
                  {fieldErrors.description && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {wizardStep === 3 && (
            <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div>
                <h2 className="text-base font-bold text-slate-900">Who can apply?</h2>
                <p className="mt-0.5 text-sm text-slate-500">Only matching students see this job.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-3">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Target programmes <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={eligibility.programs}
                    onChange={(e) => setEligibility({ ...eligibility, programs: e.target.value })}
                    placeholder="B.Tech CSE, B.Tech ECE, M.Tech CSE"
                    className={inputBaseClass}
                  />
                  {fieldErrors.programs && <p className="mt-1 text-xs text-red-600">{fieldErrors.programs}</p>}
                </div>

                <div className="md:col-span-3">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Required skills
                  </label>
                  <input
                    type="text"
                    value={eligibility.required_skills}
                    onChange={(e) => setEligibility({ ...eligibility, required_skills: e.target.value })}
                    placeholder="React, TypeScript, Node.js"
                    className={inputBaseClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Minimum CGPA
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={10}
                    value={eligibility.min_cgpa}
                    onChange={(e) => setEligibility({ ...eligibility, min_cgpa: Number(e.target.value) })}
                    className={inputBaseClass}
                  />
                  <p className="mt-1 text-xs text-slate-400">Out of 10.</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Graduation year min
                  </label>
                  <input
                    type="number"
                    value={eligibility.graduation_year_min}
                    onChange={(e) =>
                      setEligibility({ ...eligibility, graduation_year_min: Number(e.target.value) })
                    }
                    className={inputBaseClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Graduation year max
                  </label>
                  <input
                    type="number"
                    value={eligibility.graduation_year_max}
                    onChange={(e) =>
                      setEligibility({ ...eligibility, graduation_year_max: Number(e.target.value) })
                    }
                    className={inputBaseClass}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Allow students with active backlogs</p>
                      <p className="text-xs text-slate-500">
                        {allowBacklogs
                          ? "Students with backlogs can apply."
                          : "Off: students with backlogs cannot apply."}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowBacklogs}
                      onChange={(e) => setAllowBacklogs(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#635BFF]"
                    />
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="self-start text-sm font-semibold text-[#635BFF] hover:underline"
              >
                {showAdvanced ? "Hide hiring pipeline" : "Advanced: hiring stages & screening questions"}
              </button>

              {showAdvanced && (
                <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Hiring stages</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {stages.map((st, idx) => (
                        <span
                          key={st}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800"
                        >
                          {idx + 1}. {st}
                          {stages.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setStages(stages.filter((_, i) => i !== idx))}
                              className="ml-1 text-slate-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={newStage}
                        onChange={(e) => setNewStage(e.target.value)}
                        placeholder="Add stage"
                        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newStage.trim() && !stages.includes(newStage.trim())) {
                            setStages([...stages, newStage.trim()]);
                            setNewStage("");
                          }
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Screening questions</h3>
                    <ul className="mt-2 space-y-2">
                      {questions.map((q, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800"
                        >
                          <span>{q.text}</span>
                          <button
                            type="button"
                            onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={newQuestionText}
                        onChange={(e) => setNewQuestionText(e.target.value)}
                        placeholder="Add a screening question"
                        className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newQuestionText.trim()) {
                            setQuestions([...questions, { text: newQuestionText.trim(), required: true }]);
                            setNewQuestionText("");
                          }
                        }}
                        className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {!isPlatformAdmin && recruiters.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Assigned recruiters</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {recruiters.map((r) => {
                          const selected = selectedRecruiterIds.includes(r.id);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() =>
                                setSelectedRecruiterIds((prev) =>
                                  prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                                )
                              }
                              className={`rounded-xl border px-3 py-1 text-xs font-semibold transition ${
                                selected
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700"
                              }`}
                            >
                              {r.full_name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
              ) : (
                <Link
                  to={cancelPath}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Link>
              )}
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate("draft")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Save draft
              </button>
            </div>

            {wizardStep < 3 ? (
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl bg-[#635BFF] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5046E5]"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="rounded-xl bg-[#635BFF] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5046E5] disabled:opacity-50"
              >
                {saveMutation.isPending
                  ? "Publishing…"
                  : isPlatformAdmin
                    ? "Publish role"
                    : "Submit for moderation"}
              </button>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-4">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Student card preview</span>
              <span className="text-[11px] font-medium text-slate-400">Live</span>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {thumbnailPreview ? (
                    <img src={thumbnailPreview} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <JobThumbnail
                      fileId={thumbnailFileId}
                      fallbackLabel={selectedOrgName || title || "CO"}
                      className="flex h-full w-full items-center justify-center"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-bold text-slate-900">
                    {title || "Graduate Software Engineer"}
                  </h4>
                  <p className="truncate text-xs text-slate-500">
                    {isPlatformAdmin
                      ? selectedOrgName || "Selected employer"
                      : orgName || "Your enterprise"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                <span>{location.split(",")[0] || "Bengaluru"}</span>
                <span>·</span>
                <span className="capitalize">{workMode.toLowerCase()}</span>
                <span>·</span>
                <span className="capitalize">{employmentType.replace(/_/g, " ").toLowerCase()}</span>
              </div>

              <p className="text-sm font-bold text-slate-900">
                {salaryMin
                  ? `₹${(salaryMin / 100000).toFixed(0)}–${(salaryMax / 100000).toFixed(0)} LPA`
                  : "Competitive"}
              </p>

              <div className="flex flex-wrap gap-1">
                {previewSkills.map((sk) => (
                  <span
                    key={sk}
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700"
                  >
                    {sk}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Listing completeness</span>
                <span className="font-bold text-slate-900">{completeness}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#635BFF] transition-all"
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
