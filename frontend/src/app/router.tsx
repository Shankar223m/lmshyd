import { createBrowserRouter } from "react-router-dom";

import { RouteError } from "@/shared/routing/RouteError";

import { billingModuleRoutes } from "@/modules/billing/routes";
import { analyticsModuleRoutes } from "@/modules/analytics/routes";
import { notificationsModuleRoutes } from "@/modules/notifications/routes";
import { aiInterviewModuleRoutes } from "@/modules/ai-interview/routes";
import { aiSettingsModuleRoutes } from "@/modules/ai-settings/routes";
import { aiTutorModuleRoutes } from "@/modules/ai-tutor/routes";
import { assessmentsModuleRoutes } from "@/modules/assessments/routes";
// Career résumés module retired — student career profile lives under Jobs & placements.
import { catalogRoutes } from "@/modules/catalog/routes";
import { mediaRoutes } from "@/modules/media/routes";
import { storeRoutes } from "@/modules/store/routes";
import { certificatesModuleRoutes } from "@/modules/certificates/routes";
import { codeExecutionModuleRoutes } from "@/modules/code-execution/routes";
import { dashboardRoutes } from "@/modules/dashboard/routes";
import { jobsModuleRoutes } from "@/modules/jobs/routes";
import { learningModuleRoutes } from "@/modules/learning/routes";
import { supportModuleRoutes } from "@/modules/support/routes";
import { subscriptionsModuleRoutes } from "@/modules/subscriptions/routes";
import { RequireAuth } from "@/modules/user-management/auth/guards/RequireAuth";
import { userManagementRoutes } from "@/modules/user-management/routes";
import { AppLayout } from "@/shared/layout/AppLayout";
import { AuthLayout } from "@/shared/layout/AuthLayout";
import { NotFoundPage } from "@/shared/pages/NotFoundPage";

/**
 * The app router only composes module routes. To add a module (catalog, learning, ...),
 * create `modules/<name>/routes.tsx` and spread it into the right group below.
 */
export const router = createBrowserRouter([
  // one friendly error page for every route (and a self-reload when a newer release is out)
  {
    errorElement: <RouteError />,
    children: [
    { element: <AuthLayout />, children: [...userManagementRoutes.public] },
    // Public pages that also work while signed in (no PublicOnly redirect).
    { element: <AuthLayout />, children: [...certificatesModuleRoutes.public] },
    {
      element: <RequireAuth />,
      children: [
        ...userManagementRoutes.setup,
        {
          element: <AppLayout />,
          children: [
            ...dashboardRoutes,
            ...userManagementRoutes.app,
            ...catalogRoutes,
            ...mediaRoutes,
            ...storeRoutes,
            ...subscriptionsModuleRoutes,
            ...learningModuleRoutes,
            ...codeExecutionModuleRoutes,
            ...assessmentsModuleRoutes,
            ...certificatesModuleRoutes.app,
            ...aiTutorModuleRoutes,
            ...aiSettingsModuleRoutes,
            ...supportModuleRoutes,
            ...jobsModuleRoutes,
            ...aiInterviewModuleRoutes,
            ...notificationsModuleRoutes,
            ...analyticsModuleRoutes,
            ...billingModuleRoutes,
            { path: "*", element: <NotFoundPage /> },
          ],
        },
      ],
    },
    ],
  },
]);
