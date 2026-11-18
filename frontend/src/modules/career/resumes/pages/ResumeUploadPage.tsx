import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useNotify } from "@/core/hooks/useNotify";
import {
  useAddProfileItemsMutation,
  useImportResumeFileMutation,
  useUpdateCareerProfileMutation,
} from "@/modules/career/profile/api/profileApi";
import type { ImportResult } from "@/modules/career/profile/types";
import { useCreateResumeMutation } from "@/modules/career/resumes/api/resumesApi";
import { Badge, Button, Icon, PageHeader } from "@/shared/ui";
import { cn } from "@/core/lib/cn";

export function ResumeUploadPage() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [importFile, { isLoading: isUploading }] = useImportResumeFileMutation();
  const [addItems, { isLoading: isSaving }] = useAddProfileItemsMutation();
  const [updateProfile] = useUpdateCareerProfileMutation();
  const [createResume, { isLoading: isCreating }] = useCreateResumeMutation();

  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [targetRole, setTargetRole] = useState("Software Engineer");

  const handleUpload = async (uploaded: File) => {
    if (!uploaded.name.match(/\.(pdf|docx|txt)$/i)) {
      notify.error("Please upload a PDF or DOCX file.");
      return;
    }
    if (uploaded.size > 10 * 1024 * 1024) {
      notify.error("File size exceeds 10 MB limit.");
      return;
    }

    setFile(uploaded);
    setUploadProgress(20);

    const interval = setInterval(() => {
      setUploadProgress((p) => (p < 85 ? p + 15 : p));
    }, 150);

    try {
      const result = await importFile(uploaded).unwrap();
      clearInterval(interval);
      setUploadProgress(100);
      setImportResult(result);
      setSelectedItems(new Set(result.items.map((_, i) => i)));
      notify.success(`Extracted ${result.items.length} items from your resume!`);
    } catch (err) {
      clearInterval(interval);
      setUploadProgress(0);
      notify.apiError(err, "Parsing error");
    }
  };

  const handleConfirmAndCreate = async () => {
    if (!importResult) return;
    try {
      // 1. Add selected items to profile
      const chosen = importResult.items
        .filter((_, idx) => selectedItems.has(idx))
        .map((it) => ({ kind: it.kind, data: it.data }));

      if (chosen.length > 0) {
        await addItems(chosen).unwrap().catch(() => undefined);
      }

      // 2. Update profile headline & contact
      if (importResult.profile) {
        const fields = Object.fromEntries(
          Object.entries(importResult.profile).filter(([, v]) => v)
        );
        if (Object.keys(fields).length > 0) {
          await updateProfile(fields).unwrap().catch(() => undefined);
        }
      }

      // 3. Create resume draft
      const newResume = await createResume({
        title: `${file?.name.replace(/\.[^/.]+$/, "") || "Imported"} Resume`,
        target_role: targetRole,
        experience_level: "mid",
        template_key: "modern",
        blank: false,
      }).unwrap();

      notify.success("Resume created from imported file! Opening editor...");
      navigate(`/career/resumes/${newResume.resume_id}`);
    } catch (err) {
      notify.apiError(err, "Failed to create resume");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <PageHeader
        title="Upload Existing Resume"
        description="Upload your PDF or DOCX resume to extract your work history, education, and skills with AI parsing."
        actions={
          <Button variant="secondary" onClick={() => navigate("/career/resumes")}>
            Back to Resumes
          </Button>
        }
      />

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card space-y-6">
        {!importResult ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
            }}
            className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/20"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 text-brand-600">
              <Icon name="upload" size={28} />
            </div>
            <h3 className="mt-4 text-base font-bold text-navy-950">
              Drag & Drop your resume here
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Supports PDF and DOCX documents (Maximum 10 MB)
            </p>

            <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors">
              <Icon name="upload" size={15} />
              <span>Browse File</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
            </label>

            {isUploading && (
              <div className="mt-6 w-full max-w-xs space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Extracting sections...</span>
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
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-navy-950">
                  Parsed Entries from {file?.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Review the extracted items. Uncheck any you do not want in your resume.
                </p>
              </div>
              <Badge tone="green">
                {selectedItems.size} of {importResult.items.length} Selected
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Target Role
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Frontend Engineer"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500"
                />
              </div>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {importResult.items.map((item, idx) => {
                const isSelected = selectedItems.has(idx);
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedItems((prev) => {
                        const next = new Set(prev);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        return next;
                      });
                    }}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                      isSelected
                        ? "border-brand-200 bg-brand-50/30"
                        : "border-slate-200 bg-white opacity-60"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-1 rounded border-slate-300 text-brand-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                          {item.kind}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-sm font-semibold text-navy-950">{item.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {JSON.stringify(item.data)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => {
                  setImportResult(null);
                  setFile(null);
                }}
              >
                Upload Different File
              </Button>
              <Button
                variant="primary"
                icon="check"
                loading={isSaving || isCreating}
                onClick={handleConfirmAndCreate}
              >
                Save & Open Resume Editor
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
