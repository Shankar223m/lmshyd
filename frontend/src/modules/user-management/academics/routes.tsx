import type { RouteObject } from "react-router-dom";

import { RequireSection } from "@/modules/user-management/auth/guards/RequireSection";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { lazyNamed, page } from "@/shared/routing/page";

const AcademicsPage = lazyNamed(() => import("./pages/AcademicsPage"), "AcademicsPage");
const ResultsPage = lazyNamed(() => import("./pages/ResultsPage"), "ResultsPage");
const StudentResultsPage = lazyNamed(() => import("@/modules/assessments/attempts/pages/StudentResultsPage"), "StudentResultsPage");
const StudentProgressPage = lazyNamed(() => import("./pages/StudentProgressPage"), "StudentProgressPage");
const AcademicsOutcomesPage = lazyNamed(() => import("./pages/AcademicsOutcomesPage"), "AcademicsOutcomesPage");

function ResultsRouter() {
  const { user } = useAuth();
  if (user?.role === "student") {
    return <StudentResultsPage />;
  }
  return <ResultsPage />;
}

export const academicsRoutes: RouteObject[] = [
  { path: "/results", element: page(<ResultsRouter />) },
  {
    element: <RequireSection section="academics" />,
    children: [
      { path: "/academics", element: page(<AcademicsPage />) },
      { path: "/academics/outcomes", element: page(<AcademicsOutcomesPage />) },
      { path: "/academics/student-progress", element: page(<StudentProgressPage />) },
    ],
  },
];
