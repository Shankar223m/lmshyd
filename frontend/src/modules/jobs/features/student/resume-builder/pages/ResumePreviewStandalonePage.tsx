import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ResumeDocument } from '../types';
import { resumeApi } from '../services/resumeApi';
import { ResumePreview } from '../components/ResumePreview';
import { RefreshCw, AlertCircle, ArrowLeft, Edit3 } from 'lucide-react';

export function ResumePreviewStandalonePage() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const [resume, setResume] = useState<ResumeDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resumeId) return;
    const loadResume = async () => {
      setLoading(true);
      try {
        const data = await resumeApi.getResume(resumeId);
        setResume(data);
      } catch (err: any) {
        console.error('Failed to fetch resume:', err);
        setError('Resume not found.');
      } finally {
        setLoading(false);
      }
    };
    loadResume();
  }, [resumeId]);

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-3 text-xs text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span>Loading preview...</span>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 bg-white border border-rose-200 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="font-bold text-slate-900 text-sm">{error || 'Resume not found'}</h3>
          <Link
            to="/jobs/student/resume-builder"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Resumes</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-4 sm:-mx-6 sm:-my-6 h-[calc(100vh-4rem)] flex flex-col min-h-0 bg-slate-100">
      {/* Top Bar */}
      <div className="h-12 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/jobs/student/resume-builder"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-xs font-bold text-slate-900 truncate max-w-xs">{resume.resume_name}</span>
        </div>
        <Link
          to={`/jobs/student/resume-builder/${resume._id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit Resume</span>
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ResumePreview
          resume={resume}
          onTemplateChange={async (templateId) => {
            const updated = await resumeApi.updateResume(resume._id, { template_id: templateId });
            setResume(updated);
          }}
          onStylingChange={async (styling) => {
            const updated = await resumeApi.updateResume(resume._id, { styling });
            setResume(updated);
          }}
        />
      </div>
    </div>
  );
}
