import type { RouteObject } from "react-router-dom";

import { RequireSection } from "@/modules/user-management/auth/guards/RequireSection";
import { lazyNamed, page } from "@/shared/routing/page";

const DashboardPage = lazyNamed(() => import("./pages/DashboardPage"), "DashboardPage");

export const dashboardRoutes: RouteObject[] = [
  {
    element: <RequireSection section="dashboard" />,
    children: [{ path: "/", element: page(<DashboardPage />) }],
  },
];
