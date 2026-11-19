import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { NAV_GROUPS, type NavItem } from "@/app/navigation";
import { useNavItems } from "@/app/useNavItems";
import { cn } from "@/core/lib/cn";
import { Icon } from "@/shared/ui";

/** The entry for the page being shown: the longest matching path, else the one in the same area. */
function activeEntry(items: NavItem[], pathname: string): NavItem | undefined {
  const matching = items.filter((i) => {
    if (i.to === "/" ? pathname === "/" : pathname === i.to || pathname.startsWith(`${i.to}/`)) return true;
    if (i.children?.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`))) return true;
    return false;
  });
  if (matching.length) return matching.reduce((a, b) => (b.to.length > a.to.length ? b : a));
  const area = pathname.split("/")[1];
  return area ? items.find((i) => i.to.split("/")[1] === area) : undefined;
}

export interface SideNavProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onItemClick?: () => void;
}

/**
 * Modern SaaS SideNav matching LMS UI Kit:
 * - Clean icon + label layout
 * - Lavender-tinted active pill container (#EAE8FF / #635BFF)
 * - Fixed bounds to strictly prevent horizontal overflow
 * - Integrated Settings and Help & Support footer links
 */
export function SideNav({
  collapsed = false,
  onToggleCollapse,
  onItemClick,
}: SideNavProps) {
  const { pathname } = useLocation();
  const items = useNavItems();
  const displayItems = items;
  const active = activeEntry(displayItems, pathname);

  const [expandedSubmenus, setExpandedSubmenus] = useState<Record<string, boolean>>({});

  // Keep the submenu open for the active route
  useEffect(() => {
    setExpandedSubmenus((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of displayItems) {
        const open =
          item.children?.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`)) ||
          pathname === item.to ||
          pathname.startsWith(`${item.to}/`);
        if (open && !next[item.to]) {
          next[item.to] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, displayItems]);

  const toggleSubmenu = (to: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setExpandedSubmenus((prev) => ({ ...prev, [to]: !prev[to] }));
  };

  const isSettingsActive = pathname.startsWith("/account");
  const isSupportActive = pathname.startsWith("/support");

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Primary Navigation List */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-3 [scrollbar-color:var(--color-slate-200)_transparent] [scrollbar-width:thin]",
          collapsed ? "px-2 space-y-1.5" : "px-3.5 space-y-1",
        )}
        aria-label="Main Navigation"
      >
        {NAV_GROUPS.map((group) => {
          const entries = displayItems.filter((i) => i.group === group.key);
          if (entries.length === 0) return null;

          return (
            <ul key={group.key} className="space-y-1">
              {entries.map((item) => {
                const isActive = item === active;
                const hasChildren = Boolean(item.children && item.children.length > 0);
                const isSubmenuOpen = Boolean(expandedSubmenus[item.to]);

                return (
                  <li key={item.to} className="relative group/navitem">
                    <div className={cn("flex items-center", collapsed && "justify-center")}>
                      <Link
                        to={item.to}
                        onClick={() => {
                          if (hasChildren && !collapsed) {
                            setExpandedSubmenus((prev) => ({
                              ...prev,
                              [item.to]: isActive ? !prev[item.to] : true,
                            }));
                          }
                          onItemClick?.();
                        }}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "relative flex items-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF]",
                          collapsed
                            ? "h-10 w-10 shrink-0 justify-center mx-auto rounded-xl"
                            : "flex-1 gap-3.5 px-3.5 py-2.5 rounded-xl text-[14px] font-medium",
                          isActive
                            ? "bg-[#EAE8FF] font-semibold text-[#635BFF] shadow-xs"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon
                          name={item.icon}
                          size={collapsed ? 20 : 19}
                          className={cn(
                            "shrink-0 transition-colors",
                            isActive
                              ? "text-[#635BFF]"
                              : "text-slate-400 group-hover/navitem:text-slate-700",
                          )}
                        />

                        {!collapsed && (
                          <span className="truncate flex-1">
                            {item.label}
                          </span>
                        )}
                      </Link>

                      {/* Submenu toggle button when expanded */}
                      {!collapsed && hasChildren && (
                        <button
                          type="button"
                          onClick={(e) => toggleSubmenu(item.to, e)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer ml-1"
                          aria-label={`Toggle ${item.label} submenu`}
                        >
                          <Icon
                            name={isSubmenuOpen ? "chevronDown" : "chevronRight"}
                            size={14}
                          />
                        </button>
                      )}
                    </div>

                    {/* Expanded Mode: Nested Submenu */}
                    {!collapsed && hasChildren && isSubmenuOpen && item.children && (
                      <ul className="ml-7 mt-1 space-y-0.5 border-l-2 border-slate-200/80 pl-2">
                        {item.children.map((child) => {
                          const isChildActive = pathname === child.to || (child.to !== item.to && pathname.startsWith(`${child.to}/`));
                          return (
                            <li key={child.to}>
                              <Link
                                to={child.to}
                                onClick={onItemClick}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                                  isChildActive
                                    ? "bg-[#EAE8FF]/70 font-semibold text-[#635BFF]"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-950 font-medium",
                                )}
                              >
                                {child.icon && (
                                  <Icon
                                    name={child.icon}
                                    size={13}
                                    className={cn(
                                      "shrink-0",
                                      isChildActive ? "text-[#635BFF]" : "text-slate-400",
                                    )}
                                  />
                                )}
                                <span className="truncate flex-1">{child.label}</span>
                                {typeof child.badge === "number" && child.badge > 0 ? (
                                  <span className="ml-auto shrink-0 rounded-full bg-[#635BFF] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                                    {child.badge > 99 ? "99+" : child.badge}
                                  </span>
                                ) : null}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Collapsed Mode Floating Tooltip */}
                    {collapsed && (
                      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 hidden rounded-xl bg-white border border-slate-200 px-3 py-2 shadow-pop group-hover/navitem:flex flex-col gap-0.5 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-900">{item.label}</span>
                        {item.hint && <span className="text-[11px] text-slate-500">{item.hint}</span>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          );
        })}
      </nav>

      {/* Secondary Bottom Links: Settings & Help (Matching LMS UI Kit Reference) */}
      <div className={cn("mt-auto border-t border-[#E8ECF4] pt-2 pb-1", collapsed ? "px-2" : "px-3.5")}>
        <ul className="space-y-1">
          <li className="relative group/navitem">
            <div className={cn("flex items-center", collapsed && "justify-center")}>
              <Link
                to="/account/profile"
                onClick={onItemClick}
                className={cn(
                  "flex items-center transition-all duration-150",
                  collapsed
                    ? "h-10 w-10 shrink-0 justify-center mx-auto rounded-xl"
                    : "flex-1 gap-3.5 px-3.5 py-2.5 rounded-xl text-[14px] font-medium",
                  isSettingsActive
                    ? "bg-[#EAE8FF] font-semibold text-[#635BFF] shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                )}
                title={collapsed ? "Settings" : undefined}
              >
                <Icon
                  name="settings"
                  size={collapsed ? 20 : 19}
                  className={cn(
                    "shrink-0 transition-colors",
                    isSettingsActive ? "text-[#635BFF]" : "text-slate-400 group-hover/navitem:text-slate-700",
                  )}
                />
                {!collapsed && <span className="truncate flex-1">Settings</span>}
              </Link>
            </div>
            {collapsed && (
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 hidden rounded-xl bg-white border border-slate-200 px-3 py-1.5 shadow-pop group-hover/navitem:block whitespace-nowrap text-xs font-bold text-slate-900">
                Settings
              </div>
            )}
          </li>

          <li className="relative group/navitem">
            <div className={cn("flex items-center", collapsed && "justify-center")}>
              <Link
                to="/support"
                onClick={onItemClick}
                className={cn(
                  "flex items-center transition-all duration-150",
                  collapsed
                    ? "h-10 w-10 shrink-0 justify-center mx-auto rounded-xl"
                    : "flex-1 gap-3.5 px-3.5 py-2.5 rounded-xl text-[14px] font-medium",
                  isSupportActive
                    ? "bg-[#EAE8FF] font-semibold text-[#635BFF] shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                )}
                title={collapsed ? "Help & Support" : undefined}
              >
                <Icon
                  name="helpCircle"
                  size={collapsed ? 20 : 19}
                  className={cn(
                    "shrink-0 transition-colors",
                    isSupportActive ? "text-[#635BFF]" : "text-slate-400 group-hover/navitem:text-slate-700",
                  )}
                />
                {!collapsed && <span className="truncate flex-1">Help & Support</span>}
              </Link>
            </div>
            {collapsed && (
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 hidden rounded-xl bg-white border border-slate-200 px-3 py-1.5 shadow-pop group-hover/navitem:block whitespace-nowrap text-xs font-bold text-slate-900">
                Help & Support
              </div>
            )}
          </li>
        </ul>

        {/* Minimal Desktop Collapse/Expand Toggle Button */}
        {onToggleCollapse && (
          <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-end">
            <button
              type="button"
              onClick={onToggleCollapse}
              className={cn(
                "flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer text-xs font-medium",
                collapsed ? "h-8 w-8 mx-auto" : "h-7 px-2.5 gap-2 ml-auto",
              )}
              title={collapsed ? "Expand sidebar (Ctrl+\\)" : "Collapse sidebar (Ctrl+\\)"}
            >
              <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={14} />
              {!collapsed && <span className="text-[11px] text-slate-400 font-normal">Collapse</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
