import React, { useState, useEffect } from 'react';
import { X, Edit3 } from 'lucide-react';
import { resumeApi } from '../services/resumeApi';

interface RenameResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumeId: string;
  currentName: string;
  onRenamed: (newName: string) => void;
}

export const RenameResumeModal: React.FC<RenameResumeModalProps> = ({
  isOpen,
  onClose,
  resumeId,
  currentName,
  onRenamed,
}) => {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(currentName);
    setError(null);
  }, [currentName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Resume name cannot be empty.');
      return;
    }

    try {
      setLoading(true);
      await resumeApi.renameResume(resumeId, name.trim());
      onRenamed(name.trim());
      onClose();
    } catch (err) {
      console.error('Failed to rename resume:', err);
      setError('Failed to rename resume. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-[#FFFFFF] rounded-[12px] border border-[#E5E7EB] shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#635BFF]" />
            <h3 className="text-[16px] font-semibold text-[#111827]">Rename Resume</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#64748B] hover:text-[#111827] hover:bg-[#FFFFFF]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-[20px] sm:p-[24px] space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#111827] mb-1.5" htmlFor="rename-input">
              New Resume Name
            </label>
            <input
              id="rename-input"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              className="w-full h-[44px] px-3.5 text-[14px] bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] focus:outline-none focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF] text-[#111827]"
              placeholder="e.g. Senior Frontend Resume 2026"
            />
            {error && <p className="text-[12px] text-rose-600 mt-1 font-normal">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-[12px] pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[40px] px-4 border border-[#E5E7EB] rounded-[12px] text-[14px] font-semibold text-[#111827] bg-[#FFFFFF] hover:bg-[#F8FAFC] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-[40px] px-5 rounded-[12px] text-[14px] font-semibold text-white bg-[#635BFF] hover:bg-[#5046E5] disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading ? 'Renaming...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
