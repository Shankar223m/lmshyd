import type { MenuKey } from "@/modules/user-management/common/permissions/types";
import type { NavItem } from "@/app/navigation";
import { isMenuAllowedForRole, isSectionAllowedForRole } from "@/app/roleNavPolicy";
import { PAYMENTS_ENABLED } from "@/core/config/features";
import type { Role } from "@/modules/user-management/common/types";

/** Menu keys backed by routes in `router.tsx` (career module is not mounted). */
export const HIDDEN_NAV_MENUS = new Set<MenuKey>([
  "career",
  "proctoring",
  "my_integrity_cases",
  ...(PAYMENTS_ENABLED ? [] : (["billing", "store"] as MenuKey[])),
]);

/** Legacy modules kept for reference; routes are not mounted in router.tsx. */
export const DEPRECATED_MODULES = ["proctoring", "job-portal", "career"] as const;

export function isNavItemEnabled(item: NavItem, role: Role | string | undefined): boolean {
  if (item.menu && HIDDEN_NAV_MENUS.has(item.menu)) return false;
  if (item.menu && !isMenuAllowedForRole(role, item.menu)) return false;
  if (item.section && !isSectionAllowedForRole(role, item.section)) return false;
  return true;
}
