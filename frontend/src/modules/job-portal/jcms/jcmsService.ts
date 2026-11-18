import type {
  StudentInterview,
  OfferItem,
  PlacementRecord,
  PipelineCandidate,
  ScheduledInterview,
  OrganizationItem,
  ModerationJob,
} from "./types";

const STORAGE_KEYS = {
  INTERVIEWS: "jcms_student_interviews",
  OFFERS: "jcms_student_offers",
  PLACEMENT: "jcms_student_placement",
  CANDIDATES: "jcms_pipeline_candidates",
  SCHEDULED_INTERVIEWS: "jcms_scheduled_interviews",
  ORGANIZATIONS: "jcms_admin_orgs",
  MODERATION_JOBS: "jcms_moderation_jobs",
};

// Initial Seed Data
const initialStudentInterviews: StudentInterview[] = [
  {
    id: "int-101",
    round_name: "Technical Round 1 - Algorithms & Data Structures",
    job_title: "Full Stack Software Engineer",
    company_name: "Google Cloud",
    starts_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    ends_at: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString(),
    format: "ONLINE",
    meeting_link: "https://meet.google.com/xyz-code-eval",
    instructions: "Please ensure stable internet, camera on, and keep an active IDE ready for coding live problems.",
    status: "SCHEDULED",
  },
  {
    id: "int-102",
    round_name: "System Design & Architecture Round",
    job_title: "Software Development Engineer II",
    company_name: "Microsoft India",
    starts_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    ends_at: new Date(Date.now() + 5 * 86400000 + 3600000).toISOString(),
    format: "ONLINE",
    meeting_link: "https://teams.microsoft.com/l/meetup-join/design-round",
    instructions: "Be prepared to design distributed microservices, caching strategies, and database sharding.",
    status: "SCHEDULED",
  },
  {
    id: "int-103",
    round_name: "Preliminary Coding Challenge & Problem Solving",
    job_title: "Associate Software Engineer",
    company_name: "Amazon AWS",
    starts_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    ends_at: new Date(Date.now() - 3 * 86400000 + 3600000).toISOString(),
    format: "ONLINE",
    status: "FEEDBACK_SUBMITTED",
    outcome: "Advanced to Final Leadership & Design Round",
  },
];

const initialOffers: OfferItem[] = [
  {
    id: "off-201",
    role_title: "Graduate Software Engineer (L3)",
    company_name: "Google",
    status: "OFFERED",
    annual_package: 2400000,
    location: "Bengaluru, Karnataka (Hybrid)",
    joining_date: "2026-07-15",
    respond_by: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
    offer_letter_file_id: "doc_google_offer_letter",
    benefits: [
      "Base Salary: ₹18,00,000 / annum",
      "Joining Bonus: ₹3,00,000",
      "Annual Performance Bonus: 15%",
      "Comprehensive Health & Dental Insurance (₹10,00,000 cover)",
      "Free Gourmet Meals, Transport & Wellness Allowance",
    ],
  },
  {
    id: "off-202",
    role_title: "Software Development Engineer (SDE-1)",
    company_name: "Microsoft",
    status: "OFFERED",
    annual_package: 2150000,
    location: "Hyderabad, Telangana",
    joining_date: "2026-08-01",
    respond_by: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    offer_letter_file_id: "doc_msft_offer_letter",
    benefits: [
      "Base Salary: ₹16,50,000 / annum",
      "Stock Grants (RSUs): $15,000 vested over 4 years",
      "Relocation Assistance & Corporate Housing Support",
      "Gym Reimbursement & Annual Learning Stipend ($1,200)",
    ],
  },
];

const initialPlacement: PlacementRecord = {
  id: "plc-301",
  status: "DRAFT",
  company_name: "Google",
  designation: "Graduate Software Engineer",
  joining_date: "2026-07-15",
  annual_package: 2400000,
  work_location: "Bengaluru, Karnataka",
  evidence_file_id: "doc_google_offer_letter",
  verifier_comment: "Pending student upload of signed acceptance letter.",
  placement_officer: {
    name: "Dr. K. S. Raman",
    email: "placement.cell@campus.edu",
    institution_name: "National Institute of Technology",
  },
};

