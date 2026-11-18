import { useNavigate } from "react-router-dom";

import { useNotify } from "@/core/hooks/useNotify";
import { useDuplicateResumeMutation } from "@/modules/career/resumes/api/resumesApi";
import { ScoreRing } from "@/modules/career/resumes/components/common/ScoreRing";
import { SharePanel } from "@/modules/career/resumes/components/tools/SharePanel";
import { VersionsPanel } from "@/modules/career/resumes/components/tools/VersionsPanel";
import type { AtsResult, Resume, ResumeOptions, ResumeTemplate } from "@/modules/career/resumes/types";
import { Button } from "@/shared/ui";

/** The last stop: what you built, the downloads, the share link, saved versions, and the way back to your list. */
export function FinishPanel({ resume, options, ats, templates, status }: {
  resume: Resume;
  options: ResumeOptions;
  ats: AtsResult;
  templates: ResumeTemplate[];
  status: "saved" | "pending" | "saving" | "error";
}) {
  const navigate = useNavigate();
  const notify = useNotify();
  const [duplicate, { isLoading: duplicating }] = useDuplicateResumeMutation();
  const template = templates.find((t) => t.key === resume.template_key);

  const copy = async () => {
    try {
      const created = await duplicate(resume.resume_id).unwrap();
      notify.success("Copy created");
      navigate(`/career/resumes/${created.resume_id}`);
    } catch (error) {
      notify.apiError(error);
    }
  };

  return (
    <div className="space-y-4">
      <section className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/60">
        <ScoreRing score={ats.score} size={64} />
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-navy-950">{resume.title}</p>
          <p className="text-sm text-slate-500">
            {template?.name ?? "Template"} · {status === "saved" ? "All changes saved" : status === "error" ? "Not saved yet" : "Saving…"}
          </p>
        </div>
      </section>
      <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200/60">
        The score is an estimate from our own checks. It helps you spot gaps; it does not guarantee that any company's hiring software or recruiter will shortlist you.
      </p>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/60">
        <h3 className="text-sm font-bold text-navy-950">Download and share</h3>
        <SharePanel resume={resume} expiryDays={options.share_expiry_days} defaultDays={options.share_default_days} />
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/60">
        <h3 className="text-sm font-bold text-navy-950">Saved versions</h3>
        <VersionsPanel resumeId={resume.resume_id} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon="copy" loading={duplicating} onClick={() => void copy()}>Duplicate this resume</Button>
        <Button variant="secondary" onClick={() => navigate("/career/resumes")}>Back to my resumes</Button>
      </div>
    </div>
  );
}
