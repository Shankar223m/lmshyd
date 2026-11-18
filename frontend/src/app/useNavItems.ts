import { useMemo } from "react";

import { NAVIGATION, STUDENT_NAVIGATION, type NavItem } from "@/app/navigation";
import { isNavItemEnabled } from "@/app/navPolicy";
import { sidebarItemsForRole } from "@/app/sidebarByRole";
import {
  getRoleNavigationBase,
  navigationBaseForRole,
  stripDisabledProductMenus,
} from "@/app/roleNavigation";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";
import type { Role } from "@/modules/user-management/common/types";

function filterByPermissions(
  items: NavItem[],
  role: Role | undefined,
  can: (section: Parameters<ReturnType<typeof usePermissions>["can"]>[0]) => boolean,
  canOpen: (menu: Parameters<ReturnType<typeof usePermissions>["canOpen"]>[0]) => boolean,
  viewRoles: string[],
  skipPermissionCheck: boolean,
): NavItem[] {
  return items.filter((i) => {
    if (!isNavItemEnabled(i, role)) return false;
    if (i.viewRole) return viewRoles.includes(i.viewRole);
    if (skipPermissionCheck) return true;
    return i.menu ? canOpen(i.menu) : can(i.section);
  });
}

const AREA_TAB_SCREENS: Record<string, string[]> = {
  "User management": ["/admins", "/institutions", "/institution-heads", "/staff", "/students"],
};

function useVisibleNavItems(): NavItem[] {
  const { user } = useAuth();
  const { can, canOpen, permissions } = usePermissions();
  const { users } = permissions;
  const role = user?.role;

  return useMemo(() => {
    const jobsModerator =
      role === "super_admin" || (role === "admin" && (permissions.scopes ?? []).includes("careers.manage"));
    const fromRole = sidebarItemsForRole(role as Role | undefined, { jobsModerator });
    const kind = navigationBaseForRole(role);
    const base = stripDisabledProductMenus(
      fromRole ?? getRoleNavigationBase(kind, STUDENT_NAVIGATION, NAVIGATION),
    );
    const isSuperAdmin = role === "super_admin";

    return filterByPermissions(base, role, can, canOpen, users.view_roles, isSuperAdmin);
  }, [role, permissions.menu, permissions.sections, permissions.scopes, users.view_roles, can, canOpen]);
}

/** Sidebar entries for the signed-in person: role-appropriate list, then server permissions. */
export function useNavItems(): NavItem[] {
  return useVisibleNavItems();
}

/** Top-of-page tabs for a folded area (e.g. User management people screens). */
export function useAreaScreens(label: string): NavItem[] {
  const routes = AREA_TAB_SCREENS[label];
  const visible = useVisibleNavItems();
  return useMemo(() => {
    if (!routes?.length) return [];
    return routes.map((to) => visible.find((i) => i.to === to)).filter((i): i is NavItem => Boolean(i));
  }, [routes, visible]);
}
