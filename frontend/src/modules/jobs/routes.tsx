import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";

import { JobsAdminChrome } from "@/modules/jobs/JobsAdminChrome";

import { RequireSection } from "@/modules/user-management/auth/guards/RequireSection";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { RequireJobsMenu, RequireJobsPersona } from "@/modules/jobs/guards";
import { jobsHomePath, useJobsAccess } from "@/modules/jobs/hooks/useJobsAccess";
import { lazyNamed, page } from "@/shared/routing/page";
import { PageLoader } from "@/shared/ui";

const EmployerJobsPage = lazyNamed(() => import("./features/employer/pages/EmployerJobsPage"), "EmployerJobsPage");
const CreateJobPage = lazyNamed(() => import("./features/employer/pages/CreateJobPage"), "CreateJobPage");
const HiringPipelinePage = lazyNamed(() => import("./features/employer/pages/HiringPipelinePage"), "HiringPipelinePage");
const CreateOfferPage = lazyNamed(() => import("./features/employer/pages/CreateOfferPage"), "CreateOfferPage");
const EmployerProfilePage = lazyNamed(() => import("./features/employer/pages/EmployerProfilePage"), "EmployerProfilePage");
const CandidateReviewPage = lazyNamed(() => import("./features/recruiter/pages/CandidateReviewPage"), "CandidateReviewPage");
const RecruiterInterviewsPage = lazyNamed(() => import("./features/recruiter/pages/RecruiterInterviewsPage"), "RecruiterInterviewsPage");
const StudentDashboardPage = lazyNamed(() => import("./features/student/pages/StudentDashboardPage"), "StudentDashboardPage");
const FindJobsPage = lazyNamed(() => import("./features/student/pages/FindJobsPage"), "FindJobsPage");
const JobDetailPage = lazyNamed(() => import("./features/student/pages/JobDetailPage"), "JobDetailPage");
const ApplyPage = lazyNamed(() => import("./features/student/pages/ApplyPage"), "ApplyPage");
const MyApplicationsPage = lazyNamed(() => import("./features/student/pages/MyApplicationsPage"), "MyApplicationsPage");
const MyInterviewsPage = lazyNamed(() => import("./features/student/pages/MyInterviewsPage"), "MyInterviewsPage");
const StudentOffersPage = lazyNamed(() => import("./features/student/pages/StudentOffersPage"), "StudentOffersPage");
const PlacementPage = lazyNamed(() => import("./features/student/pages/PlacementPage"), "PlacementPage");
const StudentProfilePage = lazyNamed(() => import("./features/student/pages/StudentProfilePage"), "StudentProfilePage");
const InstitutionPlacementsPage = lazyNamed(() => import("./features/institution/pages/InstitutionPlacementsPage"), "InstitutionPlacementsPage");
const InstitutionStudentsPage = lazyNamed(() => import("./features/institution/pages/InstitutionStudentsPage"), "InstitutionStudentsPage");
const InstitutionAnalyticsPage = lazyNamed(() => import("./features/institution/pages/InstitutionAnalyticsPage"), "InstitutionAnalyticsPage");
const InstitutionProfilePage = lazyNamed(() => import("./features/institution/pages/InstitutionProfilePage"), "InstitutionProfilePage");
const AdminDashboardPage = lazyNamed(() => import("./features/administration/pages/AdminDashboardPage"), "AdminDashboardPage");
const AdminAuditPage = lazyNamed(() => import("./features/administration/pages/AdminAuditPage"), "AdminAuditPage");
const AdminReviewInboxPage = lazyNamed(() => import("./features/administration/pages/AdminReviewInboxPage"), "AdminReviewInboxPage");
const AdminJobPostingsPage = lazyNamed(() => import("./features/administration/pages/AdminJobPostingsPage"), "AdminJobPostingsPage");
const AdminJobPostingDetailPage = lazyNamed(
  () => import("./features/administration/pages/AdminJobPostingDetailPage"),
  "AdminJobPostingDetailPage",
);

