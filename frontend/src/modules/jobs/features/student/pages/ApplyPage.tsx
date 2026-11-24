import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FileUp, Upload, Sparkles, Check, Plus, ExternalLink, BarChart3, RefreshCw } from 'lucide-react';
import { apiFetch, authApi, filesApi, type ApiResponse } from '../../../services/api';
import { resumeApi } from '../resume-builder/services/resumeApi';
import { ResumeDocument } from '../resume-builder/types';
import { ResumeTemplateRenderer, TEMPLATES } from '../resume-builder/templates';
import { generateResumePdfBlob } from '../resume-builder/utils/pdfExport';

type JobDetail = {
  id: string;
  title: string;
  organization_name?: string;
  questions?: Array<{ text: string; required: boolean }>;
};

type ResumeSource = 'profile' | 'custom' | 'builder';

export function ApplyPage() {
  const { jobId } = useParams();
  const nav = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfRenderRef = useRef<HTMLDivElement>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumeSource, setResumeSource] = useState<ResumeSource>('profile');
  const [customResumeFileId, setCustomResumeFileId] = useState<string | null>(null);
  const [customResumeFileName, setCustomResumeFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  // Builder resumes state
  const [builderResumes, setBuilderResumes] = useState<ResumeDocument[]>([]);
  const [selectedBuilderResumeId, setSelectedBuilderResumeId] = useState<string | null>(null);
  const [loadingBuilderResumes, setLoadingBuilderResumes] = useState(false);
  const [builderUploadedFileId, setBuilderUploadedFileId] = useState<string | null>(null);

  const { data: jobData } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => apiFetch<ApiResponse<JobDetail>>(`/jobs/${jobId}`),
  });
  const job = jobData?.data;

  const { data: profileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => authApi.getProfile(),
  });
  const profile = profileData?.data?.student_profile;
  const profileResumeId = profile?.resume_file_id ?? null;
  const hasProfileResume = Boolean(profileResumeId);

  // Load builder resumes
  useEffect(() => {
    const fetchBuilderResumes = async () => {
      setLoadingBuilderResumes(true);
      try {
        const list = await resumeApi.getResumes();
        setBuilderResumes(list);
        if (list.length > 0 && list[0] && !selectedBuilderResumeId) {
          setSelectedBuilderResumeId(list[0]._id);
        }
      } catch (err) {
        console.warn('Failed to load student builder resumes:', err);
      } finally {
        setLoadingBuilderResumes(false);
      }
    };
    fetchBuilderResumes();
  }, []);

  // Determine if default should switch away from profile if none exists
  useEffect(() => {
    if (!hasProfileResume && resumeSource === 'profile') {
      if (builderResumes.length > 0) {
        setResumeSource('builder');
      }
    }
  }, [hasProfileResume, builderResumes.length]);

  const selectedBuilderResume = builderResumes.find((r) => r._id === selectedBuilderResumeId) || null;

  const mutation = useMutation({
    mutationFn: async () => {
      let finalResumeFileId: string | undefined = undefined;

      if (resumeSource === 'profile') {
        if (!hasProfileResume) {
          throw new Error('No profile resume found. Please upload one or select from AI Resume Builder.');
        }
        finalResumeFileId = undefined; // backend attaches profile resume
      } else if (resumeSource === 'custom') {
        if (!customResumeFileId) {
          throw new Error('Please upload a custom resume file or choose another option.');
        }
        finalResumeFileId = customResumeFileId;
      } else if (resumeSource === 'builder') {
        if (!selectedBuilderResume) {
          throw new Error('Please select a resume from your AI Resume Builder.');
        }

        // If not already uploaded as PDF, generate PDF from the rendered template and upload
        if (builderUploadedFileId) {
          finalResumeFileId = builderUploadedFileId;
        } else {
          const renderEl = pdfRenderRef.current;
          if (!renderEl) {
            throw new Error('Unable to render resume PDF. Please try again.');
          }

          const filename = `${(selectedBuilderResume.personal_info?.full_name || 'Resume').replace(/\s+/g, '_')}_${(selectedBuilderResume.target_role || 'Role').replace(/\s+/g, '_')}.pdf`;
          const pdfBlob = await generateResumePdfBlob(renderEl, filename);
          const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
          const uploadRes = await filesApi.upload(pdfFile, 'resume');
          finalResumeFileId = uploadRes.data.id;
          setBuilderUploadedFileId(finalResumeFileId);
        }
      }

      return apiFetch(`/jobs/${jobId}/applications`, {
        method: 'POST',
        body: JSON.stringify({
          answers,
          resume_file_id: finalResumeFileId,
        }),
      });
    },
    onSuccess: () => nav('/jobs/student/applications'),
    onError: (err: Error) => setError(err.message),
  });

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Resume must be under 10MB.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const res = await filesApi.upload(file, 'resume');
      setCustomResumeFileId(res.data.id);
      setCustomResumeFileName(res.data.original_name);
      setResumeSource('custom');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resume upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearCustomResume = () => {
    setCustomResumeFileId(null);
    setCustomResumeFileName('');
    if (resumeSource === 'custom') {
      setResumeSource(hasProfileResume ? 'profile' : 'builder');
    }
  };

  const handleLoadDemoResume = async () => {
    try {
      setLoadingBuilderResumes(true);
      const demo = await resumeApi.createDemoResume();
      setBuilderResumes((prev) => [demo, ...prev]);
      setSelectedBuilderResumeId(demo._id);
      setResumeSource('builder');
      setBuilderUploadedFileId(null);
    } catch (err) {
      console.error('Failed to create demo resume:', err);
    } finally {
      setLoadingBuilderResumes(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-12">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Apply for Job</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {job?.title}
          {job?.organization_name ? ` · ${job.organization_name}` : ''}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirmed) {
            setError('Please confirm your details are accurate before submitting.');
            return;
          }
          if (resumeSource === 'profile' && !hasProfileResume) {
            setError('No profile resume found. Upload a custom resume or pick one from AI Resume Builder.');
            return;
          }
          if (resumeSource === 'custom' && !customResumeFileId) {
            setError('Please select and upload a custom resume file.');
            return;
          }
          if (resumeSource === 'builder' && !selectedBuilderResumeId) {
            setError('Please choose a resume created with the AI Resume Builder.');
            return;
          }
          setError('');
          mutation.mutate();
        }}
      >
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Select Resume Source</h2>
            <p className="mt-1 text-xs text-slate-500">
              Choose which resume to submit with this application: your saved profile resume, a custom file upload, or a resume built with the AI Resume Builder.
            </p>
          </div>

          {/* Option 1: Profile Resume */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
              resumeSource === 'profile'
                ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name="resumeSource"
              checked={resumeSource === 'profile'}
              onChange={() => setResumeSource('profile')}
              className="mt-1 text-blue-600 focus:ring-blue-500"
              disabled={!hasProfileResume}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">1. Use profile resume</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasProfileResume
                  ? 'Your saved profile resume will be attached to this application.'
                  : 'No profile resume saved yet — upload one below or select from AI Resume Builder.'}
              </p>
            </div>
          </label>

          {/* Option 2: Upload Custom Resume */}
          <div
            className={`rounded-xl border p-4 transition-all ${
              resumeSource === 'custom'
                ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="resumeSource"
                checked={resumeSource === 'custom'}
                onChange={() => setResumeSource('custom')}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">2. Upload custom resume from device</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  PDF or Word · max 10MB · only used for this specific application.
                </p>
              </div>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleResumeUpload}
              disabled={uploading}
              className="sr-only"
              id="role-resume-upload"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 text-slate-500" />
                    Choose file from device
                  </>
                )}
              </button>
              {customResumeFileName && (
                <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 ring-1 ring-blue-200">
                  <FileUp className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                  {customResumeFileName}
                </span>
              )}
              {customResumeFileId && (
                <button
                  type="button"
                  onClick={clearCustomResume}
                  className="text-xs font-semibold text-slate-500 hover:text-rose-600"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Option 3: Select from AI Resume Builder */}
          <div
            className={`rounded-xl border p-4 transition-all ${
              resumeSource === 'builder'
                ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="resumeSource"
                checked={resumeSource === 'builder'}
                onChange={() => setResumeSource('builder')}
                className="mt-1 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">3. Select from AI Resume Builder</p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold">
                    <Sparkles className="w-2.5 h-2.5" />
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select any resume created in our AI Resume Builder with tailored ATS formatting.
                </p>
              </div>
            </label>

            {resumeSource === 'builder' && (
              <div className="mt-4 pl-7 space-y-3">
                {loadingBuilderResumes ? (
                  <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Loading your created resumes...</span>
                  </div>
                ) : builderResumes.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-indigo-200 bg-white text-center space-y-3">
                    <p className="text-xs text-slate-600 font-medium">You haven't built a resume yet.</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleLoadDemoResume}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Instant Auto-Create Resume</span>
                      </button>
                      <Link
                        to="/jobs/student/resume-builder/new"
                        target="_blank"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                      >
                        <span>Open Builder</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
                      <span>Choose one of your ({builderResumes.length}) built resumes:</span>
                      <Link
                        to="/jobs/student/resume-builder"
                        target="_blank"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-semibold"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Manage / Create New</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                      {builderResumes.map((resume) => {
                        const isSelected = selectedBuilderResumeId === resume._id;

                        return (
                          <div
                            key={resume._id}
                            onClick={() => {
                              setSelectedBuilderResumeId(resume._id);
                              setBuilderUploadedFileId(null);
                            }}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-xs'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">{resume.resume_name}</p>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">{resume.target_role}</p>
                              </div>
                              {isSelected && (
                                <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                  <Check className="w-2.5 h-2.5 stroke-3" />
                                </div>
                              )}
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                              <span className="text-slate-500 font-medium truncate">
                                {TEMPLATES.find((t) => t.id === resume.template_id)?.name ?? 'Modern Clean'}
                              </span>
                              <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <BarChart3 className="w-2.5 h-2.5" />
                                {resume.ats_score || 85}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submission Status Summary */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
            <span className="font-medium text-slate-500">Resume to be submitted:</span>
            <span className="font-semibold text-slate-900 truncate max-w-xs">
              {resumeSource === 'builder' && selectedBuilderResume
                ? `✨ AI Resume: ${selectedBuilderResume.resume_name}`
                : resumeSource === 'custom' && customResumeFileName
                  ? `📄 Custom File: ${customResumeFileName}`
                  : resumeSource === 'profile' && hasProfileResume
                    ? '👤 Saved Profile Resume'
                    : '⚠️ No resume selected yet'}
            </span>
          </div>
        </div>

        {/* Hidden Container for Background PDF Generation */}
        {selectedBuilderResume && (
          <div className="fixed -left-[9999px] -top-[9999px] w-[800px] pointer-events-none opacity-0">
            <div ref={pdfRenderRef} className="bg-white p-6">
              <ResumeTemplateRenderer resume={selectedBuilderResume} />
            </div>
          </div>
        )}

        {/* Questions section if required by employer */}
        {job?.questions && job.questions.length > 0 && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h2 className="text-sm font-semibold text-slate-900">Application Questions</h2>
            {job.questions.map((q, idx) => (
              <div key={idx}>
                <label className="text-xs font-medium text-slate-700">
                  {q.text}
                  {q.required ? ' *' : ''}
                </label>
                <textarea
                  required={q.required}
                  rows={3}
                  value={answers[q.text] || ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.text]: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        )}

        {/* Accuracy confirmation */}
        <label className="flex items-start gap-2 text-xs sm:text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
          />
          <span>I confirm all my details, answers, and selected resume are accurate.</span>
        </label>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={mutation.isPending || uploading}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Preparing resume & submitting application…</span>
            </>
          ) : (
            <span>Submit Application</span>
          )}
        </button>
      </form>
    </div>
  );
}
