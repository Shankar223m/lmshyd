import React, { useState } from 'react';
import { Sparkles, Check, X, RefreshCw, Edit3, ShieldAlert } from 'lucide-react';

interface AISuggestionModalProps {
  isOpen: boolean;
  title: string;
  originalText: string;
  suggestionText: string;
  isLoading?: boolean;
  onAccept: (appliedText: string) => void;
  onReject: () => void;
  onRegenerate: (tone?: string) => void;
}

export const AISuggestionModal: React.FC<AISuggestionModalProps> = ({
  isOpen,
  title,
  originalText,
  suggestionText,
  isLoading = false,
  onAccept,
  onReject,
  onRegenerate,
}) => {
  const [editableText, setEditableText] = useState(suggestionText);
  const [isEditing, setIsEditing] = useState(false);

  React.useEffect(() => {
    setEditableText(suggestionText);
    setIsEditing(false);
  }, [suggestionText]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-[#E5E7EB] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-gradient-to-r from-[#F5F3FF] to-[#EDE9FE]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#635BFF] flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-[#111827] text-base">{title}</h3>
              <p className="text-xs text-[#64748B]">Review, tweak, or accept AI suggestions before applying to your resume.</p>
            </div>
          </div>
          <button
            onClick={onReject}
            className="text-[#64748B] hover:text-[#111827] p-1.5 rounded-lg hover:bg-[#F5F3FF] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Side-by-Side */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Original Content</span>
                <span className="text-[11px] text-[#64748B]">Current in resume</span>
              </div>
              <div className="p-4 bg-[#F6F9F8] border border-[#E5E7EB] rounded-xl text-xs leading-relaxed text-[#111827] min-h-[160px] whitespace-pre-wrap">
                {originalText || <span className="italic text-[#64748B]">Empty section</span>}
              </div>
            </div>

            {/* AI Suggestion */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#635BFF] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#635BFF]" /> AI Suggestion
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-[11px] text-[#64748B] hover:text-[#635BFF] flex items-center gap-1 transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{isEditing ? 'Preview' : 'Edit text'}</span>
                </button>
              </div>

              {isLoading ? (
                <div className="p-4 bg-[#F5F3FF] border border-[#635BFF]/30 rounded-xl text-xs min-h-[160px] flex flex-col items-center justify-center text-[#635BFF] gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Optimizing content with AI...</span>
                </div>
              ) : isEditing ? (
                <textarea
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  className="w-full p-4 bg-white border-2 border-[#635BFF] focus:border-[#5046E5] focus:ring-0 rounded-xl text-xs leading-relaxed text-[#111827] min-h-[160px] resize-none outline-none font-sans"
                />
              ) : (
                <div className="p-4 bg-[#F5F3FF]/60 border border-[#635BFF]/30 rounded-xl text-xs leading-relaxed text-[#111827] min-h-[160px] whitespace-pre-wrap">
                  {editableText}
                </div>
              )}
            </div>
          </div>

          {/* Tone Quick-Tuning Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E7EB]">
            <span className="text-xs font-medium text-[#64748B] mr-1">Fine-tune tone:</span>
            {[
              { id: 'shorten', label: 'Shorten' },
              { id: 'more_professional', label: 'Make More Professional' },
              { id: 'more_technical', label: 'Make More Technical' },
              { id: 'improve', label: 'Standard Improvement' },
            ].map((tone) => (
              <button
                key={tone.id}
                onClick={() => onRegenerate(tone.id)}
                disabled={isLoading}
                className="text-xs px-2.5 py-1 rounded-lg border border-[#E5E7EB] hover:border-[#635BFF] hover:bg-[#F5F3FF] text-[#64748B] hover:text-[#635BFF] transition-colors disabled:opacity-50"
              >
                {tone.label}
              </button>
            ))}
          </div>

          {/* Integrity disclaimer */}
          <div className="flex items-center gap-2 text-[11px] text-[#64748B] bg-[#F6F9F8] p-2.5 rounded-lg border border-[#E5E7EB]">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>Integrity Guard Active:</strong> AI will never fabricate companies, degrees, certifications, or metrics that you haven't provided.
            </span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-3.5 border-t border-[#E5E7EB] bg-[#F6F9F8] flex items-center justify-between">
          <button
            onClick={() => onRegenerate()}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#111827] px-3 py-2 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onReject}
              className="text-xs font-medium text-[#64748B] hover:text-[#111827] px-4 py-2 rounded-lg hover:bg-white transition-colors"
            >
              Reject & Keep Original
            </button>
            <button
              onClick={() => onAccept(editableText)}
              disabled={isLoading || !editableText.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#635BFF] hover:bg-[#5046E5] text-white px-5 py-2 rounded-lg shadow-sm shadow-[#635BFF]/20 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Accept & Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