function JobsHomeRedirect() {
  const { user, sessionStatus } = useAuth();
  const access = useJobsAccess();
  if (sessionStatus === "checking") return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={jobsHomePath(user.role, access.isModerator)} replace />;
}

/** Jobs & placements — same LMS shell and auth as the rest of the app. */
export const jobsModuleRoutes: RouteObject[] = [
  {
    element: <RequireSection section="job_portal" />,
    children: [
      { element: <RequireJobsMenu />, children: [
        { path: "/jobs", element: page(<JobsHomeRedirect />) },
        {
          element: <RequireJobsPersona persona="employer" />,
          children: [
            { path: "/jobs/employer/jobs", element: page(<EmployerJobsPage />) },
            { path: "/jobs/employer/jobs/new", element: page(<CreateJobPage />) },
            { path: "/jobs/employer/pipeline", element: page(<HiringPipelinePage />) },
            { path: "/jobs/employer/interviews", element: page(<RecruiterInterviewsPage />) },
            { path: "/jobs/employer/offers/new", element: page(<CreateOfferPage />) },
            { path: "/jobs/employer/profile", element: page(<EmployerProfilePage />) },
          ],
        },
        {
          element: <RequireJobsPersona persona="recruiter" />,
          children: [
            { path: "/jobs/recruiter/screening", element: page(<CandidateReviewPage />) },
            { path: "/jobs/recruiter/interviews", element: page(<RecruiterInterviewsPage />) },
          ],
        },
        {
          element: <RequireJobsPersona persona="student" />,
          children: [
            { path: "/jobs/student/dashboard", element: page(<StudentDashboardPage />) },
            { path: "/jobs/student/jobs", element: page(<FindJobsPage />) },
            { path: "/jobs/student/jobs/:jobId", element: page(<JobDetailPage />) },
            { path: "/jobs/student/jobs/:jobId/apply", element: page(<ApplyPage />) },
            { path: "/jobs/student/applications", element: page(<MyApplicationsPage />) },
            { path: "/jobs/student/interviews", element: page(<MyInterviewsPage />) },
            { path: "/jobs/student/offers", element: page(<StudentOffersPage />) },
            { path: "/jobs/student/placement", element: page(<PlacementPage />) },
            { path: "/jobs/student/profile", element: page(<StudentProfilePage />) },
          ],
        },
        {
          element: <RequireJobsPersona persona="institution" />,
          children: [
            { path: "/jobs/institution/placements", element: page(<InstitutionPlacementsPage />) },
            { path: "/jobs/institution/students", element: page(<InstitutionStudentsPage />) },
            { path: "/jobs/institution/analytics", element: page(<InstitutionAnalyticsPage />) },
            { path: "/jobs/institution/profile", element: page(<InstitutionProfilePage />) },
          ],
        },
        {
          element: <RequireJobsPersona persona="moderator" />,
          children: [{
            element: <JobsAdminChrome />,
            children: [
            { path: "/jobs/admin/dashboard", element: page(<AdminDashboardPage />) },
            { path: "/jobs/admin/postings", element: page(<AdminJobPostingsPage />) },
            { path: "/jobs/admin/postings/:jobId", element: page(<AdminJobPostingDetailPage />) },
            { path: "/jobs/admin/review", element: page(<AdminReviewInboxPage />) },
            { path: "/jobs/admin/jobs/new", element: page(<CreateJobPage />) },
            { path: "/jobs/admin/audit", element: page(<AdminAuditPage />) },
            { path: "/jobs/admin/verification", element: <Navigate to="/jobs/admin/review?tab=orgs" replace /> },
            { path: "/jobs/admin/job-moderation", element: <Navigate to="/jobs/admin/review" replace /> },
            ],
          }],
        },
      ]},
    ],
  },
];

export const jcmsPortalModuleRoutes = jobsModuleRoutes;