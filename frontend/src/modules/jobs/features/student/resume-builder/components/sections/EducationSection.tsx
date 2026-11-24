import React, { useState } from 'react';
import { Education } from '../../types';
import { Plus, Trash2, GraduationCap, ChevronUp, ChevronDown, Check } from 'lucide-react';

interface Props {
  education: Education[];
  onChange: (updated: Education[]) => void;
}

export const EducationSection: React.FC<Props> = ({ education = [], onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = () => {
    const newEdu: Education = {
      id: 'edu_' + Date.now(),
      degree: '',
      specialization: '',
      institution: '',
      location: '',
      start_year: '',
      end_year: '',
      currently_studying: false,
      gpa: '',
      percentage: '',
      description: '',
    };
    onChange([newEdu, ...education]);
    setEditingId(newEdu.id);
  };

  const handleUpdate = (id: string, field: keyof Education, val: any) => {
    onChange(
      education.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const handleDelete = (id: string) => {
    onChange(education.filter((item) => item.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= education.length) return;
    const clone = [...education];
    const itemA = clone[index];
    const itemB = clone[target];
    if (!itemA || !itemB) return;
    clone[index] = itemB;
    clone[target] = itemA;
    onChange(clone);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Education</h3>
          <p className="text-xs text-[#64748B]">Add your university degrees, colleges, and academic distinctions.</p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-xl shadow-sm shadow-[#635BFF]/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Education</span>
        </button>
      </div>

      {education.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-[#E5E7EB] rounded-2xl bg-white">
          <GraduationCap className="w-10 h-10 text-[#64748B]/40 mx-auto mb-2" />
          <p className="text-xs font-medium text-[#64748B]">No education records added yet.</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-2 text-xs text-[#635BFF] hover:underline font-semibold"
          >
            + Add your degree or college
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {education.map((edu, index) => {
            const isEditing = editingId === edu.id;
            return (
              <div
                key={edu.id}
                className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm hover:border-[#635BFF]/40 transition-colors"
              >
                {/* Header Card Row */}
                <div
                  onClick={() => setEditingId(isEditing ? null : edu.id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer bg-[#F6F9F8] hover:bg-[#F5F3FF]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#EDE9FE] border border-[#635BFF]/30 flex items-center justify-center text-[#635BFF]">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-[#111827]">
                        {edu.degree || 'Degree Name'} {edu.specialization ? `in ${edu.specialization}` : ''}
                      </h4>
                      <p className="text-[11px] text-[#64748B]">
                        {edu.institution || 'University Name'}{' '}
                        {edu.start_year && `• ${edu.start_year} - ${edu.currently_studying ? 'Present' : edu.end_year || 'End'}`}
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
                      disabled={index === education.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(edu.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors ml-1"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Form Fields Accordion */}
                {isEditing && (
                  <div className="p-4 border-t border-slate-200 bg-white space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Degree / Qualification <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => handleUpdate(edu.id, 'degree', e.target.value)}
                          placeholder="e.g. B.Tech, M.S., B.Sc."
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Specialization / Major</label>
                        <input
                          type="text"
                          value={edu.specialization}
                          onChange={(e) => handleUpdate(edu.id, 'specialization', e.target.value)}
                          placeholder="e.g. Computer Science / AI & Data Science"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">College / University</label>
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => handleUpdate(edu.id, 'institution', e.target.value)}
                          placeholder="e.g. Stanford University / IIT Bombay"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Location</label>
                        <input
                          type="text"
                          value={edu.location}
                          onChange={(e) => handleUpdate(edu.id, 'location', e.target.value)}
                          placeholder="e.g. Hyderabad, India"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Start Year</label>
                        <input
                          type="text"
                          value={edu.start_year}
                          onChange={(e) => handleUpdate(edu.id, 'start_year', e.target.value)}
                          placeholder="2021"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">End Year / Expected</label>
                        <input
                          type="text"
                          disabled={edu.currently_studying}
                          value={edu.end_year}
                          onChange={(e) => handleUpdate(edu.id, 'end_year', e.target.value)}
                          placeholder="2025"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-xs disabled:bg-slate-100 disabled:opacity-60"
                        />
                      </div>
                      <div className="pt-4">
                        <label className="flex items-center gap-2 cursor-pointer text-[#111827]">
                          <input
                            type="checkbox"
                            checked={edu.currently_studying}
                            onChange={(e) => handleUpdate(edu.id, 'currently_studying', e.target.checked)}
                            className="rounded text-[#635BFF] focus:ring-[#635BFF] w-3.5 h-3.5"
                          />
                          <span className="text-[11px] font-medium">Currently Studying</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#111827] mb-1">CGPA / GPA</label>
                        <input
                          type="text"
                          value={edu.gpa}
                          onChange={(e) => handleUpdate(edu.id, 'gpa', e.target.value)}
                          placeholder="e.g. 8.8 / 10 or 3.8 / 4.0"
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-xs text-[#111827]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#111827] mb-1">Percentage (Optional)</label>
                        <input
                          type="text"
                          value={edu.percentage}
                          onChange={(e) => handleUpdate(edu.id, 'percentage', e.target.value)}
                          placeholder="e.g. 88%"
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-xs text-[#111827]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111827] mb-1">
                        Description / Relevant Coursework
                      </label>
                      <textarea
                        rows={2}
                        value={edu.description}
                        onChange={(e) => handleUpdate(edu.id, 'description', e.target.value)}
                        placeholder="Relevant Coursework: Data Structures, Algorithms, Machine Learning, Database Management..."
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-xs text-[#111827]"
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
    </div>
  );
};
