import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";

import { RequireSection } from "@/modules/user-management/auth/guards/RequireSection";
import { languageRoutes } from "@/modules/code-execution/languages/routes";
import { runRoutes } from "@/modules/code-execution/runs/routes";

/**
 * Online compiler available for all roles.
 * Problems and submissions routes redirect directly to the online compiler.
 */
export const codeExecutionModuleRoutes: RouteObject[] = [
  {
    element: <RequireSection section="code_execution" />,
    children: [
      ...runRoutes,
      { path: "/problems", element: <Navigate to="/compiler" replace /> },
      { path: "/problems/*", element: <Navigate to="/compiler" replace /> },
      { path: "/submissions", element: <Navigate to="/compiler" replace /> },
      { path: "/submissions/*", element: <Navigate to="/compiler" replace /> },
      { path: "/review/submissions", element: <Navigate to="/compiler" replace /> },
      { path: "/review/submissions/*", element: <Navigate to="/compiler" replace /> },
      ...languageRoutes,
    ],
  },
];
