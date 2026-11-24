import React, { useState } from 'react';
import { Sparkles, RefreshCw, Wand2 } from 'lucide-react';
import { aiApi } from '../../services/aiApi';
import { AISuggestionModal } from '../AISuggestionModal';

interface Props {
  summary: string;
  resumeId: string;
  targetRole: string;
  onChange: (newSummary: string) => void;
}

export const SummarySection: React.FC<Props> = ({ summary, resumeId, targetRole, onChange }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');

  const handleGenerateAI = async (tone?: string) => {
    setIsGenerating(true);
    try {
      if (tone && summary) {
        const res = await aiApi.improveText(
          resumeId,
          summary,
          tone as any,
          targetRole
        );
        setAiSuggestion(res.suggestion);
      } else {
        const res = await aiApi.generateSummary(resumeId, targetRole);
        setAiSuggestion(res.suggestion);
      }
      setModalOpen(true);
    } catch (err) {
      console.error('Error generating summary:', err);
      // Fallback
      setAiSuggestion(
        `Results-driven ${targetRole} with strong foundational expertise in full-stack architecture, clean coding practices, and technical innovation. Proven track record of delivering resilient software solutions while actively collaborating across modern engineering teams.`
      );
      setModalOpen(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAcceptSuggestion = async (appliedText: string) => {
    onChange(appliedText);
    setModalOpen(false);
    try {
      await aiApi.recordAction(resumeId, 'summary_accept', summary, appliedText, true);
    } catch {}
  };

  const handleReject = async () => {
    setModalOpen(false);
    try {
      await aiApi.recordAction(resumeId, 'summary_reject', summary, aiSuggestion, false);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Professional Summary</h3>
          <p className="text-xs text-[#64748B]">
            A concise 3-4 sentence overview of your technical background and career target.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleGenerateAI()}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-xl shadow-sm shadow-[#635BFF]/20 transition-all disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Generate with AI</span>
            </>
          )}
        </button>
      </div>

      <div>
        <textarea
          rows={5}
          value={summary || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`e.g. Dedicated ${targetRole} with a strong foundation in modern software development...`}
          className="w-full p-3.5 text-xs rounded-xl border border-[#E5E7EB] focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]/20 outline-none resize-y leading-relaxed text-[#111827]"
        />
        <div className="flex items-center justify-between mt-1 text-[11px] text-[#64748B]">
          <span>{summary ? summary.split(/\s+/).filter(Boolean).length : 0} words</span>
          <span>Recommended: 30–60 words</span>
        </div>
      </div>

      {/* Quick AI Improvement Chips */}
      {summary && summary.trim().length > 15 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-medium text-[#64748B] flex items-center gap-1">
            <Wand2 className="w-3 h-3 text-[#635BFF]" /> AI Adjust:
          </span>
          <button
            onClick={() => handleGenerateAI('shorten')}
            disabled={isGenerating}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E5E7EB] hover:border-[#635BFF]/40 hover:bg-[#F5F3FF] text-[#64748B] hover:text-[#635BFF] transition-colors"
          >
            Shorten
          </button>
          <button
            onClick={() => handleGenerateAI('more_professional')}
            disabled={isGenerating}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E5E7EB] hover:border-[#635BFF]/40 hover:bg-[#F5F3FF] text-[#64748B] hover:text-[#635BFF] transition-colors"
          >
            Make More Professional
          </button>
          <button
            onClick={() => handleGenerateAI('more_technical')}
            disabled={isGenerating}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E5E7EB] hover:border-[#635BFF]/40 hover:bg-[#F5F3FF] text-[#64748B] hover:text-[#635BFF] transition-colors"
          >
            Make More Technical
          </button>
        </div>
      )}

      {/* Side-by-Side Review Modal */}
      <AISuggestionModal
        isOpen={modalOpen}
        title="AI Professional Summary"
        originalText={summary}
        suggestionText={aiSuggestion}
        isLoading={isGenerating}
        onAccept={handleAcceptSuggestion}
        onReject={handleReject}
        onRegenerate={(tone) => handleGenerateAI(tone)}
      />
    </div>
  );
};
