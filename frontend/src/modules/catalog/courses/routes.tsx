import { lazy } from "react";
import { Navigate, useParams, type RouteObject } from "react-router-dom";
import { page } from "@/shared/routing/page";
import { RequireRole } from "@/modules/user-management/auth/guards/RequireRole";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";

const BrowseCoursesPage = lazy(() =>
  import("@/modules/store/pages/BrowseCoursesPage").then((m) => ({ default: m.BrowseCoursesPage }))
);
const BrowseCourseDetailPage = lazy(() =>
  import("@/modules/store/pages/BrowseCourseDetailPage").then((m) => ({ default: m.BrowseCourseDetailPage }))
);

const CourseDashboardPage = lazy(() =>
  import("./pages/CourseDashboardPage").then((m) => ({ default: m.CourseDashboardPage }))
);
const CourseCreatePage = lazy(() =>
  import("./pages/CourseCreatePage").then((m) => ({ default: m.CourseCreatePage }))
);
const CourseBuilderPage = lazy(() =>
  import("./pages/CourseBuilderPage").then((m) => ({ default: m.CourseBuilderPage }))
);
const CoursePreviewPage = lazy(() =>
  import("./pages/CoursePreviewPage").then((m) => ({ default: m.CoursePreviewPage }))
);
const CreateTestPage = lazy(() =>
  import("@/modules/assessments/tests/pages/TestCreatePage").then((m) => ({ default: m.TestCreatePage }))
);
const CertificateTemplatesPage = lazy(() =>
  import("@/modules/certificates/templates/pages/TemplatesListPage").then((m) => ({ default: m.TemplatesListPage }))
);
const CourseHubPage = lazy(() =>
  import("./pages/CourseHubPage").then((m) => ({ default: m.CourseHubPage }))
);
const ModuleChaptersPage = lazy(() =>
  import("./pages/ModuleChaptersPage").then((m) => ({ default: m.ModuleChaptersPage }))
);
const AIGeneratorPage = lazy(() =>
  import("./pages/AIGeneratorPage").then((m) => ({ default: m.AIGeneratorPage }))
);
const QuestionReviewPage = lazy(() =>
  import("./pages/QuestionReviewPage").then((m) => ({ default: m.QuestionReviewPage }))
);
const StudentLearningPage = lazy(() =>
  import("./pages/StudentLearningPage").then((m) => ({ default: m.StudentLearningPage }))
);
const ChapterTestPage = lazy(() =>
  import("./pages/ChapterTestPage").then((m) => ({ default: m.ChapterTestPage }))
);
const ModuleTestPage = lazy(() =>
  import("./pages/ModuleTestPage").then((m) => ({ default: m.ModuleTestPage }))
);
const FinalExamPage = lazy(() =>
  import("./pages/FinalExamPage").then((m) => ({ default: m.FinalExamPage }))
);
const MyCoursesCertificatesPage = lazy(() =>
  import("./pages/MyCoursesCertificatesPage").then((m) => ({ default: m.MyCoursesCertificatesPage }))
);

function CourseIndexRouter() {
  const { user } = useAuth();
  if (user?.role === "student") {
    return <BrowseCoursesPage />;
  }
  return <CourseDashboardPage />;
}

function CourseItemRouter() {
  const { user } = useAuth();
  const { courseId } = useParams();
  if (user?.role === "student") {
    return <Navigate to={`/courses/${courseId}/details`} replace />;
  }
  return <CourseHubPage />;
}

export const courseRoutes: RouteObject[] = [
  // 1. Primary Course Route (Role-aware: Approved Marketplace for Students, Dashboard for Admins/Staff)
  {
    path: "/courses",
    element: page(<CourseIndexRouter />),
  },

  // 2. Student Course Details
  {
    path: "/courses/:courseId/details",
    element: page(<BrowseCourseDetailPage />),
  },

  // 3. Course Root by ID (Role-aware: Course Details for Students, Course Studio Hub for Admins/Staff)
  {
    path: "/courses/:courseId",
    element: page(<CourseItemRouter />),
  },

  // 11. Student Courses & Certificates (Accessible to enrolled learners and platform viewers)
  {
    path: "/courses/my",
    element: page(<MyCoursesCertificatesPage />),
  },

  // 7. Student Learning Room
  {
    path: "/courses/:courseId/learn",
    element: page(<StudentLearningPage />),
  },

  // 8. Student Chapter Test
  {
    path: "/courses/:courseId/chapters/:chapterId/test",
    element: page(<ChapterTestPage />),
  },

  // 9. Student Module Test
  {
    path: "/courses/:courseId/modules/:moduleId/test",
    element: page(<ModuleTestPage />),
  },

  // 10. Student Final Proctored Exam
  {
    path: "/courses/:courseId/exam",
    element: page(<FinalExamPage />),
  },
  {
    path: "/courses/:courseId/final-exam",
    element: page(<FinalExamPage />),
  },

  // Authoring Only: Create & Edit Course, AI Generation (Strictly super_admin and admin; 403 Access Denied for student/staff)
  {
    element: <RequireRole roles={["super_admin", "admin"]} />,
    children: [
      {
        path: "/courses/create",
        element: page(<CourseCreatePage />),
      },
      {
        path: "/courses/new",
        element: page(<CourseCreatePage />),
      },
      {
        path: "/courses/:courseId/edit",
        element: page(<CourseHubPage />),
      },
      {
        path: "/courses/:courseId/studio",
        element: page(<CourseHubPage />),
      },
      {
        path: "/courses/:courseId/builder",
        element: page(<CourseBuilderPage />),
      },
      {
        path: "/courses/:courseId/preview",
        element: page(<CoursePreviewPage />),
      },
      {
        path: "/courses/:courseId/certificate",
        element: page(<CertificateTemplatesPage />),
      },
      {
        path: "/courses/:courseId/certificates",
        element: page(<CertificateTemplatesPage />),
      },
      {
        path: "/courses/:courseId/tests/create",
        element: page(<CreateTestPage />),
      },
      {
        path: "/courses/:courseId/modules/:moduleId/chapters/:chapterId/ai-generate",
        element: page(<AIGeneratorPage />),
      },
      {
        path: "/courses/:courseId/ai-generator",
        element: page(<AIGeneratorPage />),
      },
    ],
  },

  // Admin & Staff: Course Hub and Chapter Authoring
  {
    element: (
      <RequireRole
        roles={["super_admin", "admin", "institution_head", "staff"]}
        studentRedirect="/courses/my"
      />
    ),
    children: [
      {
        path: "/courses/:courseId/hub",
        element: page(<CourseHubPage />),
      },
      {
        path: "/courses/:courseId/modules/:moduleId",
        element: page(<ModuleChaptersPage />),
      },
      {
        path: "/courses/:courseId/modules/:moduleId/chapters",
        element: page(<ModuleChaptersPage />),
      },
    ],
  },

  // Question Review: super_admin, admin, staff (403 for students)
  {
    element: <RequireRole roles={["super_admin", "admin", "staff"]} />,
    children: [
      {
        path: "/courses/:courseId/modules/:moduleId/chapters/:chapterId/questions",
        element: page(<QuestionReviewPage />),
      },
      {
        path: "/courses/:courseId/modules/:moduleId/chapters/:chapterId/review",
        element: page(<QuestionReviewPage />),
      },
      {
        path: "/courses/:courseId/questions/review",
        element: page(<QuestionReviewPage />),
      },
    ],
  },
];