const initialCandidates: PipelineCandidate[] = [
  {
    id: "cand-1",
    student_id: "stu-101",
    student_name: "Aarav Sharma",
    student_email: "aarav.sharma@campus.edu",
    program: "B.Tech Computer Science & Engineering",
    cgpa: 9.2,
    graduation_year: 2026,
    institution_name: "NIT Karnataka",
    status: "ACTIVE",
    pipeline_stage: "Screening",
    match_percent: 94,
    skills: ["Python", "FastAPI", "React", "PostgreSQL", "Docker"],
    created_at: "2026-11-01",
  },
  {
    id: "cand-2",
    student_id: "stu-102",
    student_name: "Priya Nair",
    student_email: "priya.nair@campus.edu",
    program: "B.Tech Information Technology",
    cgpa: 8.8,
    graduation_year: 2026,
    institution_name: "NIT Karnataka",
    status: "ACTIVE",
    pipeline_stage: "Shortlisted",
    match_percent: 91,
    skills: ["TypeScript", "Next.js", "Node.js", "MongoDB", "AWS"],
    created_at: "2026-11-02",
  },
  {
    id: "cand-3",
    student_id: "stu-103",
    student_name: "Rohan Varma",
    student_email: "rohan.varma@campus.edu",
    program: "B.Tech Artificial Intelligence",
    cgpa: 9.5,
    graduation_year: 2026,
    institution_name: "IIT Hyderabad",
    status: "ACTIVE",
    pipeline_stage: "Assessment",
    match_percent: 97,
    skills: ["PyTorch", "TensorFlow", "FastAPI", "LLMs", "Kubernetes"],
    created_at: "2026-11-03",
  },
  {
    id: "cand-4",
    student_id: "stu-104",
    student_name: "Sneha Reddy",
    student_email: "sneha.reddy@campus.edu",
    program: "B.Tech Electronics & Comm",
    cgpa: 8.9,
    graduation_year: 2026,
    institution_name: "BITS Pilani",
    status: "ACTIVE",
    pipeline_stage: "Interview",
    match_percent: 88,
    skills: ["Go", "Distributed Systems", "PostgreSQL", "Kafka"],
    created_at: "2026-11-04",
  },
  {
    id: "cand-5",
    student_id: "stu-105",
    student_name: "Vikram Malhotra",
    student_email: "vikram.m@campus.edu",
    program: "M.Tech Software Engineering",
    cgpa: 9.6,
    graduation_year: 2026,
    institution_name: "IIIT Bangalore",
    status: "ACTIVE",
    pipeline_stage: "Selected",
    match_percent: 99,
    skills: ["Rust", "C++", "High Performance Systems", "Redis"],
    created_at: "2026-10-28",
  },
];

const initialScheduledInterviews: ScheduledInterview[] = [
  {
    id: "sch-1",
    application_id: "cand-4",
    candidate_name: "Sneha Reddy",
    job_title: "Distributed Systems Engineer",
    round_name: "Technical Round 2 - Concurrency & Go",
    format: "ONLINE",
    starts_at: "2026-11-12T14:00",
    ends_at: "2026-11-12T15:00",
    status: "SCHEDULED",
    meeting_link: "https://meet.google.com/interview-sneha",
    instructions: "Deep dive into goroutines, channels, and fault-tolerant replication.",
  },
  {
    id: "sch-2",
    application_id: "cand-5",
    candidate_name: "Vikram Malhotra",
    job_title: "Core Infrastructure Engineer",
    round_name: "System Architecture & Low Latency Design",
    format: "ONLINE",
    starts_at: "2026-11-02T10:00",
    ends_at: "2026-11-02T11:15",
    status: "COMPLETED",
    feedback: {
      technical_skills: 5,
      problem_solving: 5,
      communication: 5,
      culture_fit: 4,
      comments: "Exceptional mastery of memory layouts, cache locality, and lock-free data structures.",
      recommendation: "Strong Hire",
    },
  },
];

const initialOrganizations: OrganizationItem[] = [
  {
    id: "org-1",
    name: "Datadog India Technologies Pvt Ltd",
    org_type: "EMPLOYER",
    verification_status: "UNDER_REVIEW",
    registration_number: "CIN-U72900KA2021PTC145678",
    website: "https://datadoghq.com",
    contact_name: "Devon Clark",
    contact_email: "devon.clark@datadoghq.com",
    size_band: "5000+ employees",
  },
  {
    id: "org-2",
    name: "Stripe Payments India",
    org_type: "EMPLOYER",
    verification_status: "VERIFIED",
    registration_number: "CIN-U74999MH2019FTC320140",
    website: "https://stripe.com",
    contact_name: "Anita Bose",
    contact_email: "anita.b@stripe.com",
    size_band: "2500+ employees",
  },
  {
    id: "org-3",
    name: "Indian Institute of Science & Technology",
    org_type: "INSTITUTION",
    verification_status: "VERIFIED",
    registration_number: "UGC-INST-98231",
    website: "https://iist.ac.in",
    contact_name: "Prof. S. R. Murthy",
    contact_email: "registrar@iist.ac.in",
    size_band: "10000+ students",
  },
];

