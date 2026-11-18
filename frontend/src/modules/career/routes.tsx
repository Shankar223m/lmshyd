import type { RouteObject } from "react-router-dom";

import { RequireSection } from "@/modules/user-management/auth/guards/RequireSection";
import { lazyNamed, page } from "@/shared/routing/page";

const CareerHomePage = lazyNamed(() => import("./common/pages/CareerHomePage"), "CareerHomePage");
const MyProfilePage = lazyNamed(() => import("./profile/pages/MyProfilePage"), "MyProfilePage");
const StudentLookupPage = lazyNamed(() => import("./profile/pages/StudentLookupPage"), "StudentLookupPage");
const StudentProfilePage = lazyNamed(() => import("./profile/pages/StudentProfilePage"), "StudentProfilePage");
const ResumesListPage = lazyNamed(() => import("./resumes/pages/ResumesListPage"), "ResumesListPage");
const ResumeEditorPage = lazyNamed(() => import("./resumes/pages/ResumeEditorPage"), "ResumeEditorPage");
const ResumeCreateWizardPage = lazyNamed(() => import("./resumes/pages/ResumeCreateWizardPage"), "ResumeCreateWizardPage");
const ResumeUploadPage = lazyNamed(() => import("./resumes/pages/ResumeUploadPage"), "ResumeUploadPage");
const ResumeAnalysisPage = lazyNamed(() => import("./resumes/pages/ResumeAnalysisPage"), "ResumeAnalysisPage");
const ResumeTemplatesPage = lazyNamed(() => import("./resumes/pages/ResumeTemplatesPage"), "ResumeTemplatesPage");
const PublicResumePage = lazyNamed(() => import("./public/pages/PublicResumePage"), "PublicResumePage");

/** `app`: gated by the "career" section. `public`: a shared resume link, no sign-in (rendered in PublicLayout). */
export const careerModuleRoutes = {
  app: [
    {
      element: <RequireSection section="career" />,
      children: [
        { path: "/career", element: page(<CareerHomePage />) },
        { path: "/career/profile", element: page(<MyProfilePage />) },
        // Resume Dashboard
        { path: "/career/resumes", element: page(<ResumesListPage />) },
        { path: "/resume", element: page(<ResumesListPage />) },
        // 9-Step Creation Wizard
        { path: "/career/resumes/create", element: page(<ResumeCreateWizardPage />) },
        { path: "/resume/create", element: page(<ResumeCreateWizardPage />) },
        // Dedicated Upload & Parsing
        { path: "/career/resumes/upload", element: page(<ResumeUploadPage />) },
        { path: "/resume/upload", element: page(<ResumeUploadPage />) },
        // AI Resume Analysis & Job Description Match
        { path: "/career/resumes/analysis", element: page(<ResumeAnalysisPage />) },
        { path: "/resume/analysis", element: page(<ResumeAnalysisPage />) },
        // Templates Gallery
        { path: "/career/resumes/templates", element: page(<ResumeTemplatesPage />) },
        { path: "/resume/templates", element: page(<ResumeTemplatesPage />) },
        // Resume Editor
        { path: "/career/resumes/:resumeId", element: page(<ResumeEditorPage />) },
        { path: "/resume/:resumeId", element: page(<ResumeEditorPage />) },
        // Staff lookup
        { path: "/career/students", element: page(<StudentLookupPage />) },
        { path: "/career/students/:userId", element: page(<StudentProfilePage />) },
      ],
    },
  ] satisfies RouteObject[],
  public: [{ path: "/resume/share/:token", element: page(<PublicResumePage />) }] satisfies RouteObject[],
};
