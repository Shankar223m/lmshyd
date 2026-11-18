import { NavLink } from "react-router-dom";

import { useAreaScreens } from "@/app/useNavItems";
import { cn } from "@/core/lib/cn";

/** The toggle options at the top of every User management page: Super admin users, Admins, Institutions, Heads, Staff, Students. */
export function UserManagementTabs() {
  const tabs = useAreaScreens("User management");
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="User management" className="mb-5 flex w-fit max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-card">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              "whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors",
              isActive ? "bg-brand-700 text-white shadow-brand" : "text-slate-600 hover:bg-slate-100 hover:text-navy-950",
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
