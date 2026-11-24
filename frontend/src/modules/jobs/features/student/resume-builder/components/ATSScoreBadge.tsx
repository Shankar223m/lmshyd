import React, { useState } from 'react';
import { ATSScoreData } from '../types';
import { AlertCircle, CheckCircle2, ChevronRight, X, Info } from 'lucide-react';

interface ATSScoreBadgeProps {
  scoreData?: ATSScoreData;
  score: number;
  resumeId?: string;
  onRefresh?: () => void;
}

export const ATSScoreBadge: React.FC<ATSScoreBadgeProps> = ({ scoreData, score, resumeId }) => {
  const [showModal, setShowModal] = useState(false);

  // Color grading
  const getScoreColor = (val: number) => {
    if (val >= 80) return 'text-[#16A37B] bg-[#ECFDF3] border-[#16A37B]/20';
    if (val >= 65) return 'text-[#16A37B] bg-[#ECFDF3] border-[#16A37B]/20';
    if (val >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const getScoreBorder = (val: number) => {
    if (val >= 80) return 'border-[#16A37B] text-[#16A37B]';
    if (val >= 65) return 'border-[#16A37B] text-[#16A37B]';
    if (val >= 50) return 'border-amber-500 text-amber-600';
    return 'border-rose-500 text-rose-600';
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition-all hover:scale-105 ${getScoreColor(
          score
        )}`}
        title="Click to view ATS breakdown"
      >
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold text-[11px] ${getScoreBorder(score)}`}>
          {score}
        </div>
        <div className="text-left">
          <div className="font-bold leading-none">ATS Score</div>
          <div className="text-[10px] opacity-80 leading-tight">
            {score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : 'Needs Work'}
          </div>
        </div>
      </button>

      {/* ATS Breakdown Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[#E5E7EB] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F6F9F8]">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center font-extrabold text-base ${getScoreBorder(score)}`}>
                  {score}
                </div>
                <div>
                  <h3 className="font-bold text-[#111827] text-base">ATS Analysis & Insights</h3>
                  <p className="text-xs text-[#64748B]">Industry-standard applicant tracking system compatibility</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#64748B] hover:text-[#111827] p-1.5 rounded-lg hover:bg-[#F5F3FF]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Category scores breakdown */}
              {scoreData?.category_scores && scoreData.category_scores.length > 0 && (
                <div>
                  <h4 className="font-bold text-[#111827] mb-2.5 uppercase tracking-wider text-[11px]">Score Breakdown by Category</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {scoreData.category_scores.map((cat, idx) => (
                      <div key={idx} className="p-3 bg-[#F6F9F8] border border-[#E5E7EB] rounded-xl">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-[#111827]">{cat.category}</span>
                          <span className={`font-bold ${cat.score >= 80 ? 'text-[#16A37B]' : cat.score >= 60 ? 'text-[#635BFF]' : 'text-amber-600'}`}>
                            {cat.score} / 100
                          </span>
                        </div>
                        <div className="w-full bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full ${
                              cat.score >= 80 ? 'bg-[#16A37B]' : cat.score >= 60 ? 'bg-[#635BFF]' : 'bg-amber-500'
                            }`}
                            style={{ width: `${cat.score}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[#64748B] leading-tight">{cat.feedback}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {scoreData?.strengths && scoreData.strengths.length > 0 && (
                <div>
                  <h4 className="font-bold text-[#16A37B] mb-1.5 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16A37B]" /> Key Strengths
                  </h4>
                  <ul className="space-y-1">
                    {scoreData.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[#111827] bg-[#ECFDF3] p-2 rounded-lg border border-[#16A37B]/20">
                        <span className="text-[#16A37B] font-bold">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improvements Needed */}
              {scoreData?.improvements_needed && scoreData.improvements_needed.length > 0 && (
                <div>
                  <h4 className="font-bold text-amber-800 mb-1.5 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Improvements Needed
                  </h4>
                  <ul className="space-y-1">
                    {scoreData.improvements_needed.map((imp, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[#111827] bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Keywords */}
              {scoreData?.missing_keywords && scoreData.missing_keywords.length > 0 && (
                <div>
                  <h4 className="font-bold text-[#111827] mb-1.5 uppercase tracking-wider text-[11px]">
                    Recommended Industry Keywords
                  </h4>
                  <p className="text-[11px] text-[#64748B] mb-1.5">
                    Consider incorporating these only if you possess actual proficiency:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {scoreData.missing_keywords.map((kw, idx) => (
                      <span key={idx} className="bg-[#F6F9F8] text-[#111827] px-2 py-0.5 rounded-md border border-[#E5E7EB] text-[11px] font-medium">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="p-3 bg-[#F6F9F8] rounded-xl border border-[#E5E7EB] flex items-start gap-2 text-[11px] text-[#64748B]">
                <Info className="w-4 h-4 text-[#64748B] shrink-0 mt-0.5" />
                <span>
                  {scoreData?.disclaimer ||
                    'The ATS score is an estimate based on standard applicant tracking algorithms and is not a hiring guarantee.'}
                </span>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#E5E7EB] bg-[#F6F9F8] flex items-center justify-between">
              {resumeId ? (
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-xs font-semibold text-[#635BFF] hover:text-[#5046E5] flex items-center gap-1"
                >
                  <span>Close Analysis</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : <div />}

              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-1.5 bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-lg text-xs font-medium shadow-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
