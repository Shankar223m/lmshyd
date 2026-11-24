import React, { useState } from 'react';
import { Project } from '../../types';
import { Plus, Trash2, FolderGit2, ChevronUp, ChevronDown, Check, Sparkles, ExternalLink } from 'lucide-react';
import { GithubIcon } from '../Icons';
import { aiApi } from '../../services/aiApi';
import { AISuggestionModal } from '../AISuggestionModal';

interface Props {
  projects: Project[];
  resumeId: string;
  onChange: (updated: Project[]) => void;
}

export const ProjectSection: React.FC<Props> = ({ projects = [], resumeId, onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isImproving, setIsImproving] = useState(false);

  // AI Modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [activeProjId, setActiveProjId] = useState<string | null>(null);
  const [origDesc, setOrigDesc] = useState('');
  const [sugDesc, setSugDesc] = useState('');

  const handleAdd = () => {
    const newProj: Project = {
      id: 'proj_' + Date.now(),
      name: '',
      project_type: 'Full-Stack Web App',
      description: '',
      technologies: [],
      start_date: '',
      end_date: '',
      github_url: '',
      demo_url: '',
    };
    onChange([newProj, ...projects]);
    setEditingId(newProj.id);
  };

  const handleUpdate = (id: string, field: keyof Project, val: any) => {
    onChange(projects.map((p) => (p.id === id ? { ...p, [field]: val } : p)));
  };

  const handleDelete = (id: string) => {
    onChange(projects.filter((p) => p.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= projects.length) return;
    const clone = [...projects];
    const itemA = clone[index];
    const itemB = clone[target];
    if (!itemA || !itemB) return;
    clone[index] = itemB;
    clone[target] = itemA;
    onChange(clone);
  };

  const handleAiAction = async (proj: Project, actionType: 'improve' | 'bullet_points' | 'more_technical' | 'shorten') => {
    setIsImproving(true);
    setActiveProjId(proj.id);
    setOrigDesc(proj.description || '');

    try {
      const res = await aiApi.improveProjectDescription(
        resumeId,
        proj.name || 'Project',
        proj.description || 'Built an application with modern tech stack',
        proj.technologies || [],
        actionType
      );
      setSugDesc(res.suggestion);
      setAiModalOpen(true);
    } catch (err) {
      console.error('Failed to improve project description:', err);
    } finally {
      setIsImproving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Key Projects</h3>
          <p className="text-xs text-[#64748B]">Showcase technical, academic, or open-source projects.</p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-xl shadow-sm shadow-[#635BFF]/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Project</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-[#E5E7EB] rounded-2xl bg-white">
          <FolderGit2 className="w-10 h-10 text-[#64748B]/40 mx-auto mb-2" />
          <p className="text-xs font-medium text-[#64748B]">No projects added yet.</p>
          <p className="text-[11px] text-[#64748B] mt-0.5">Projects are a critical indicator for recruiters & ATS scanners.</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-2 text-xs text-[#635BFF] hover:underline font-semibold"
          >
            + Add your first project
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((proj, index) => {
            const isEditing = editingId === proj.id;
            return (
              <div
                key={proj.id}
                className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm hover:border-[#635BFF]/40 transition-colors"
              >
                {/* Header Row */}
                <div
                  onClick={() => setEditingId(isEditing ? null : proj.id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer bg-[#F6F9F8] hover:bg-[#F5F3FF]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#EDE9FE] border border-[#635BFF]/30 flex items-center justify-center text-[#635BFF]">
                      <FolderGit2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-[#111827]">{proj.name || 'Project Name'}</h4>
                      <p className="text-[11px] text-[#64748B]">
                        {proj.project_type || 'Project'}{' '}
                        {proj.technologies?.length > 0 && `• ${proj.technologies.slice(0, 3).join(', ')}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === projects.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(proj.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 ml-1"
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
                          Project Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={proj.name}
                          onChange={(e) => handleUpdate(proj.id, 'name', e.target.value)}
                          placeholder="e.g. AI Resume Builder"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Project Type</label>
                        <input
                          type="text"
                          value={proj.project_type}
                          onChange={(e) => handleUpdate(proj.id, 'project_type', e.target.value)}
                          placeholder="e.g. Full-Stack Web Application / ML System"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">GitHub Repository URL</label>
                        <div className="relative">
                          <GithubIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="url"
                            value={proj.github_url}
                            onChange={(e) => handleUpdate(proj.id, 'github_url', e.target.value)}
                            placeholder="https://github.com/username/project"
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Live Demo URL</label>
                        <div className="relative">
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="url"
                            value={proj.demo_url}
                            onChange={(e) => handleUpdate(proj.id, 'demo_url', e.target.value)}
                            placeholder="https://my-demo-app.vercel.app"
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Technologies Used (comma separated)
                      </label>
                      <input
                        type="text"
                        value={proj.technologies?.join(', ') || ''}
                        onChange={(e) =>
                          handleUpdate(
                            proj.id,
                            'technologies',
                            e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                          )
                        }
                        placeholder="React, TypeScript, FastAPI, MongoDB, Tailwind CSS"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                      />
                    </div>

                    {/* Description with Multi-Action AI Toolbar */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-semibold text-[#111827]">
                          Description (Problem, Solution, Architecture & Contribution)
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-medium text-[#64748B] flex items-center gap-0.5">
                          <Sparkles className="w-3 h-3 text-[#635BFF]" /> AI Tools:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAiAction(proj, 'bullet_points')}
                          className="text-[10px] px-2 py-0.5 rounded border border-[#E5E7EB] hover:border-[#635BFF]/40 bg-[#F6F9F8] hover:bg-[#F5F3FF] text-[#64748B] hover:text-[#635BFF] transition-colors"
                        >
                          Create Bullet Points
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAiAction(proj, 'more_technical')}
                          className="text-[10px] px-2 py-0.5 rounded border border-[#E5E7EB] hover:border-[#635BFF]/40 bg-[#F6F9F8] hover:bg-[#F5F3FF] text-[#64748B] hover:text-[#635BFF] transition-colors"
                        >
                          Make More Technical
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAiAction(proj, 'shorten')}
                          className="text-[10px] px-2 py-0.5 rounded border border-[#E5E7EB] hover:border-[#635BFF]/40 bg-[#F6F9F8] hover:bg-[#F5F3FF] text-[#64748B] hover:text-[#635BFF] transition-colors"
                        >
                          Shorten
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAiAction(proj, 'improve')}
                          className="text-[10px] px-2 py-0.5 rounded border border-[#635BFF]/30 bg-[#F5F3FF] text-[#5046E5] font-medium hover:bg-[#EDE9FE] transition-colors"
                        >
                          Standard Improve
                        </button>
                      </div>

                      <textarea
                        rows={4}
                        value={proj.description}
                        onChange={(e) => handleUpdate(proj.id, 'description', e.target.value)}
                        placeholder="• Designed and built a real-time collaborative document platform&#10;• Integrated WebSocket protocols for instant sync&#10;• Deployed with Docker containers on cloud infrastructure"
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

      {/* Side-by-Side Modal */}
      <AISuggestionModal
        isOpen={aiModalOpen}
        title="AI Project Optimization"
        originalText={origDesc}
        suggestionText={sugDesc}
        isLoading={isImproving}
        onAccept={(applied) => {
          if (activeProjId) handleUpdate(activeProjId, 'description', applied);
          setAiModalOpen(false);
        }}
        onReject={() => setAiModalOpen(false)}
        onRegenerate={(tone) => {
          const target = projects.find(p => p.id === activeProjId);
          if (target) handleAiAction(target, (tone as any) || 'improve');
        }}
      />
    </div>
  );
};