const initialModerationJobs: ModerationJob[] = [
  {
    id: "mod-1",
    title: "Senior Cloud Platform Engineer",
    organization_name: "Datadog India Technologies",
    organization_verified: true,
    status: "PENDING_APPROVAL",
    description: "Build robust telemetry infrastructure handling trillions of metrics per day. Experience with Linux internals, Kubernetes, and Golang required.",
    location: "Bengaluru, Karnataka (Remote Available)",
    employment_type: "Full-time",
    work_mode: "Hybrid",
    salary_min: 2800000,
    salary_max: 4200000,
    openings: 5,
    skills: ["Go", "Kubernetes", "Linux", "Distributed Systems", "Prometheus"],
    safety_checks: {
      salary_benchmark_met: true,
      no_recruitment_fees: true,
      duplicate_detected: false,
      org_verified: true,
    },
  },
  {
    id: "mod-2",
    title: "Backend AI/ML Infrastructure Engineer",
    organization_name: "Anthropic Labs Partner",
    organization_verified: true,
    status: "PENDING_APPROVAL",
    description: "Design and scale model inference pipelines with vLLM, TensorRT-LLM, and Triton inference servers.",
    location: "Hyderabad, Telangana",
    employment_type: "Full-time",
    work_mode: "On-site",
    salary_min: 3000000,
    salary_max: 4800000,
    openings: 3,
    skills: ["Python", "CUDA", "PyTorch", "vLLM", "Docker"],
    safety_checks: {
      salary_benchmark_met: true,
      no_recruitment_fees: true,
      duplicate_detected: false,
      org_verified: true,
    },
  },
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save to localStorage", err);
  }
}

