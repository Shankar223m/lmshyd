import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ResumeDocument } from '../types';
import { resumeApi } from '../services/resumeApi';
import { ResumeEditor } from '../components/ResumeEditor';
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';

export function ResumeEditorPage() {
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
        setError('Resume not found or could not be loaded.');
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
        <span>Loading ATS resume workspace...</span>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 bg-white border border-rose-200 rounded-2xl text-center space-y-4 shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="font-bold text-slate-900 text-sm">{error || 'Resume not found'}</h3>
          <Link
            to="/jobs/student/resume-builder"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Resumes</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-4 sm:-mx-6 sm:-my-6 h-[calc(100vh-4rem)] flex flex-col min-h-0 overflow-hidden bg-slate-50">
      <ResumeEditor initialResume={resume} />
    </div>
  );
}
