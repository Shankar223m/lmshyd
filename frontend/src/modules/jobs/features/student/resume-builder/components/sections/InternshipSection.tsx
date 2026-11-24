import React, { useState } from 'react';
import { Internship } from '../../types';
import { Plus, Trash2, Check, Sparkles } from 'lucide-react';
import { aiApi } from '../../services/aiApi';
import { AISuggestionModal } from '../AISuggestionModal';

interface Props {
  internships: Internship[];
  resumeId: string;
  onChange: (updated: Internship[]) => void;
}

export const InternshipSection: React.FC<Props> = ({ internships = [], resumeId, onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [origText, setOrigText] = useState('');
  const [sugText, setSugText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = () => {
    const newInt: Internship = {
      id: 'int_' + Date.now(),
      role: '',
      company: '',
      location: '',
      start_date: '',
      end_date: '',
      currently_working: false,
      description: '',
      responsibilities: '',
      technologies: [],
      project_worked_on: '',
    };
    onChange([newInt, ...internships]);
    setEditingId(newInt.id);
  };

  const handleUpdate = (id: string, field: keyof Internship, val: any) => {
    onChange(internships.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
  };

  const handleDelete = (id: string) => {
    onChange(internships.filter((i) => i.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleImproveWithAI = async (item: Internship) => {
    setIsLoading(true);
    setActiveId(item.id);
    setOrigText(item.description || item.responsibilities || '');
    try {
      const res = await aiApi.improveExperience(
        resumeId,
        item.role || 'Intern',
        item.company || 'Company',
        item.description || item.responsibilities || 'Assisted in technical projects',
        item.technologies || []
      );
      setSugText(res.suggestion);
      setAiModalOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Internship Experience</h3>
          <p className="text-xs text-[#64748B]">Dedicated section for training, internships, and apprentice projects.</p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Internship</span>
        </button>
      </div>

      {internships.length === 0 ? (
        <div className="p-6 text-center border-2 border-dashed border-[#E5E7EB] rounded-2xl bg-white">
          <p className="text-xs text-[#64748B]">No internships listed. Click "+ Add Internship" if applicable.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {internships.map((intn) => {
            const isEditing = editingId === intn.id;
            return (
              <div key={intn.id} className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
                <div
                  onClick={() => setEditingId(isEditing ? null : intn.id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer bg-[#F6F9F8] hover:bg-[#F5F3FF]"
                >
                  <div>
                    <h4 className="font-semibold text-xs text-slate-900">
                      {intn.role || 'Internship Role'} {intn.company ? `@ ${intn.company}` : ''}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {intn.start_date || 'Start'} – {intn.currently_working ? 'Present' : intn.end_date || 'End'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleDelete(intn.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="p-4 border-t border-slate-200 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role / Domain</label>
                        <input
                          type="text"
                          value={intn.role}
                          onChange={(e) => handleUpdate(intn.id, 'role', e.target.value)}
                          placeholder="e.g. AI Research Intern"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Company / Organization</label>
                        <input
                          type="text"
                          value={intn.company}
                          onChange={(e) => handleUpdate(intn.id, 'company', e.target.value)}
                          placeholder="e.g. Infosys Labs"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Start Date</label>
                        <input
                          type="text"
                          value={intn.start_date}
                          onChange={(e) => handleUpdate(intn.id, 'start_date', e.target.value)}
                          placeholder="May 2024"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">End Date</label>
                        <input
                          type="text"
                          disabled={intn.currently_working}
                          value={intn.end_date}
                          onChange={(e) => handleUpdate(intn.id, 'end_date', e.target.value)}
                          placeholder="Jul 2024"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="pt-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[#111827]">
                          <input
                            type="checkbox"
                            checked={intn.currently_working}
                            onChange={(e) => handleUpdate(intn.id, 'currently_working', e.target.checked)}
                            className="rounded text-[#635BFF] focus:ring-[#635BFF] w-3.5 h-3.5"
                          />
                          <span className="text-[11px]">Currently Working</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-[#111827]">
                          Internship Description & Contributions
                        </label>
                        <button
                          type="button"
                          onClick={() => handleImproveWithAI(intn)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#635BFF] hover:text-[#5046E5]"
                        >
                          <Sparkles className="w-3 h-3 text-[#635BFF]" />
                          <span>Improve with AI</span>
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={intn.description}
                        onChange={(e) => handleUpdate(intn.id, 'description', e.target.value)}
                        placeholder="Worked on computer vision pipelines and data preprocessing..."
                        className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-[#111827]"
                      />
                    </div>

                    <div className="flex justify-end">
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

      <AISuggestionModal
        isOpen={aiModalOpen}
        title="AI Internship Description"
        originalText={origText}
        suggestionText={sugText}
        isLoading={isLoading}
        onAccept={(applied) => {
          if (activeId) handleUpdate(activeId, 'description', applied);
          setAiModalOpen(false);
        }}
        onReject={() => setAiModalOpen(false)}
        onRegenerate={() => {
          const target = internships.find(i => i.id === activeId);
          if (target) handleImproveWithAI(target);
        }}
      />
    </div>
  );
};
