import React, { useState } from 'react';
import { ResumeCompletion } from '../types';
import { CheckCircle, AlertCircle, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

interface ResumeProgressProps {
  completion?: ResumeCompletion;
  percentage: number;
}

export const ResumeProgress: React.FC<ResumeProgressProps> = ({ completion, percentage }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getColor = (pct: number) => {
    if (pct >= 85) return 'bg-[#16A37B]';
    if (pct >= 60) return 'bg-[#635BFF]';
    if (pct >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F5F3FF] transition-all text-xs text-left shadow-sm"
      >
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[#64748B]">Completion</span>
            <span className="font-bold text-[#111827]">{percentage}%</span>
          </div>
          <div className="w-24 bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getColor(percentage)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-[#64748B]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />}
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-[#E5E7EB] p-4 z-40 animate-in fade-in">
          <div className="flex justify-between items-center pb-2 border-b border-[#E5E7EB] mb-3">
            <span className="font-bold text-xs text-[#111827]">Section Status</span>
            <span className="text-xs font-bold text-[#635BFF]">{percentage}% Complete</span>
          </div>

          {/* Sections List */}
          <div className="space-y-2 mb-3">
            {completion?.sections?.map((sec, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  {sec.is_complete ? (
                    <CheckCircle className="w-3.5 h-3.5 text-[#16A37B] shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="text-[#111827]">{sec.section}</span>
                </div>
                <span className="text-[#64748B] font-medium text-[11px]">{sec.percentage}%</span>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {completion?.suggestions && completion.suggestions.length > 0 && (
            <div className="pt-2 border-t border-[#E5E7EB]">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 mb-1">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                <span>Recommendations:</span>
              </div>
              <ul className="text-[11px] text-[#64748B] space-y-1">
                {completion.suggestions.slice(0, 2).map((sug, idx) => (
                  <li key={idx}>• {sug}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
