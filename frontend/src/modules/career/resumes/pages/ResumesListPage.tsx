import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useConfirmAction } from "@/core/hooks/useConfirmAction";
import { useNotify } from "@/core/hooks/useNotify";
import {
  useDeleteResumeMutation,
  useDuplicateResumeMutation,
  useGetResumeOptionsQuery,
  useListResumesQuery,
  useListResumeTemplatesQuery,
} from "@/modules/career/resumes/api/resumesApi";
import { ResumeCard } from "@/modules/career/resumes/components/list/ResumeCard";
import { NewResumeDialog } from "@/modules/career/resumes/components/NewResumeDialog";
import { Button, ConfirmDialog, EmptyState, Icon, PageLoader } from "@/shared/ui";

export function ResumesListPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const confirm = useConfirmAction();

  const { data, isLoading } = useListResumesQuery({ per_page: 50 });
  const { data: options } = useGetResumeOptionsQuery();
  const { data: templates = [] } = useListResumeTemplatesQuery();

  const [duplicate] = useDuplicateResumeMutation();
  const [remove] = useDeleteResumeMutation();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  if (isLoading) return <PageLoader />;

  const resumes = data?.items ?? [];
  const max = options?.max_resumes ?? 10;
  const full = max > 0 && resumes.length >= max;

  const templateName = (key: string) => templates.find((t) => t.key === key)?.name ?? key;
  const levelLabel = (key: string) => options?.experience_levels.find((l) => l.key === key)?.label ?? "";

  const totalResumes = resumes.length;

  const filteredResumes = resumes.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.target_role && r.target_role.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-16">
      {/* Top Hero Banner matching Reference Screen */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#E8F6FE] via-[#E8F6FE] to-[#FAF8FF] border border-[#C5E8F5]/60 p-6 sm:p-8 shadow-xs">
        {/* Soft background glow circles */}
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-[#7DC8F7]/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 -mb-8 h-40 w-40 rounded-full bg-indigo-200/20 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F6FE] px-3 py-1 text-xs font-semibold text-[#7DC8F7] ring-1 ring-[#C5E8F5]/80">
              <Icon name="sparkles" size={14} className="text-[#7DC8F7]" />
              AI Powered
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Build Your <span className="text-[#7DC8F7]">Professional Resume</span>
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Create a stunning resume in minutes with AI. Stand out and get your dream job!
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate("/career/resumes/create")}
                disabled={full}
                className="inline-flex items-center gap-2 rounded-xl bg-[#7DC8F7] px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#5CB8EC] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                Create New Resume
                <Icon name="chevronRight" size={16} />
              </button>
              <button
                type="button"
                onClick={() => navigate("/career/resumes/templates")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300/80 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white hover:border-slate-400 active:scale-[0.98] transition-all cursor-pointer"
              >
                View Templates
                <Icon name="chevronRight" size={14} className="text-slate-400" />
              </button>
            </div>
          </div>

          {/* Right 3D Document Illustration Card */}
          <div className="hidden lg:flex shrink-0 relative items-center justify-center">
            <div className="relative w-64 rounded-2xl bg-white p-4 shadow-lift border border-slate-200/80 transform rotate-2 hover:rotate-0 transition-transform duration-300">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#7DC8F7] to-indigo-400 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  JD
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">RESUME</h4>
                  <div className="h-1.5 w-16 rounded-full bg-[#7DC8F7]/30 mt-1" />
                </div>
                <div className="ml-auto flex gap-1">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E8F6FE] text-[#7DC8F7]">
                    <Icon name="download" size={12} />
                  </span>
                </div>
              </div>
              <div className="space-y-2 pt-3">
                <div className="h-2 w-3/4 rounded-full bg-slate-200" />
                <div className="h-1.5 w-full rounded-full bg-slate-100" />
                <div className="h-1.5 w-5/6 rounded-full bg-slate-100" />
                <div className="flex gap-1.5 pt-1">
                  <span className="h-4 w-12 rounded-full bg-[#E8F6FE] text-[#7DC8F7] text-[9px] font-semibold flex items-center justify-center">React</span>
                  <span className="h-4 w-12 rounded-full bg-slate-100 text-slate-600 text-[9px] font-semibold flex items-center justify-center">Node</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* "Your Resumes" Section Header matching Reference Screen */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Your Resumes</h2>
          <p className="text-xs text-slate-500">Manage and customize your targeted resumes</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/career/resumes/templates")}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#7DC8F7] hover:underline"
        >
          View All Templates
          <Icon name="chevronRight" size={14} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Icon name="search" size={15} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resumes by title or target role..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon="upload"
            onClick={() => navigate("/career/resumes/upload")}
          >
            Upload Resume
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon="plus"
            disabled={full}
            onClick={() => navigate("/career/resumes/create")}
          >
            New Resume
          </Button>
        </div>
      </div>

      {/* Resumes Grid */}
      {filteredResumes.length === 0 ? (
        <EmptyState
          icon="fileText"
          title={search ? "No matching resumes found" : "No resumes created yet"}
          description={
            search
              ? "Try adjusting your search query."
              : "Create your first ATS-optimized resume from scratch, or upload your existing document to extract details automatically."
          }
          action={
            <div className="flex gap-2">
              <Button icon="plus" onClick={() => navigate("/career/resumes/create")}>
                Create from Scratch
              </Button>
              <Button variant="secondary" icon="upload" onClick={() => navigate("/career/resumes/upload")}>
                Upload Resume
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredResumes.map((resume) => (
            <ResumeCard
              key={resume.resume_id}
              resume={resume}
              templateName={templateName(resume.template_key)}
              levelLabel={levelLabel(resume.experience_level)}
              onDuplicate={() =>
                void duplicate(resume.resume_id)
                  .unwrap()
                  .then(() => notify.success("Resume duplicated successfully!"), notify.apiError)
              }
              onDelete={() =>
                confirm.ask(
                  {
                    title: `Delete "${resume.title}"?`,
                    description: "All saved versions and public share links associated with this resume will be permanently removed.",
                    confirmLabel: "Delete Resume",
                  },
                  async () => {
                    await remove(resume.resume_id).unwrap().catch(notify.apiError);
                  }
                )
              }
            />
          ))}

          {!full && (
            <div
              onClick={() => navigate("/career/resumes/create")}
              className="group flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center transition-all hover:border-brand-500 hover:bg-brand-50/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 text-brand-700 group-hover:scale-105 transition-transform">
                <Icon name="plus" size={22} />
              </span>
              <div>
                <span className="text-sm font-bold text-navy-950 group-hover:text-brand-700 transition-colors">
                  Create Another Target Resume
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  Tailor a customized resume for a specific job title or company
                </p>
              </div>
              <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
                {totalResumes} of {max} used
              </span>
            </div>
          )}
        </div>
      )}

      {creating && options && (
        <NewResumeDialog
          options={options}
          onClose={() => setCreating(false)}
          onCreated={(resume) => navigate(`/career/resumes/${resume.resume_id}`)}
        />
      )}
      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
}
