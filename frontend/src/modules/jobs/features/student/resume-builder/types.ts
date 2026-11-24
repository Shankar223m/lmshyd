export interface PersonalInfo {
  full_name: string;
  professional_title: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  website_url: string;
  photo_url?: string | null;
}

export interface Education {
  id: string;
  degree: string;
  specialization: string;
  institution: string;
  location: string;
  start_year: string;
  end_year: string;
  currently_studying: boolean;
  gpa: string;
  percentage: string;
  description: string;
}

export interface SkillItem {
  id: string;
  name: string;
  category: string;
  level?: string;
}

export interface Experience {
  id: string;
  job_title: string;
  company: string;
  employment_type: string;
  location: string;
  start_date: string;
  end_date: string;
  currently_working: boolean;
  responsibilities: string;
  technologies: string[];
}

export interface Internship {
  id: string;
  role: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  currently_working: boolean;
  description: string;
  responsibilities: string;
  technologies: string[];
  project_worked_on: string;
}

export interface Project {
  id: string;
  name: string;
  project_type: string;
  description: string;
  technologies: string[];
  start_date: string;
  end_date: string;
  github_url: string;
  demo_url: string;
}

export interface Certification {
  id: string;
  name: string;
  issuing_organization: string;
  issue_date: string;
  expiration_date: string;
  credential_id: string;
  credential_url: string;
  skills_learned: string[];
  lms_imported?: boolean;
}

export interface Course {
  id: string;
  course_name: string;
  institution: string;
  completion_date: string;
  skills_learned: string[];
  certificate_id: string;
  lms_imported?: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  organization: string;
  date: string;
  description: string;
  achievement_type: string;
}

export interface Language {
  id: string;
  language: string;
  proficiency: string;
}

export interface CustomSectionItem {
  id: string;
  section_name: string;
  title: string;
  description: string;
  date: string;
}

export interface SectionConfig {
  id: string;
  name: string;
  visible: boolean;
}

export interface ATSCategoryScore {
  category: string;
  score: number;
  max_score: number;
  feedback: string;
}

export interface ATSScoreData {
  overall_score: number;
  category_scores: ATSCategoryScore[];
  strengths: string[];
  improvements_needed: string[];
  missing_keywords: string[];
  recommended_changes: string[];
  disclaimer: string;
}

export interface SectionCompletion {
  section: string;
  percentage: number;
  is_complete: boolean;
}

export interface ResumeCompletion {
  overall_percentage: number;
  sections: SectionCompletion[];
  suggestions: string[];
}

export interface ResumeStyling {
  font_family: string; // 'Plus Jakarta Sans' | 'Inter' | 'Roboto' | 'Merriweather'
  font_size: 'sm' | 'md' | 'lg';
  line_spacing: number; // 1.15 | 1.3 | 1.5
  margins: 'compact' | 'normal' | 'spacious';
  accent_color: string;
  section_spacing: 'compact' | 'normal' | 'spacious';
}

export interface ResumeVersion {
  _id: string;
  resume_id: string;
  user_id: string;
  version_name: string;
  score: number;
  snapshot: any;
  created_at: string;
}

export interface ResumeDocument {
  _id: string;
  user_id: string;
  resume_name: string;
  target_role: string;
  template_id: string; // modern | professional | minimal | technical | fresher
  styling?: ResumeStyling;
  personal_info: PersonalInfo;
  professional_summary: string;
  education: Education[];
  skills: SkillItem[];
  experience: Experience[];
  internships: Internship[];
  projects: Project[];
  certifications: Certification[];
  completed_courses: Course[];
  achievements: Achievement[];
  languages: Language[];
  interests: string[];
  custom_sections: CustomSectionItem[];
  section_order: SectionConfig[];
  ats_score: number;
  ats_data?: ATSScoreData;
  completion_percentage: number;
  completion_details?: ResumeCompletion;
  created_at: string;
  updated_at: string;
}

export interface AIReviewCard {
  section: string;
  type: 'warning' | 'suggestion' | 'success';
  recommendation: string;
  action_label: string;
  action_type: 'summary' | 'experience' | 'project' | 'skills' | 'preview';
}
