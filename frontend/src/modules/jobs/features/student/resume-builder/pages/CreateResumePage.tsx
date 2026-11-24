import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { resumeApi } from '../services/resumeApi';
import { TEMPLATES } from '../templates';
import { ArrowLeft, ArrowRight, Sparkles, Check, FileText } from 'lucide-react';

export function CreateResumePage() {
  const navigate = useNavigate();
  const [resumeName, setResumeName] = useState('');
  const [targetRole, setTargetRole] = useState('Software Developer');
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = resumeName.trim() || 'My Resume';

    setIsSubmitting(true);
    try {
      const created = await resumeApi.createResume({
        resume_name: finalName,
        target_role: targetRole,
        template_id: selectedTemplate,
      });
      navigate(`/jobs/student/resume-builder/${created._id}`);
    } catch (err) {
      console.error('Failed to create resume:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadExample = async () => {
    setIsSubmitting(true);
    try {
      const created = await resumeApi.createDemoResume({
        resume_name: 'Ananya Sharma - Full Stack Developer',
        target_role: 'Full Stack Developer',
        template_id: selectedTemplate,
      });
      navigate(`/jobs/student/resume-builder/${created._id}`);
    } catch (err) {
      console.error('Failed to load demo resume:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Back button */}
      <Link
        to="/jobs/student/resume-builder"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to My Resumes</span>
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8">
        <div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Step 1 of 2</span>
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Create a New ATS-Ready Resume</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Name your resume, choose your target role, and select a template. You can customize colors, spacing, and content at any time.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Resume Name
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. SDE Frontend Resume 2026"
                  value={resumeName}
                  onChange={(e) => setResumeName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Target Role
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Full Stack Developer, Data Analyst"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Choose an ATS Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {TEMPLATES.map((tpl) => {
                const isSelected = selectedTemplate === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`relative p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-2 ring-blue-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-900">{tpl.name}</span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-3" />
                          </div>
                        )}
                      </div>
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 mb-2">
                        {tpl.tag}
                      </span>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{tpl.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleLoadExample}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Start with Example Resume</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Creating...' : 'Continue to Editor'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
