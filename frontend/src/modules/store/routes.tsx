import { Navigate, useParams, type RouteObject } from "react-router-dom";

import { RequireSection } from "@/modules/user-management/auth/guards/RequireSection";
import { RequireLearnerCatalog } from "@/modules/store/guards/RequireLearnerCatalog";
import { lazyNamed, page } from "@/shared/routing/page";

const StorePage = lazyNamed(() => import("./pages/StorePage"), "StorePage");

function BrowseCourseDetailRedirect() {
  const { courseId } = useParams();
  return <Navigate to={`/courses/${courseId}/details`} replace />;
}

/** Store checkout and course discovery for learners. */
export const storeRoutes: RouteObject[] = [
  {
    element: <RequireSection section="store" />,
    children: [{ path: "/store", element: page(<StorePage />) }],
  },
  {
    element: <RequireLearnerCatalog />,
    children: [
      { path: "/browse-courses", element: <Navigate to="/courses" replace /> },
      { path: "/browse-courses/:courseId", element: <BrowseCourseDetailRedirect /> },
    ],
  },
];
