import { cn } from "@/core/lib/cn";
import { Icon } from "@/shared/ui";

export function Brand({
  collapsed = false,
  onCloseMobile,
}: {
  collapsed?: boolean;
  onCloseMobile?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-[68px] shrink-0 items-center border-b border-[#E8ECF4] transition-all duration-200",
        collapsed ? "justify-center px-2" : "justify-between px-5",
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#635BFF] to-[#4F46E5] text-white shadow-xs">
          <Icon name="graduation" size={20} className="text-white" />
        </span>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="font-display truncate text-xl font-bold text-slate-900 tracking-tight" style={{ letterSpacing: "-0.03em" }}>
              LMS
            </p>
          </div>
        )}
      </div>

      {onCloseMobile && (
        <button
          type="button"
          onClick={onCloseMobile}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-950 cursor-pointer lg:hidden"
          aria-label="Close navigation"
        >
          <Icon name="x" size={18} />
        </button>
      )}
    </div>
  );
}
