import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { NotificationBell } from "@/modules/notifications/inbox/components/NotificationBell";
import { useAuth, useSignOut } from "@/modules/user-management/auth/hooks/useAuth";
import { ROLE_LABELS } from "@/modules/user-management/common/labels";
import { isJobsFocusPath } from "@/app/focusMode";
import { flowKind, mainMaxWidth } from "@/core/lib/flowRoutes";
import { AppBreadcrumb } from "@/shared/layout/AppBreadcrumb";
import { Brand } from "@/shared/layout/Brand";
import { QuickJump } from "@/shared/layout/QuickJump";
import { SideNav } from "@/shared/layout/SideNav";
import { Avatar, Icon, Menu } from "@/shared/ui";
import { cn } from "@/core/lib/cn";

export function AppLayout() {
  const { user, role } = useAuth();
  const { signOut } = useSignOut();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const jobsFocus = isJobsFocusPath(location.pathname);

  const toggleDesktopCollapsed = () => {
    setDesktopCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("lms_sidebar_collapsed", String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Keyboard shortcut Ctrl+\ to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        toggleDesktopCollapsed();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!user || !role) return null;

  const flow = flowKind(location.pathname);
  const mainWidth = mainMaxWidth(flow);

  const userFooter = (
    <div
      className={cn(
        "mt-auto border-t border-[#E8ECF4] transition-all duration-200 bg-white",
        desktopCollapsed ? "p-2" : "p-3.5",
      )}
    >
      <div
        onClick={() => navigate("/account/profile")}
        className={cn(
          "flex cursor-pointer items-center rounded-xl transition-colors hover:bg-slate-50",
          desktopCollapsed ? "h-10 w-10 justify-center mx-auto" : "gap-3 p-1.5",
        )}
        title={desktopCollapsed ? `${user.full_name} (${ROLE_LABELS[user.role]})` : undefined}
      >
        <Avatar name={user.full_name} size="sm" />
        {!desktopCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
            <p className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="lms-campus-shell app-shell min-h-screen bg-canvas lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop Clean LMS Sidebar — Exactly matching reference UI Kit */}
      <aside
        className={cn(
          "sidebar-panel hidden h-screen shrink-0 flex-col transition-all duration-200 ease-in-out lg:flex lg:sticky lg:top-0 z-20 bg-white border-r border-[#E8ECF4] overflow-hidden",
          desktopCollapsed ? "w-[72px]" : "w-[260px]",
        )}
      >
        <Brand collapsed={desktopCollapsed} />
        <SideNav
          collapsed={desktopCollapsed}
          onToggleCollapse={toggleDesktopCollapsed}
        />
        {userFooter}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-950/35"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-[284px] max-w-[85vw] flex-col rounded-r-3xl bg-white shadow-pop">
            <Brand onCloseMobile={() => setMobileOpen(false)} />
            <SideNav onItemClick={() => setMobileOpen(false)} />
            <div className="mt-auto border-t border-slate-100 p-3">
              <div onClick={() => { setMobileOpen(false); navigate("/account/profile"); }} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70 hover:bg-slate-100">
                <Avatar name={user.full_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-navy-950">{user.full_name}</p>
                  <p className="truncate text-[10.5px] text-slate-500">{ROLE_LABELS[user.role]}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shell-header sticky top-0 z-30 flex min-h-16 flex-col gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex h-10 items-center gap-3">
          <button
            type="button"
            className="-ml-1 flex h-10 w-10 items-center justify-center rounded-2xl text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Icon name="menu" size={20} />
          </button>

          <QuickJump />

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <Menu
              trigger={
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-3 rounded-2xl py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-slate-100"
                  aria-label="Account menu"
                >
                  <Avatar name={user.full_name} size="sm" />
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-semibold text-navy-950">{user.full_name}</span>
                    <span className="block text-xs text-slate-500">
                      {ROLE_LABELS[user.role]}
                      {user.institution ? ` · ${user.institution.name}` : ""}
                    </span>
                  </span>
                  <Icon name="chevronDown" size={16} className="text-slate-400" />
                </button>
              }
              items={[
                { label: "My profile", icon: "user", onSelect: () => navigate("/account/profile") },
                { label: "Security", icon: "key", onSelect: () => navigate("/account/security") },
                { label: "Sign out", icon: "logout", tone: "danger", onSelect: () => void signOut() },
              ]}
            />
          </div>
          </div>
          {!jobsFocus && <AppBreadcrumb className="hidden border-t border-slate-100/80 pt-2 lg:flex" />}
        </header>

        <main
          id="main"
          className={cn(
            "shell-main mx-auto w-full flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8",
            mainWidth,
            jobsFocus && "bg-gradient-to-b from-indigo-50/40 via-canvas to-canvas",
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
