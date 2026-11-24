import React, { useState } from 'react';
import { AIReviewCard } from '../types';
import { Sparkles, CheckCircle2, AlertTriangle, Lightbulb, RefreshCw, ArrowRight } from 'lucide-react';
import { aiApi } from '../services/aiApi';

interface Props {
  resumeId: string;
  onNavigateSection: (sectionId: string) => void;
}

export const AIReviewPanel: React.FC<Props> = ({ resumeId, onNavigateSection }) => {
  const [reviews, setReviews] = useState<AIReviewCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const handleRunReview = async () => {
    setIsLoading(true);
    try {
      const res = await aiApi.reviewResume(resumeId);
      setReviews(res.reviews);
      setHasRun(true);
    } catch (err) {
      console.error('Failed to run resume review:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">AI Resume Review</h3>
          <p className="text-xs text-slate-500">Thorough audit across grammar, ATS keywords, clarity, and completeness.</p>
        </div>

        <button
          type="button"
          onClick={handleRunReview}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-xl shadow-sm shadow-[#635BFF]/20 transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Auditing...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Review My Resume</span>
            </>
          )}
        </button>
      </div>

      {!hasRun && !isLoading && (
        <div className="p-8 text-center border-2 border-dashed border-[#E5E7EB] rounded-2xl space-y-2 bg-white">
          <Sparkles className="w-8 h-8 text-[#635BFF] mx-auto" />
          <h4 className="font-bold text-sm text-[#111827]">Get Instant AI Feedback</h4>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            Click "Review My Resume" to scan your summary, project descriptions, skills match, and ATS formatting for actionable recommendations.
          </p>
          <button
            type="button"
            onClick={handleRunReview}
            className="mt-2 px-4 py-2 bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-xl font-semibold text-xs shadow-sm shadow-[#635BFF]/20"
          >
            Start Full Resume Audit
          </button>
        </div>
      )}

      {isLoading && (
        <div className="py-12 text-center text-xs text-[#64748B] space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#635BFF] mx-auto" />
          <p>Analyzing resume sections against ATS benchmarks and industry standards...</p>
        </div>
      )}

      {hasRun && !isLoading && (
        <div className="space-y-3">
          {reviews.map((rev, idx) => {
            const isWarning = rev.type === 'warning';
            const isSuccess = rev.type === 'success';

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border text-xs transition-all ${
                  isSuccess
                    ? 'bg-[#ECFDF3] border-[#16A37B]/20'
                    : isWarning
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-[#F5F3FF] border-[#635BFF]/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {isSuccess ? (
                      <CheckCircle2 className="w-4 h-4 text-[#16A37B] shrink-0 mt-0.5" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <Lightbulb className="w-4 h-4 text-[#635BFF] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[#111827] text-xs">{rev.section}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                            isSuccess
                              ? 'bg-[#16A37B]/10 text-[#16A37B]'
                              : isWarning
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-[#EDE9FE] text-[#635BFF]'
                          }`}
                        >
                          {rev.type}
                        </span>
                      </div>
                      <p className="text-[#111827] leading-relaxed text-xs">{rev.recommendation}</p>
                    </div>
                  </div>

                  {rev.action_label && !isSuccess && (
                    <button
                      type="button"
                      onClick={() => onNavigateSection(rev.action_type)}
                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#F5F3FF] border border-[#E5E7EB] text-[#111827] rounded-lg font-semibold text-xs shadow-sm transition-all hover:border-[#635BFF] hover:text-[#635BFF]"
                    >
                      <span>{rev.action_label}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
