import { useRef, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { validateUrl } from "@/modules/user-management/institutions/form/validateUrl";
import { FormGrid } from "@/modules/user-management/manage/common/components/FormGrid";
import { useUploadCertificateMutation } from "@/modules/user-management/users/api/usersApi";
import { emptyCertification } from "@/modules/user-management/users/form/userFormDefaults";
import type { UserFormValues } from "@/modules/user-management/users/form/userFormValues";
import { TextField } from "@/shared/form";
import { Button, Icon, Spinner } from "@/shared/ui";

export function ProfessionalProfilesAndCertifications() {
  const { control, getValues, setValue } = useFormContext<UserFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "student.certifications" });
  const [uploadCertificate, { isLoading: isUploading }] = useUploadCertificateMutation();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<{ index: number; error: string } | null>(null);

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate size (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError({ index, error: "File size must be 5 MB or less." });
      e.target.value = "";
      return;
    }

    // Validate extension
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const validExts = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
    if (!validExts.includes(ext)) {
      setUploadError({ index, error: "Only PDF, JPG, PNG, and WebP files are allowed." });
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingIndex(index);
      const res = await uploadCertificate(formData).unwrap();
      setValue(`student.certifications.${index}.document_url`, res.document_url, { shouldDirty: true });
      setValue(`student.certifications.${index}.document_name`, file.name, { shouldDirty: true });
    } catch {
      setUploadError({ index, error: "Upload failed. Please try again." });
    } finally {
      setUploadingIndex(null);
      e.target.value = "";
    }
  };

  const handleRemoveDocument = (index: number) => {
    setValue(`student.certifications.${index}.document_url`, "", { shouldDirty: true });
    setValue(`student.certifications.${index}.document_name`, "", { shouldDirty: true });
    setUploadError(null);
  };

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="border-t border-slate-200/80 pt-5">
        <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
          Professional Profiles &amp; Certifications
        </h3>
      </div>

      {/* A. Professional Profile Links */}
      <FormGrid title="Professional Profile Links">
        <TextField<UserFormValues>
          name="student.linkedin_url"
          label="LinkedIn Profile URL"
          placeholder="https://www.linkedin.com/in/your-profile"
          icon="linkedin"
          type="url"
          rules={{ validate: validateUrl }}
        />
        <TextField<UserFormValues>
          name="student.github_url"
          label="GitHub Profile URL"
          placeholder="https://github.com/your-username"
          icon="github"
          type="url"
          rules={{ validate: validateUrl }}
        />
        <TextField<UserFormValues>
          name="student.hackerrank_url"
          label="HackerRank Profile URL"
          placeholder="https://hackerrank.com/your-username"
          icon="hackerrank"
          type="url"
          rules={{ validate: validateUrl }}
        />
        <TextField<UserFormValues>
          name="student.leetcode_url"
          label="LeetCode Profile URL"
          placeholder="https://leetcode.com/u/your-username/"
          icon="leetcode"
          type="url"
          rules={{ validate: validateUrl }}
        />
      </FormGrid>

      {/* B. Certifications Subsection */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Certifications</h4>
            <p className="mt-0.5 text-[13px] text-slate-500">Add any licenses, courses, or certifications.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={() => append(emptyCertification())}
          >
            Add Certification
          </Button>
        </div>

        {fields.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
            No certifications added yet. Click &ldquo;Add Certification&rdquo; to add one.
          </div>
        )}

        {fields.map((field, index) => {
          const documentUrl = getValues(`student.certifications.${index}.document_url`);
          const documentName = getValues(`student.certifications.${index}.document_name`);
          const hasDocument = Boolean(documentUrl);
          const isThisUploading = isUploading && uploadingIndex === index;
          const currentError = uploadError?.index === index ? uploadError.error : null;

          return (
            <div key={field.id} className="relative rounded-xl border border-slate-200 bg-slate-50/40 p-4 pr-12 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Certification #{index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 text-slate-400 hover:text-red-600"
                  onClick={() => remove(index)}
                  aria-label={`Remove certification ${index + 1}`}
                >
                  <Icon name="trash" size={16} />
                </Button>
              </div>

              <FormGrid>
                <TextField<UserFormValues>
                  name={`student.certifications.${index}.name`}
                  label="Certification Name"
                  placeholder="e.g. AWS Certified Developer"
                />
                <TextField<UserFormValues>
                  name={`student.certifications.${index}.issuing_organization`}
                  label="Issuing Organization"
                  placeholder="e.g. Amazon Web Services"
                />
                <TextField<UserFormValues>
                  name={`student.certifications.${index}.issue_date`}
                  label="Issue Date"
                  type="date"
                />
                <TextField<UserFormValues>
                  name={`student.certifications.${index}.expiration_date`}
                  label="Expiration Date"
                  type="date"
                  rules={{
                    validate: (val) => {
                      if (!val) return true;
                      const issue = getValues(`student.certifications.${index}.issue_date`);
                      if (issue && val < issue) {
                        return "Expiration date cannot be earlier than issue date";
                      }
                      return true;
                    },
                  }}
                />
                <TextField<UserFormValues>
                  name={`student.certifications.${index}.credential_id`}
                  label="Credential ID"
                  placeholder="e.g. ABC-123456"
                />
                <TextField<UserFormValues>
                  name={`student.certifications.${index}.credential_url`}
                  label="Credential URL"
                  type="url"
                  placeholder="https://example.com/verify/ABC-123456"
                  rules={{ validate: validateUrl }}
                />

                {/* Document Upload Field spanning 2 columns */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Certificate Document</label>
                  <input
                    type="file"
                    ref={(el) => {
                      fileInputRefs.current[index] = el;
                    }}
                    className="hidden"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={(e) => handleFileUpload(index, e)}
                  />

                  {hasDocument ? (
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Icon name="paperclip" size={16} className="text-brand-600 shrink-0" />
                        <span className="truncate font-medium">{documentName || "Certificate Document"}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveDocument(index)}
                          className="rounded p-1 text-slate-400 hover:text-red-600"
                          title="Remove document"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isThisUploading}
                        onClick={() => fileInputRefs.current[index]?.click()}
                      >
                        {isThisUploading ? (
                          <>
                            <Spinner size={14} className="mr-1.5" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Icon name="upload" size={14} className="mr-1.5 text-slate-500" />
                            <span>Upload Certificate (PDF, JPG, PNG)</span>
                          </>
                        )}
                      </Button>
                      <span className="text-xs text-slate-400">Max 5 MB</span>
                    </div>
                  )}

                  {currentError && <p className="text-xs font-medium text-red-600">{currentError}</p>}
                </div>
              </FormGrid>
            </div>
          );
        })}
      </div>
    </div>
  );
}
