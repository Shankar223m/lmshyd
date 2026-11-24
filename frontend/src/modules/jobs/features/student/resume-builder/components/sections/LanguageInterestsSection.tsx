import React, { useState } from 'react';
import { Language } from '../../types';
import { Plus, X, Globe2, Heart } from 'lucide-react';

interface Props {
  languages: Language[];
  interests: string[];
  onChangeLanguages: (updated: Language[]) => void;
  onChangeInterests: (updated: string[]) => void;
}

const PROFICIENCIES = ['Native', 'Fluent', 'Professional', 'Intermediate', 'Beginner'];

export const LanguageInterestsSection: React.FC<Props> = ({
  languages = [],
  interests = [],
  onChangeLanguages,
  onChangeInterests,
}) => {
  const [newLang, setNewLang] = useState('');
  const [newProf, setNewProf] = useState('Professional');
  const [newInterest, setNewInterest] = useState('');

  const handleAddLanguage = () => {
    if (!newLang.trim()) return;
    onChangeLanguages([
      ...languages,
      {
        id: 'lang_' + Date.now(),
        language: newLang.trim(),
        proficiency: newProf,
      },
    ]);
    setNewLang('');
  };

  const handleRemoveLanguage = (id: string) => {
    onChangeLanguages(languages.filter((l) => l.id !== id));
  };

  const handleAddInterest = () => {
    if (!newInterest.trim()) return;
    if (interests.includes(newInterest.trim())) return;
    onChangeInterests([...interests, newInterest.trim()]);
    setNewInterest('');
  };

  const handleRemoveInterest = (item: string) => {
    onChangeInterests(interests.filter((i) => i !== item));
  };

  return (
    <div className="space-y-6">
      {/* Languages */}
      <div className="space-y-3">
        <div className="border-b border-[#E5E7EB] pb-2">
          <h3 className="text-base font-bold text-[#111827] flex items-center gap-1.5">
            <Globe2 className="w-4 h-4 text-[#635BFF]" /> Languages
          </h3>
          <p className="text-xs text-[#64748B]">Spoken and written language proficiencies.</p>
        </div>

        <div className="flex gap-2 text-xs">
          <input
            type="text"
            value={newLang}
            onChange={(e) => setNewLang(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddLanguage()}
            placeholder="e.g. English, Telugu, Spanish"
            className="flex-1 px-3 py-1.5 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-xs text-[#111827]"
          />
          <select
            value={newProf}
            onChange={(e) => setNewProf(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-xs bg-white text-[#111827]"
          >
            {PROFICIENCIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddLanguage}
            className="px-3 py-1.5 bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-lg font-semibold text-xs flex items-center gap-1 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {languages.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F6F9F8] border border-[#E5E7EB] rounded-lg text-xs"
            >
              <strong className="text-[#111827]">{l.language}</strong>
              <span className="text-[#64748B]">({l.proficiency})</span>
              <button
                type="button"
                onClick={() => handleRemoveLanguage(l.id)}
                className="text-[#64748B] hover:text-rose-600 ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div className="space-y-3 pt-2">
        <div className="border-b border-[#E5E7EB] pb-2">
          <h3 className="text-base font-bold text-[#111827] flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-rose-500" /> Interests & Hobbies
          </h3>
          <p className="text-xs text-[#64748B]">Add personal passions or community involvement manually.</p>
        </div>

        <div className="flex gap-2 text-xs">
          <input
            type="text"
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddInterest()}
            placeholder="e.g. Open Source, Robotics, Chess, Competitive Coding"
            className="flex-1 px-3 py-1.5 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-xs text-[#111827]"
          />
          <button
            type="button"
            onClick={handleAddInterest}
            className="px-3 py-1.5 bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-lg font-semibold text-xs flex items-center gap-1 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {interests.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium"
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => handleRemoveInterest(item)}
                className="text-slate-400 hover:text-rose-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
