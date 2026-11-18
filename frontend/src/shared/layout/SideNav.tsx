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
 * Enhanced Modular SideNav:
 * - Flat list of role items (group keys only control sort order)
 * - Accordion expand/collapse per item with children
 * - Multi-level sub-navigation support (e.g. AI Resume Builder, Jobs)
 * - Real-time navigation search filter
 * - Collapsible desktop icon-only mode with floating tooltips
 * - Light surface; the active item uses the logo green, text the logo navy
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

  // Keep the submenu open for the active route (without re-rendering forever when `items` is re-created).
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

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Navigation List */}
      <nav
        className={cn(
          "flex-1 space-y-4 overflow-y-auto px-2.5 py-4 [scrollbar-color:var(--color-slate-300)_transparent] [scrollbar-width:thin]",
          collapsed && "px-2 py-3 space-y-3",
        )}
        aria-label="Main Navigation"
      >
        {NAV_GROUPS.map((group) => {
          const entries = displayItems.filter((i) => i.group === group.key);
          if (entries.length === 0) return null;

          return (
            <ul key={group.key} className="space-y-0.5">
                  {entries.map((item) => {
                    const isActive = item === active;
                    const hasChildren = Boolean(item.children && item.children.length > 0);
                    const isSubmenuOpen = Boolean(expandedSubmenus[item.to]);

                    return (
                      <li key={item.to} className="relative group/navitem">
                        <div className="flex items-center">
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
                              "relative flex flex-1 items-center rounded-2xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                              collapsed
                                ? "h-11 w-11 justify-center mx-auto"
                                : "gap-3 px-3 py-2.5",
                              isActive
                                ? "bg-[#EAE8FF] font-semibold text-[#635BFF] shadow-xs ring-1 ring-[#D6D3FF]/60"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                            )}
                          >
                            <Icon
                              name={item.icon}
                              size={collapsed ? 20 : 18}
                              className={cn(
                                "shrink-0 transition-colors",
                                isActive
                                  ? "text-[#635BFF]"
                                  : "text-slate-400 transition-colors group-hover/navitem:text-slate-700",
                              )}
                            />

                            {!collapsed && (
                              <span className="truncate text-xs sm:text-sm font-medium flex-1">
                                {item.label}
                              </span>
                            )}
                          </Link>

                          {/* Submenu toggle button when expanded */}
                          {!collapsed && hasChildren && (
                            <button
                              type="button"
                              onClick={(e) => toggleSubmenu(item.to, e)}
                              className="p-2 text-slate-400 hover:text-navy-900 rounded-lg transition-colors cursor-pointer"
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
                          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 hidden rounded-xl bg-white border border-slate-200 px-3 py-2 shadow-pop group-hover/navitem:flex flex-col gap-1 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-navy-950">{item.label}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-normal">{item.hint}</span>

                            {hasChildren && item.children && (
                              <div className="mt-1 border-t border-slate-100 pt-1 flex flex-col gap-0.5">
                                {item.children.map((child) => (
                                  <span key={child.to} className="text-[11px] text-slate-600 font-medium">
                                    • {child.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
            </ul>
          );
        })}
      </nav>

      {/* Bottom Desktop Collapse/Expand Toggle Button */}
      {onToggleCollapse && (
        <div className="hidden lg:block border-t border-slate-100 p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "flex items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-navy-900 transition-colors cursor-pointer text-xs font-medium w-full",
              collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2",
            )}
            title={collapsed ? "Expand sidebar (Ctrl+\\)" : "Collapse sidebar (Ctrl+\\)"}
          >
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={16} />
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      )}
    </div>
  );
}
