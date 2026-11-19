import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { ROLE_LABELS } from "@/modules/user-management/common/labels";
import { cn } from "@/core/lib/cn";

export function SidebarWorkspace({ collapsed }: { collapsed?: boolean }) {
  const { user, role } = useAuth();
  if (collapsed || !user) return null;

  const org =
    user.institution?.name ||
    (user as { organization?: { name?: string } }).organization?.name ||
    "Gen-Z Technologies";
  const mark = org.trim().charAt(0).toUpperCase() || "G";
  const roleLabel = role ? ROLE_LABELS[role] : "Member";

  return (
  <>
    <p className="cd-nav-caption" style={{ marginTop: 4 }}>
      Workspace
    </p>
    <div className={cn("cd-workspace")} title={org}>
      <div className="cd-workspace-mark" aria-hidden>
        {mark}
      </div>
      <div className="min-w-0">
        <b className="truncate block">{org}</b>
        <small>{roleLabel} workspace</small>
      </div>
    </div>
  </>
  );
}