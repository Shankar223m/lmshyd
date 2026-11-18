import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch, authApi, filesApi, type ApiResponse } from '../../../services/api';

type JobDetail = {
  id: string;
  title: string;
  organization_name?: string;
  questions?: Array<{ text: string; required: boolean }>;
};

export function ApplyPage() {
  const { jobId } = useParams();
  const nav = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumeFileId, setResumeFileId] = useState<string | null>(null);
  const [resumeFileName, setResumeFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const { data: jobData } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => apiFetch<ApiResponse<JobDetail>>(`/jobs/${jobId}`),
  });
  const job = jobData?.data;

  const { data: profileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => authApi.getProfile(),
  });
  const profile = profileData?.data.student_profile;

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/jobs/${jobId}/applications`, {
        method: 'POST',
        body: JSON.stringify({
          answers,
          resume_file_id: resumeFileId || profile?.resume_file_id || undefined,
        }),
      }),
    onSuccess: () => nav('/jobs/student/applications'),
    onError: (err: Error) => setError(err.message),
  });

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await filesApi.upload(file, 'resumes');
      setResumeFileId(res.data.id);
      setResumeFileName(res.data.original_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resume upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Apply</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {job?.title}
          {job?.organization_name ? ` · ${job.organization_name}` : ''}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirmed) {
            setError('Confirm your details are accurate.');
            return;
          }
          setError('');
          mutation.mutate();
        }}
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Resume</h2>
          <p className="mt-1 text-xs text-slate-500">
            {resumeFileName
              ? `Using ${resumeFileName}`
              : profile?.resume_file_id
                ? 'Using profile resume'
                : 'Upload a resume'}
          </p>
          <input
            type="file"
            accept=".pdf,.docx,application/pdf"
            onChange={handleResumeUpload}
            disabled={uploading}
            className="mt-2 block w-full text-xs"
          />
          {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
        </div>

        {job?.questions && job.questions.length > 0 && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h2 className="text-sm font-semibold text-slate-900">Questions</h2>
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
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          I confirm my details are accurate.
        </label>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-xl bg-[#635BFF] hover:bg-[#5046E5] py-2.5 text-sm font-semibold text-white shadow-xs transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? 'Submitting…' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
}