export const jcmsService = {
  // 1. Student Interviews
  getStudentInterviews(): StudentInterview[] {
    return load(STORAGE_KEYS.INTERVIEWS, initialStudentInterviews);
  },

  requestReschedule(interviewId: string, startsAt: string, endsAt: string, reason: string): boolean {
    const interviews = this.getStudentInterviews();
    const updated = interviews.map((i) =>
      i.id === interviewId
        ? {
            ...i,
            instructions: `Reschedule requested for ${new Date(startsAt).toLocaleString()} - ${new Date(endsAt).toLocaleTimeString()}: "${reason}"`,
          }
        : i
    );
    save(STORAGE_KEYS.INTERVIEWS, updated);
    return true;
  },

  // 2. Student Offers
  getStudentOffers(): OfferItem[] {
    return load(STORAGE_KEYS.OFFERS, initialOffers);
  },

  respondToOffer(offerId: string, accept: boolean): boolean {
    const offers = this.getStudentOffers();
    const updated = offers.map((o) =>
      o.id === offerId ? { ...o, status: (accept ? "ACCEPTED" : "DECLINED") as OfferItem["status"] } : o
    );
    save(STORAGE_KEYS.OFFERS, updated);

    // If accepted, update placement record too
    if (accept) {
      const targetOffer = offers.find((o) => o.id === offerId);
      if (targetOffer) {
        const placement = this.getStudentPlacement();
        save(STORAGE_KEYS.PLACEMENT, {
          ...placement,
          status: "SUBMITTED",
          company_name: targetOffer.company_name,
          designation: targetOffer.role_title,
          annual_package: targetOffer.annual_package,
          joining_date: targetOffer.joining_date,
          work_location: targetOffer.location,
        });
      }
    }
    return true;
  },

  // 3. Student Placement Evidence
  getStudentPlacement(): PlacementRecord {
    return load(STORAGE_KEYS.PLACEMENT, initialPlacement);
  },

  submitPlacementEvidence(data: Partial<PlacementRecord>): boolean {
    const current = this.getStudentPlacement();
    const updated: PlacementRecord = {
      ...current,
      ...data,
      status: "SUBMITTED",
    };
    save(STORAGE_KEYS.PLACEMENT, updated);
    return true;
  },

  // 4. Hiring Pipeline
  getPipelineCandidates(): PipelineCandidate[] {
    return load(STORAGE_KEYS.CANDIDATES, initialCandidates);
  },

  updateCandidateStage(candidateId: string, newStage: PipelineCandidate["pipeline_stage"], note?: string): boolean {
    const candidates = this.getPipelineCandidates();
    const updated = candidates.map((c) =>
      c.id === candidateId
        ? {
            ...c,
            pipeline_stage: newStage,
            status: newStage === "Rejected" ? "REJECTED" : "ACTIVE",
            internal_note: note || c.internal_note,
          }
        : c
    );
    save(STORAGE_KEYS.CANDIDATES, updated);
    return true;
  },

  // 5. Recruiter Scheduled Interviews
  getScheduledInterviews(): ScheduledInterview[] {
    return load(STORAGE_KEYS.SCHEDULED_INTERVIEWS, initialScheduledInterviews);
  },

  scheduleNewInterview(data: Omit<ScheduledInterview, "id" | "status">): ScheduledInterview {
    const interviews = this.getScheduledInterviews();
    const newInterview: ScheduledInterview = {
      ...data,
      id: `sch-${Date.now()}`,
      status: "SCHEDULED",
    };
    save(STORAGE_KEYS.SCHEDULED_INTERVIEWS, [newInterview, ...interviews]);
    return newInterview;
  },

  submitScorecard(
    interviewId: string,
    feedback: NonNullable<ScheduledInterview["feedback"]>
  ): boolean {
    const interviews = this.getScheduledInterviews();
    const updated = interviews.map((i) =>
      i.id === interviewId
        ? {
            ...i,
            status: "COMPLETED",
            feedback,
          }
        : i
    );
    save(STORAGE_KEYS.SCHEDULED_INTERVIEWS, updated);
    return true;
  },

  // 6. Organization Verification
  getOrganizations(filter: "ALL" | "EMPLOYER" | "INSTITUTION" = "ALL"): OrganizationItem[] {
    const orgs = load(STORAGE_KEYS.ORGANIZATIONS, initialOrganizations);
    if (filter === "ALL") return orgs;
    return orgs.filter((o) => o.org_type === filter);
  },

  verifyOrganization(
    orgId: string,
    status: OrganizationItem["verification_status"],
    comment?: string
  ): boolean {
    const orgs = this.getOrganizations("ALL");
    const updated = orgs.map((o) =>
      o.id === orgId ? { ...o, verification_status: status, verification_comment: comment } : o
    );
    save(STORAGE_KEYS.ORGANIZATIONS, updated);
    return true;
  },

  // 7. Job Moderation
  getModerationJobs(tab: "queue" | "approved" | "rejected" = "queue"): ModerationJob[] {
    const jobs = load(STORAGE_KEYS.MODERATION_JOBS, initialModerationJobs);
    if (tab === "queue") return jobs.filter((j) => j.status === "PENDING_APPROVAL");
    if (tab === "approved") return jobs.filter((j) => j.status === "PUBLISHED");
    return jobs.filter((j) => j.status === "REJECTED" || j.status === "CHANGES_REQUESTED");
  },

  moderateJob(
    jobId: string,
    action: "approve" | "reject" | "request_changes",
    note?: string
  ): boolean {
    const jobs = load(STORAGE_KEYS.MODERATION_JOBS, initialModerationJobs);
    const updated = jobs.map((j) =>
      j.id === jobId
        ? {
            ...j,
            status: (action === "approve"
              ? "PUBLISHED"
              : action === "reject"
              ? "REJECTED"
              : "CHANGES_REQUESTED") as ModerationJob["status"],
            moderation_note: note,
          }
        : j
    );
    save(STORAGE_KEYS.MODERATION_JOBS, updated);
    return true;
  },

  // 8. Create Offer
  createOffer(
    candidateId: string,
    roleTitle: string,
    annualPackage: number,
    location: string,
    joiningDate: string,
    respondBy: string
  ): OfferItem {
    const offers = this.getStudentOffers();
    const candidate = this.getPipelineCandidates().find((c) => c.id === candidateId);
    const newOffer: OfferItem = {
      id: `off-${Date.now()}`,
      role_title: roleTitle,
      company_name: "TechCorp Global",
      status: "OFFERED",
      annual_package: annualPackage,
      location,
      joining_date: joiningDate,
      respond_by: respondBy,
      benefits: [
        `Base Pay: ₹${(annualPackage * 0.8).toLocaleString()} / annum`,
        "Performance Bonus: Up to 20%",
        "Health & Term Life Insurance Coverage",
        "Learning & Certification Allowance",
      ],
    };
    save(STORAGE_KEYS.OFFERS, [newOffer, ...offers]);

    if (candidate) {
      this.updateCandidateStage(candidate.id, "Selected", "Formal offer generated");
    }

    return newOffer;
  },
};
