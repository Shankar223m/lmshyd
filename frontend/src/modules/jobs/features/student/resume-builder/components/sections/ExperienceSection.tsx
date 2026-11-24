import React, { useState } from 'react';
import { Experience } from '../../types';
import { Plus, Trash2, Briefcase, ChevronUp, ChevronDown, Check, Sparkles } from 'lucide-react';
import { aiApi } from '../../services/aiApi';
import { AISuggestionModal } from '../AISuggestionModal';

interface Props {
  experience: Experience[];
  resumeId: string;
  onChange: (updated: Experience[]) => void;
}

export const ExperienceSection: React.FC<Props> = ({ experience = [], resumeId, onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isImproving, setIsImproving] = useState(false);
  
  // AI Suggestion Modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [activeExpId, setActiveExpId] = useState<string | null>(null);
  const [originalResp, setOriginalResp] = useState('');
  const [suggestedResp, setSuggestedResp] = useState('');

  const handleAdd = () => {
    const newExp: Experience = {
      id: 'exp_' + Date.now(),
      job_title: '',
      company: '',
      employment_type: 'Full-time',
      location: '',
      start_date: '',
      end_date: '',
      currently_working: false,
      responsibilities: '',
      technologies: [],
    };
    onChange([newExp, ...experience]);
    setEditingId(newExp.id);
  };

  const handleUpdate = (id: string, field: keyof Experience, val: any) => {
    onChange(
      experience.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const handleDelete = (id: string) => {
    onChange(experience.filter((item) => item.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= experience.length) return;
    const clone = [...experience];
    const itemA = clone[index];
    const itemB = clone[target];
    if (!itemA || !itemB) return;
    clone[index] = itemB;
    clone[target] = itemA;
    onChange(clone);
  };

  const handleImproveWithAI = async (exp: Experience) => {
    if (!exp.responsibilities && !exp.job_title) return;
    setIsImproving(true);
    setActiveExpId(exp.id);
    setOriginalResp(exp.responsibilities || '');

    try {
      const res = await aiApi.improveExperience(
        resumeId,
        exp.job_title || 'Software Developer',
        exp.company || 'Company',
        exp.responsibilities || 'Developed core application features',
        exp.technologies || []
      );
      setSuggestedResp(res.suggestion);
      setAiModalOpen(true);
    } catch (err) {
      console.error('Failed to improve experience:', err);
    } finally {
      setIsImproving(false);
    }
  };

  const handleAcceptAi = (improvedText: string) => {
    if (activeExpId) {
      handleUpdate(activeExpId, 'responsibilities', improvedText);
    }
    setAiModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Work Experience</h3>
          <p className="text-xs text-[#64748B]">Highlight full-time, part-time, or contract professional roles.</p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-xl shadow-sm shadow-[#635BFF]/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Experience</span>
        </button>
      </div>

      {experience.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-[#E5E7EB] rounded-2xl bg-white">
          <Briefcase className="w-10 h-10 text-[#64748B]/40 mx-auto mb-2" />
          <p className="text-xs font-medium text-[#64748B]">No work experience records added yet.</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-2 text-xs text-[#635BFF] hover:underline font-semibold"
          >
            + Add your job role
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {experience.map((exp, index) => {
            const isEditing = editingId === exp.id;
            return (
              <div
                key={exp.id}
                className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm hover:border-[#635BFF]/40 transition-colors"
              >
                {/* Header Row */}
                <div
                  onClick={() => setEditingId(isEditing ? null : exp.id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer bg-[#F6F9F8] hover:bg-[#F5F3FF]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#EDE9FE] border border-[#635BFF]/30 flex items-center justify-center text-[#635BFF]">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-[#111827]">
                        {exp.job_title || 'Job Title'} {exp.company ? `@ ${exp.company}` : ''}
                      </h4>
                      <p className="text-[11px] text-[#64748B]">
                        {exp.start_date || 'Start'} – {exp.currently_working ? 'Present' : exp.end_date || 'End'}{' '}
                        {exp.employment_type && `• ${exp.employment_type}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === experience.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(exp.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors ml-1"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Form Fields */}
                {isEditing && (
                  <div className="p-4 border-t border-slate-200 bg-white space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Job Title <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={exp.job_title}
                          onChange={(e) => handleUpdate(exp.id, 'job_title', e.target.value)}
                          placeholder="e.g. Software Engineer"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Company / Organization</label>
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => handleUpdate(exp.id, 'company', e.target.value)}
                          placeholder="e.g. Microsoft / Infosys / Google"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Employment Type</label>
                        <select
                          value={exp.employment_type}
                          onChange={(e) => handleUpdate(exp.id, 'employment_type', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs bg-white"
                        >
                          <option value="Full-time">Full-time</option>
                          <option value="Part-time">Part-time</option>
                          <option value="Contract">Contract</option>
                          <option value="Freelance">Freelance</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Location</label>
                        <input
                          type="text"
                          value={exp.location}
                          onChange={(e) => handleUpdate(exp.id, 'location', e.target.value)}
                          placeholder="e.g. Bengaluru, India (or Remote)"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Start Date</label>
                        <input
                          type="text"
                          value={exp.start_date}
                          onChange={(e) => handleUpdate(exp.id, 'start_date', e.target.value)}
                          placeholder="Jan 2024"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">End Date</label>
                        <input
                          type="text"
                          disabled={exp.currently_working}
                          value={exp.end_date}
                          onChange={(e) => handleUpdate(exp.id, 'end_date', e.target.value)}
                          placeholder="Dec 2024"
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-xs disabled:bg-slate-100 disabled:opacity-60 text-[#111827]"
                        />
                      </div>
                      <div className="pt-4">
                        <label className="flex items-center gap-2 cursor-pointer text-[#111827]">
                          <input
                            type="checkbox"
                            checked={exp.currently_working}
                            onChange={(e) => handleUpdate(exp.id, 'currently_working', e.target.checked)}
                            className="rounded text-[#635BFF] focus:ring-[#635BFF] w-3.5 h-3.5"
                          />
                          <span className="text-[11px] font-medium">Currently Working</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111827] mb-1">
                        Technologies Used (comma separated)
                      </label>
                      <input
                        type="text"
                        value={exp.technologies?.join(', ') || ''}
                        onChange={(e) =>
                          handleUpdate(
                            exp.id,
                            'technologies',
                            e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                          )
                        }
                        placeholder="FastAPI, Python, MongoDB, Docker, Git"
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-xs text-[#111827]"
                      />
                    </div>

                    {/* Responsibilities with AI Improve */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-[#111827]">
                          Responsibilities & Key Contributions
                        </label>
                        <button
                          type="button"
                          onClick={() => handleImproveWithAI(exp)}
                          disabled={isImproving}
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#635BFF] hover:text-[#5046E5] transition-colors"
                        >
                          <Sparkles className="w-3 h-3 text-[#635BFF]" />
                          <span>Improve with AI</span>
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        value={exp.responsibilities}
                        onChange={(e) => handleUpdate(exp.id, 'responsibilities', e.target.value)}
                        placeholder="• Engineered RESTful APIs using FastAPI&#10;• Reduced latency by 30% through query optimization"
                        className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-xs leading-relaxed text-[#111827]"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 px-3 py-1 bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Suggestion Modal */}
      <AISuggestionModal
        isOpen={aiModalOpen}
        title="AI Experience Bullet Points"
        originalText={originalResp}
        suggestionText={suggestedResp}
        isLoading={isImproving}
        onAccept={handleAcceptAi}
        onReject={() => setAiModalOpen(false)}
        onRegenerate={() => {
          const target = experience.find(e => e.id === activeExpId);
          if (target) handleImproveWithAI(target);
        }}
      />
    </div>
  );
};
