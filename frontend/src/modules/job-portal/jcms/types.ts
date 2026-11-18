export type JobStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'CLOSED' | 'REJECTED';
export type VerificationStatus = 'VERIFIED' | 'UNDER_REVIEW' | 'CHANGES_REQUIRED' | 'REJECTED';

export type JobSummary = {
  id: string;
  title: string;
  status: string;
  company_name?: string;
  location?: string;
  employment_type?: string;
  salary_range?: string;
  applicant_count: number;
};

export type StudentInterview = {
  id: string;
  round_name: string;
  job_title: string;
  company_name: string;
  starts_at: string;
  ends_at: string;
  format: 'ONLINE' | 'IN_PERSON';
  meeting_link?: string;
  instructions?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'FEEDBACK_SUBMITTED';
  outcome?: string;
};

export type OfferItem = {
  id: string;
  role_title: string;
  company_name: string;
  status: 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  annual_package: number;
  location?: string;
  joining_date?: string;
  respond_by?: string;
  offer_letter_file_id?: string;
  benefits?: string[];
};

export type PlacementRecord = {
  id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED';
  company_name?: string;
  designation?: string;
  joining_date?: string;
  annual_package?: number;
  work_location?: string;
  evidence_file_id?: string;
  evidence_documents?: Array<{ id: string; file_id: string; category: string; status: string }>;
  verifier_comment?: string;
  placement_officer?: {
    name: string;
    email: string;
    institution_name?: string;
  };
};

export type PipelineCandidate = {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  program: string;
  cgpa: number;
  graduation_year: number;
  institution_name: string;
  status: string;
  pipeline_stage: 'Screening' | 'Shortlisted' | 'Assessment' | 'Interview' | 'Selected' | 'Rejected';
  match_percent: number;
  skills?: string[];
  resume_file_id?: string;
  internal_note?: string;
  created_at: string;
};

export type ScheduledInterview = {
  id: string;
  application_id: string;
  candidate_name: string;
  job_title: string;
  round_name: string;
  format: string;
  starts_at: string;
  ends_at: string;
  status: string;
  meeting_link?: string;
  instructions?: string;
  feedback?: {
    technical_skills: number;
    problem_solving: number;
    communication: number;
    culture_fit: number;
    comments: string;
    recommendation: string;
  };
};

export type OrganizationItem = {
  id: string;
  name: string;
  org_type: 'EMPLOYER' | 'INSTITUTION';
  verification_status: 'VERIFIED' | 'UNDER_REVIEW' | 'CHANGES_REQUIRED' | 'REJECTED';
  verification_comment?: string;
  registration_number?: string;
  website?: string;
  contact_name?: string;
  contact_email?: string;
  size_band?: string;
};

export type ModerationJob = {
  id: string;
  title: string;
  organization_name: string;
  organization_verified: boolean;
  status: 'PENDING_APPROVAL' | 'PUBLISHED' | 'CHANGES_REQUESTED' | 'REJECTED';
  description: string;
  location: string;
  employment_type: string;
  work_mode: string;
  salary_min: number;
  salary_max: number;
  openings: number;
  skills: string[];
  moderation_note?: string;
  safety_checks?: {
    salary_benchmark_met: boolean;
    no_recruitment_fees: boolean;
    duplicate_detected: boolean;
    org_verified: boolean;
  };
};
