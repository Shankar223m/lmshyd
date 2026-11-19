import type { ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Above app chrome (EmployerActionModal should be the only full-screen overlay). */
  priority?: "detail" | "confirm";
};

/** Single overlay for employer pipeline actions — avoids stacked modals blocking clicks. */
export function EmployerActionModal({ open, title, onClose, children, priority = "detail" }: Props) {
  if (!open) return null;

  const z = priority === "confirm" ? "z-[100]" : "z-[90]";

  return (
    <div
      className={`fixed inset-0 ${z} flex items-center justify-center p-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="employer-action-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <h2 id="employer-action-modal-title" className="text-lg font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}