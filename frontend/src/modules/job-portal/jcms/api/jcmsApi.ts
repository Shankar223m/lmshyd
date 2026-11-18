import { baseApi } from "@/core/api/baseApi";

export type JcmsInterview = {
  interview_id: string;
  round_name: string;
  format: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  meeting_link: string | null;
  instructions: string | null;
  status: string;
  outcome?: string | null;
};

export type JcmsOffer = {
  offer_id: string;
  application_id: string;
  ctc: number;
  currency: string;
  joining_date: string | null;
  role_title: string;
  location?: string | null;
  status: string;
  expires_at: string;
  requires_approval?: boolean;
  offer_letter_media_id?: number | null;
};

export type JcmsPlacementEvidence = {
  evidence_id: string;
  media_asset_id: number;
  category: string;
  status: string;
  rejection_reason?: string | null;
};

export type JcmsPlacement = {
  placement_id: string;
  status: string;
  designation: string | null;
  joining_date: string | null;
  annual_package: number | null;
  currency: string;
  work_location: string | null;
  verifier_comment?: string | null;
  evidence: JcmsPlacementEvidence[];
};

export type RecruiterApplication = {
  application_id: string;
  job_id: string;
  job_title?: string;
  status: string;
  match_score?: number | null;
  candidate?: { name?: string; email?: string | null };
};

export const jcmsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listMyInterviews: build.query<JcmsInterview[], void>({
      query: () => "/interviews/me",
      transformResponse: (r: { interviews: JcmsInterview[] }) => r.interviews ?? [],
      providesTags: ["MyApplication"],
    }),
    requestInterviewReschedule: build.mutation<void, { interviewId: string; starts_at: string; ends_at: string; reason?: string }>({
      query: ({ interviewId, ...body }) => ({ url: `/interviews/${interviewId}/reschedule-request`, method: "POST", body }),
      invalidatesTags: ["MyApplication"],
    }),
    listMyOffers: build.query<JcmsOffer[], void>({
      query: () => "/offers/me",
      transformResponse: (r: { offers: JcmsOffer[] }) => r.offers ?? [],
      providesTags: ["MyApplication"],
    }),
    listMyPlacements: build.query<JcmsPlacement[], void>({
      query: () => "/placements/me",
      transformResponse: (r: { placements: JcmsPlacement[] }) => r.placements ?? [],
      providesTags: ["MyApplication"],
    }),
    submitPlacementEvidence: build.mutation<void, { placementId: string; media_asset_id: number; category: string }>({
      query: ({ placementId, ...body }) => ({ url: `/placements/${placementId}/evidence`, method: "POST", body }),
      invalidatesTags: ["MyApplication"],
    }),
    listRecruiterApplications: build.query<RecruiterApplication[], { page?: number; per_page?: number } | void>({
      query: (params) => ({ url: "/recruiter/applications", params: params ?? undefined }),
      transformResponse: (r: { applications: RecruiterApplication[] }) => r.applications ?? [],
      providesTags: ["EmployerJob"],
    }),
    listRecruiterInterviews: build.query<JcmsInterview[], void>({
      query: () => "/recruiter/interviews",
      transformResponse: (r: { interviews: JcmsInterview[] }) => r.interviews ?? [],
      providesTags: ["EmployerJob"],
    }),
    scheduleInterview: build.mutation<void, { applicationId: string; body: Record<string, unknown> }>({
      query: ({ applicationId, body }) => ({ url: `/employer/applications/${applicationId}/interviews`, method: "POST", body }),
      invalidatesTags: ["EmployerJob", "MyApplication"],
    }),
    submitInterviewFeedback: build.mutation<void, { interviewId: string; body: Record<string, unknown> }>({
      query: ({ interviewId, body }) => ({ url: `/interviews/${interviewId}/feedback`, method: "POST", body }),
      invalidatesTags: ["EmployerJob"],
    }),
    assignJobRecruiters: build.mutation<void, { jobId: string; recruiter_user_ids: number[] }>({
      query: ({ jobId, recruiter_user_ids }) => ({ url: `/employer/jobs/${jobId}/recruiters`, method: "PUT", body: { recruiter_user_ids } }),
      invalidatesTags: ["EmployerJob"],
    }),
    approveOffer: build.mutation<void, { offerId: string }>({
      query: ({ offerId }) => ({ url: `/employer/offers/${offerId}/approve`, method: "POST" }),
      invalidatesTags: ["EmployerJob", "MyApplication"],
    }),
    verifyPlacement: build.mutation<void, { placementId: string; action: string; comment?: string }>({
      query: ({ placementId, action, comment }) => ({
        url: `/institution/placements/${placementId}/verify`,
        method: "POST",
        params: { action, comment },
      }),
      invalidatesTags: ["MyApplication"],
    }),
  }),
});

export const {
  useListMyInterviewsQuery,
  useRequestInterviewRescheduleMutation,
  useListMyOffersQuery,
  useListMyPlacementsQuery,
  useSubmitPlacementEvidenceMutation,
  useListRecruiterApplicationsQuery,
  useListRecruiterInterviewsQuery,
  useScheduleInterviewMutation,
  useSubmitInterviewFeedbackMutation,
  useAssignJobRecruitersMutation,
  useApproveOfferMutation,
  useVerifyPlacementMutation,
} = jcmsApi;
