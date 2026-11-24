import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ResumeDocument } from '../types';
import { resumeApi } from '../services/resumeApi';
import { TEMPLATES } from '../templates';
import {
  FileText,
  Plus,
  Sparkles,
  ArrowRight,
  Clock,
  MoreVertical,
  Copy,
  Trash2,
  Edit3,
  BarChart3,
  Eye,
  Briefcase,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RenameResumeModal } from '../components/RenameResumeModal';

export function ResumeDashboardPage() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const [resumeToDelete, setResumeToDelete] = useState<ResumeDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resumeToRename, setResumeToRename] = useState<ResumeDocument | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const list = await resumeApi.getResumes();
      setResumes(list);
    } catch (err) {
      console.error('Failed to load resumes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDuplicate = async (resume: ResumeDocument) => {
    setActiveMenuId(null);
    try {
      const duplicated = await resumeApi.duplicateResume(resume._id);
      setResumes((prev) => [duplicated, ...prev]);
    } catch (err) {
      console.error('Failed to duplicate resume:', err);
    }
  };

  const handleDelete = async () => {
    if (!resumeToDelete) return;
    setIsDeleting(true);
    try {
      await resumeApi.deleteResume(resumeToDelete._id);
      setResumes((prev) => prev.filter((r) => r._id !== resumeToDelete._id));
      setResumeToDelete(null);
    } catch (err) {
      console.error('Failed to delete resume:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLoadDemo = async () => {
    try {
      setLoading(true);
      const demo = await resumeApi.createDemoResume();
      setResumes((prev) => [demo, ...prev]);
      navigate(`/jobs/student/resume-builder/${demo._id}`);
    } catch (err) {
      console.error('Failed to create demo resume:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI ATS Resume Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AI Resume Builder</h1>
          <p className="text-sm text-blue-100 mt-1 max-w-xl">
            Build ATS-optimized resumes with built-in keyword scoring, 5 recruiter-tested templates, and apply directly to campus & open market jobs.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleLoadDemo}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold transition-all backdrop-blur-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Load Example Resume</span>
          </button>
          <Link
            to="/jobs/student/resume-builder/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Resume</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Resumes</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{resumes.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Average ATS Score</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {resumes.length > 0
                ? Math.round(resumes.reduce((sum, r) => sum + (r.ats_score || 0), 0) / resumes.length)
                : 0}
              <span className="text-sm font-normal text-slate-400"> / 100</span>
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Job Application Ready</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {resumes.filter((r) => (r.completion_percentage || 0) >= 70).length}
            </p>
          </div>
        </div>
      </div>

      {/* Resumes Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">My Resumes</h2>
            <p className="text-xs text-slate-500">Resumes created here can be selected when applying to any job posting.</p>
          </div>
          <Link
            to="/jobs/student/resume-builder/new"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>New Resume</span>
          </Link>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-500">Loading your resumes...</div>
        ) : resumes.length === 0 ? (
          <div className="py-16 border-2 border-dashed border-slate-200 rounded-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">No resumes built yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Create a new resume with an ATS-friendly layout or load our complete demo resume in one click.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleLoadDemo}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                Load Example Resume
              </button>
              <Link
                to="/jobs/student/resume-builder/new"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Create from scratch
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
            {resumes.map((resume) => {
              const score = resume.ats_score || 0;
              const isScoreGood = score >= 75;
              const isScoreMedium = score >= 55 && score < 75;

              return (
                <div
                  key={resume._id}
                  className="rounded-xl border border-slate-200 hover:border-blue-400 bg-white p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group relative"
                >
                  <div>
                    {/* Header: Title and Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {resume.resume_name}
                        </h3>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{resume.target_role || 'General'}</p>
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === resume._id ? null : resume._id)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuId === resume._id && (
                          <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg z-20 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                navigate(`/jobs/student/resume-builder/${resume._id}`);
                              }}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit in Workspace</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                navigate(`/jobs/student/resume-builder/${resume._id}/preview`);
                              }}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Full Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setResumeToRename(resume);
                              }}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Rename Resume</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(resume)}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Duplicate Resume</span>
                            </button>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setResumeToDelete(resume);
                              }}
                              className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Resume</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Template Badge & Score Pill */}
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium text-slate-700">
                        {TEMPLATES.find((t) => t.id === resume.template_id)?.name ?? 'Modern Clean'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          isScoreGood
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isScoreMedium
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <BarChart3 className="w-3 h-3" />
                        <span>ATS: {score}%</span>
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                        <span>Profile Completion</span>
                        <span>{resume.completion_percentage || 0}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${resume.completion_percentage || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom / Actions */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(resume.updated_at || resume.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/jobs/student/resume-builder/${resume._id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <span>Edit</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(resumeToDelete)}
        title="Delete Resume"
        message={`Are you sure you want to delete "${resumeToDelete?.resume_name}"? This action cannot be undone.`}
        confirmText="Delete Resume"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setResumeToDelete(null)}
      />

      {/* Rename Resume Modal */}
      {resumeToRename && (
        <RenameResumeModal
          isOpen={Boolean(resumeToRename)}
          resumeId={resumeToRename._id}
          currentName={resumeToRename.resume_name}
          onClose={() => setResumeToRename(null)}
          onRenamed={(newName) => {
            setResumes((prev) =>
              prev.map((r) => (r._id === resumeToRename._id ? { ...r, resume_name: newName } : r)),
            );
            setResumeToRename(null);
          }}
        />
      )}
    </div>
  );
}
