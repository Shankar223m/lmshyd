import { Link, useNavigate } from "react-router-dom";

import { formatRelative } from "@/core/lib/format";
import { useExportResumeMutation } from "@/modules/career/resumes/api/resumeToolsApi";
import type { Resume } from "@/modules/career/resumes/types";
import { Badge, Icon, Menu } from "@/shared/ui";
import { useNotify } from "@/core/hooks/useNotify";

/** One resume card: thumbnail preview with live ATS score, completion indicator, role, and actions matching UI Kit. */
export function ResumeCard({
  resume,
  templateName: _templateName,
  levelLabel: _levelLabel,
  onDuplicate,
  onDelete,
}: {
  resume: Resume;
  templateName?: string;
  levelLabel?: string;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const notify = useNotify();
  const [exportResume, { isLoading: isExporting }] = useExportResumeMutation();

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const url = await exportResume({ resumeId: resume.resume_id, format: "pdf" }).unwrap();
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resume.title || "resume"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      notify.success("PDF exported successfully!");
    } catch {
      window.open(`/career/resumes/${resume.resume_id}`, "_blank");
    }
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-xs border border-slate-200/80 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift">
      <Link
        to={`/career/resumes/${resume.resume_id}`}
        className="flex flex-1 flex-col focus-visible:outline-none"
        aria-label={`Open ${resume.title}`}
      >
        <div className="relative flex h-36 justify-center overflow-hidden bg-gradient-to-b from-[#F0EFFF] to-slate-50 pt-3">
          {/* Stylized Document Mockup */}
          <div
            aria-hidden="true"
            className="flex w-44 flex-col gap-1.5 rounded-t-lg bg-white p-3 shadow-md border border-slate-200/60"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
              <div className="h-6 w-6 rounded-full bg-[#635BFF]/15 flex items-center justify-center text-[10px] font-bold text-[#635BFF]">
                {resume.title.charAt(0)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="h-1.5 w-16 rounded-full bg-slate-800" />
                <div className="h-1 w-10 rounded-full bg-slate-300" />
              </div>
            </div>
            <div className="space-y-1 pt-1">
              <div className="h-1 w-full rounded-sm bg-slate-200" />
              <div className="h-1 w-4/5 rounded-sm bg-slate-200" />
              <div className="h-1 w-2/3 rounded-sm bg-[#635BFF]/40" />
            </div>
          </div>

          {/* ATS Pill */}
          {resume.ats_score != null && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 shadow-xs border border-slate-200/60 backdrop-blur-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-slate-700">ATS {resume.ats_score}%</span>
            </div>
          )}

          {resume.shared && (
            <Badge tone="green" className="absolute left-2.5 top-2.5 shadow-2xs text-[10px]">
              Live
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
          <div>
            <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-[#635BFF] transition-colors">
              {resume.title}
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              Last edited: {formatRelative(resume.updated_at)}
            </p>
          </div>

          {/* Bottom Action Row Matching Reference Screen */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                navigate(`/career/resumes/${resume.resume_id}`);
              }}
              className="flex-1 rounded-xl border border-slate-200/90 bg-white py-2 text-center text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadPdf}
              className="flex-1 rounded-xl bg-[#635BFF] py-2 text-center text-xs font-semibold text-white shadow-2xs hover:bg-[#5046E5] transition-colors disabled:opacity-50"
            >
              Download
            </button>
            <div className="relative">
              <Menu
                trigger={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    aria-label={`Options for ${resume.title}`}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-2xs hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    <Icon name="more" size={16} />
                  </button>
                }
                items={[
                  {
                    label: "Edit Resume",
                    icon: "edit",
                    onSelect: () => navigate(`/career/resumes/${resume.resume_id}`),
                  },
                  {
                    label: "Duplicate",
                    icon: "layers",
                    onSelect: onDuplicate,
                  },
                  {
                    label: "Delete",
                    icon: "trash",
                    tone: "danger",
                    onSelect: onDelete,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
