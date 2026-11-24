import React, { useState } from 'react';
import { SkillItem } from '../../types';
import { Plus, X, Sparkles, RefreshCw, Search, Check, ShieldAlert } from 'lucide-react';
import { aiApi } from '../../services/aiApi';

interface Props {
  skills: SkillItem[];
  resumeId: string;
  targetRole: string;
  onChange: (updated: SkillItem[]) => void;
}

const DEFAULT_CATEGORIES = [
  'Programming Languages',
  'Frontend',
  'Backend',
  'Database',
  'AI / ML',
  'Tools',
];

export const SkillsSection: React.FC<Props> = ({ skills = [], resumeId, targetRole, onChange }) => {
  const [newSkillName, setNewSkillName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Programming Languages');
  const [customCategory, setCustomCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // AI Suggestions Drawer / Modal state
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ name: string; category: string; reason: string }>>([]);

  const handleAddSkill = (name: string, category: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (skills.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) return;

    const newSkill: SkillItem = {
      id: 'sk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: trimmed,
      category: category || 'General',
      level: 'Intermediate',
    };
    onChange([...skills, newSkill]);
    setNewSkillName('');
  };

  const handleRemoveSkill = (id: string) => {
    onChange(skills.filter(s => s.id !== id));
  };

  const handleFetchAiSkills = async () => {
    setIsSuggesting(true);
    try {
      const res = await aiApi.suggestSkills(resumeId, targetRole);
      setAiSuggestions(res.suggestions);
      setShowAiModal(true);
    } catch (err) {
      console.error('Failed to get skill suggestions:', err);
    } finally {
      setIsSuggesting(false);
    }
  };

  const filteredSkills = searchTerm
    ? skills.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.category.toLowerCase().includes(searchTerm.toLowerCase()))
    : skills;

  // Group by category
  const categorized = filteredSkills.reduce((acc, skill) => {
    const cat = skill.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {} as Record<string, SkillItem[]>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Skills & Competencies</h3>
          <p className="text-xs text-[#64748B]">
            Categorized technical and professional skills tailored for {targetRole || 'your target role'}.
          </p>
        </div>

        <button
          type="button"
          onClick={handleFetchAiSkills}
          disabled={isSuggesting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-xl shadow-sm shadow-[#635BFF]/20 transition-all disabled:opacity-50"
        >
          {isSuggesting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Suggest Skills with AI</span>
            </>
          )}
        </button>
      </div>

      {/* Add New Skill Input Card */}
      <div className="p-3.5 bg-[#F6F9F8] border border-[#E5E7EB] rounded-xl space-y-2.5 text-xs">
        <span className="font-semibold text-[#111827]">Add Skill Manually</span>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-5">
            <input
              type="text"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSkill(newSkillName, customCategory || selectedCategory);
                }
              }}
              placeholder="e.g. React, Docker, PyTorch"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]/20 outline-none text-xs text-[#111827]"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-xs bg-white text-[#111827]"
            >
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="custom">+ Custom Category</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={() => handleAddSkill(newSkillName, customCategory || selectedCategory)}
              disabled={!newSkillName.trim()}
              className="w-full py-2 bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {selectedCategory === 'custom' && (
          <input
            type="text"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="Type custom category name..."
            className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-xs text-[#111827]"
          />
        )}
      </div>

      {/* Search skills filter */}
      {skills.length > 5 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search added skills..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] outline-none focus:border-[#635BFF] text-[#111827]"
          />
        </div>
      )}

      {/* Categorized Skills Display */}
      {Object.keys(categorized).length === 0 ? (
        <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-xs text-slate-500">No skills added yet. Add skills manually or click "Suggest Skills with AI".</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(categorized).map(([category, items]) => (
            <div key={category} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 tracking-wide">{category}</span>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                  {items.length} {items.length === 1 ? 'skill' : 'skills'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((skill) => (
                  <span
                    key={skill.id}
                    className="group inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 transition-colors"
                  >
                    <span>{skill.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill.id)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Suggest Skills Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#E5E7EB] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F6F9F8]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#635BFF]" />
                <h3 className="font-bold text-sm text-[#111827]">Recommended Skills for {targetRole}</h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-[#64748B] hover:text-[#111827] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <div className="flex items-center gap-2 text-[11px] text-[#5046E5] bg-[#F5F3FF] p-2.5 rounded-lg border border-[#635BFF]/30">
                <ShieldAlert className="w-4 h-4 text-[#635BFF] shrink-0" />
                <span>
                  <strong>Strict Consent:</strong> Click '+' to approve each skill. Only add skills you have actual experience with.
                </span>
              </div>

              <div className="space-y-2">
                {aiSuggestions.map((sug, idx) => {
                  const alreadyAdded = skills.some(s => s.name.toLowerCase() === sug.name.toLowerCase());
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border border-[#E5E7EB] rounded-xl hover:border-[#635BFF]/40 transition-colors bg-white text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#111827]">{sug.name}</span>
                          <span className="text-[10px] bg-[#F6F9F8] border border-[#E5E7EB] text-[#111827] px-1.5 py-0.5 rounded font-medium">
                            {sug.category}
                          </span>
                        </div>
                        {sug.reason && (
                          <p className="text-[11px] text-[#64748B] mt-0.5">{sug.reason}</p>
                        )}
                      </div>

                      {alreadyAdded ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#5046E5] bg-[#F5F3FF] px-2.5 py-1 rounded-lg">
                          <Check className="w-3.5 h-3.5" /> Added
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddSkill(sug.name, sug.category)}
                          className="flex items-center gap-1 px-3 py-1 bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#E5E7EB] bg-[#F6F9F8] flex justify-end">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="px-4 py-1.5 bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-lg text-xs font-medium shadow-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
