import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertCircle, RefreshCw, X } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [open]);

  // Autofocus Cancel button on open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Keyboard accessibility: Escape to cancel, Tab focus trap
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement && lastElement) {
            e.preventDefault();
            (lastElement as HTMLElement).focus();
          }
        } else {
          if (document.activeElement === lastElement && firstElement) {
            e.preventDefault();
            (firstElement as HTMLElement).focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onCancel]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) {
      onCancel();
    }
  };

  const isDanger = variant === 'danger';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-200 animate-fadeIn"
      onClick={handleBackdropClick}
      aria-hidden={!open}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="bg-[#FFFFFF] rounded-[12px] p-[20px] sm:p-[24px] border border-[#E5E7EB] shadow-2xl max-w-[420px] w-full text-center relative transform transition-all duration-200 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close X button */}
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute right-4 top-4 p-1.5 rounded-[8px] text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC] transition-colors disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div
          className={`w-12 h-12 rounded-[12px] flex items-center justify-center mx-auto mb-4 border transition-transform ${
            isDanger
              ? 'bg-rose-50 text-rose-600 border-rose-200/80 shadow-xs'
              : 'bg-[#F5F3FF] text-[#635BFF] border-purple-200/80 shadow-xs'
          }`}
        >
          {isDanger ? (
            <Trash2 className="w-6 h-6 stroke-[1.8]" />
          ) : (
            <AlertCircle className="w-6 h-6 stroke-[1.8]" />
          )}
        </div>

        {/* Title */}
        <h3
          id="confirm-dialog-title"
          className="text-[16px] font-semibold text-[#111827] tracking-tight"
        >
          {title}
        </h3>

        {/* Message */}
        <p
          id="confirm-dialog-desc"
          className="text-[14px] font-normal text-[#64748B] mt-2 leading-relaxed"
        >
          {message}
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-[12px]">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-[40px] px-4 rounded-[12px] border border-[#E5E7EB] hover:bg-[#F8FAFC] text-[#111827] text-[14px] font-semibold transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 h-[40px] px-4 rounded-[12px] text-white text-[14px] font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-xs ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#635BFF] hover:bg-[#5046E5]'
            }`}
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{loading ? 'Deleting...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
