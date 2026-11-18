import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ResumeDocumentView } from "@/modules/career/common/components/ResumeDocumentView";
import { useGetMyCareerProfileQuery } from "@/modules/career/profile/api/profileApi";
import {
  useGetResumeOptionsQuery,
  useGetResumeQuery,
  useListResumeTemplatesQuery,
} from "@/modules/career/resumes/api/resumesApi";
import { useExportResumeMutation } from "@/modules/career/resumes/api/resumeToolsApi";
import { EditorHeader } from "@/modules/career/resumes/components/editor/EditorHeader";
import { SectionsCard } from "@/modules/career/resumes/components/editor/SectionsCard";
import type { FixTarget } from "@/modules/career/resumes/components/tools/ScoreTab";
import { ShareDialog } from "@/modules/career/resumes/components/tools/ShareDialog";
import { ToolsPanel, type ToolTab } from "@/modules/career/resumes/components/tools/ToolsPanel";
import { useResumeDraft } from "@/modules/career/resumes/hooks/useResumeDraft";
import { Button, EmptyState, PageLoader } from "@/shared/ui";
import { useNotify } from "@/core/hooks/useNotify";

/** One workspace: sections on the left, live page with formatting controls in the middle, AI/ATS tools on the right. */
export function ResumeEditorPage() {
  const { resumeId = "" } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();

  const { data: detail, isLoading, isError, refetch } = useGetResumeQuery(resumeId, { skip: !resumeId });
  const { data: profile } = useGetMyCareerProfileQuery();
  const { data: options } = useGetResumeOptionsQuery();
  const { data: templates = [] } = useListResumeTemplatesQuery();
  const [exportResume, { isLoading: isExporting }] = useExportResumeMutation();

  const editor = useResumeDraft(detail, refetch);
  const [open, setOpen] = useState<string | null>(null);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [tab, setTab] = useState<ToolTab>("score");
  const [sharing, setSharing] = useState(false);

  // Formatting customization
  const [fontFamily, setFontFamily] = useState<"sans" | "serif" | "mono">("sans");
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("sm");
  const [accentColor, setAccentColor] = useState<"indigo" | "navy" | "emerald" | "slate" | "black">("indigo");
  const [spacing, setSpacing] = useState<"compact" | "normal" | "spacious">("normal");

  if (isLoading || !options) return <PageLoader />;
  if (isError || !detail) return <EmptyState icon="alert" title="Resume not found" description="It may have been deleted." />;

  const { draft } = editor;

  const applySummary = (text: string) => draft && editor.change({ ...draft, summary: { text, visible: true } });
  const fix = (target: FixTarget) => {
    if ("tab" in target) setTab(target.tab);
    else if ("section" in target) {
      setOpen(target.section);
      setFocusItem(target.itemId);
    } else navigate("/career/profile");
  };

  const handleDownloadPdf = async () => {
    try {
      const url = await exportResume({ resumeId, format: "pdf" }).unwrap();
      const a = document.createElement("a");
      a.href = url;
      a.download = `${detail.resume.title || "resume"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      notify.success("PDF exported successfully!");
    } catch {
      // Fallback to browser print dialog for client-side formatted PDF
      window.print();
    }
  };

  return (
    <>
      <EditorHeader
        meta={editor.meta}
        status={editor.status}
        level={detail.resume.experience_level}
        levels={options.experience_levels}
        templates={templates}
        onMeta={editor.changeMeta}
        onLevel={(level) => void editor.changeLevel(level)}
        onRetry={editor.retry}
        onShare={() => setSharing(true)}
      />

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        {/* Left Column: Sections & Items Manager */}
        <div className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          {draft && (
            <SectionsCard
              resumeId={resumeId}
              draft={draft}
              profileItems={profile?.items ?? []}
              open={open}
              focusItemId={focusItem}
              onOpen={(key) => {
                setOpen(key);
                setFocusItem(null);
              }}
              onChange={editor.change}
            />
          )}
        </div>

        {/* Center Column: Live Document Preview with Formatting Customization Toolbar */}
        <section aria-label="Preview" className="min-w-0 space-y-3">
          {/* Formatting Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-2xs text-xs">
            <div className="flex items-center gap-3">
              {/* Font Picker */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Font:</span>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as any)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="sans">Modern Sans</option>
                  <option value="serif">Classic Serif</option>
                  <option value="mono">Tech Mono</option>
                </select>
              </div>

              {/* Size Picker */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Size:</span>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value as any)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="sm">Small (Compact)</option>
                  <option value="base">Regular</option>
                  <option value="lg">Large</option>
                </select>
              </div>

              {/* Spacing */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Spacing:</span>
                <select
                  value={spacing}
                  onChange={(e) => setSpacing(e.target.value as any)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="compact">Tight</option>
                  <option value="normal">Standard</option>
                  <option value="spacious">Spacious</option>
                </select>
              </div>

              {/* Accent Color */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Color:</span>
                <select
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value as any)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="indigo">Indigo</option>
                  <option value="navy">Navy</option>
                  <option value="emerald">Emerald</option>
                  <option value="slate">Slate</option>
                  <option value="black">Classic Black</option>
                </select>
              </div>
            </div>

            {/* Quick Action: PDF Export */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon="download"
                loading={isExporting}
                onClick={handleDownloadPdf}
              >
                Download PDF
              </Button>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-100 p-3 sm:p-6">
            <div className="mx-auto max-w-[680px] shadow-lift">
              <ResumeDocumentView
                document={detail.document}
                templateKey={editor.meta.template_key || "modern"}
                fontFamily={fontFamily}
                fontSize={fontSize}
                accentColor={accentColor}
                spacing={spacing}
              />
            </div>
          </div>
        </section>

        {/* Right Column: AI Resume Intelligence Tabs */}
        <div className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <ToolsPanel
            tab={tab}
            onTab={setTab}
            resumeId={resumeId}
            ats={detail.ats}
            jobDescription={editor.meta.job_description ?? ""}
            summaryText={draft?.summary.text ?? ""}
            tones={options.ai_tones}
            onFix={fix}
            onJobDescription={(text) => editor.changeMeta({ job_description: text })}
            onUseSummary={applySummary}
          />
        </div>
      </div>

      {sharing && <ShareDialog resume={detail.resume} options={options} onClose={() => setSharing(false)} />}
    </>
  );
}
