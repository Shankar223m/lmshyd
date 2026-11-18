import { cn } from "@/core/lib/cn";
import { Icon } from "@/shared/ui";
import { LogoMark } from "./LogoMark";

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
        "flex h-16 items-center border-b border-slate-100 transition-all duration-200",
        collapsed ? "justify-center px-2" : "justify-between px-4 sm:px-5",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0EFFF] ring-1 ring-[#D6D3FF]/60 shadow-xs">
          <LogoMark className="h-5 w-5" />
        </span>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="font-display truncate text-base font-bold text-slate-900 tracking-tight">LMS</p>
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
