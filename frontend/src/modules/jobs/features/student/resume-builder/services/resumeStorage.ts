import { storage } from '@/core/lib/storage';
import {
  ResumeDocument,
  ResumeCompletion,
  ATSScoreData,
  SectionConfig,
} from '../types';

const STORAGE_PREFIX = 'lms_ai_resumes_';

export const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'personal_info', name: 'Personal Information', visible: true },
  { id: 'professional_summary', name: 'Professional Summary', visible: true },
  { id: 'education', name: 'Education', visible: true },
  { id: 'skills', name: 'Skills', visible: true },
  { id: 'experience', name: 'Work Experience', visible: true },
  { id: 'internships', name: 'Internships', visible: true },
  { id: 'projects', name: 'Projects', visible: true },
  { id: 'certifications', name: 'Certifications', visible: true },
  { id: 'completed_courses', name: 'Completed Courses', visible: true },
  { id: 'achievements', name: 'Achievements', visible: true },
  { id: 'languages', name: 'Languages', visible: true },
  { id: 'interests', name: 'Interests', visible: true },
  { id: 'custom_sections', name: 'Custom Sections', visible: true },
];

export const ROLE_KEYWORDS_MAP: Record<string, string[]> = {
  'software developer': ['git', 'rest api', 'unit testing', 'data structures', 'algorithms', 'debugging', 'ci/cd', 'agile', 'clean code', 'oop'],
  'frontend developer': ['react', 'typescript', 'javascript', 'html5', 'css3', 'tailwind css', 'responsive design', 'state management', 'accessibility', 'vite'],
  'backend developer': ['fastapi', 'python', 'node.js', 'rest api', 'sql', 'postgresql', 'mongodb', 'docker', 'microservices', 'redis', 'authentication'],
  'ai engineer': ['python', 'pytorch', 'transformers', 'llm', 'rag', 'embeddings', 'vector database', 'fine-tuning', 'fastapi', 'docker', 'machine learning'],
  'data analyst': ['sql', 'excel', 'python', 'tableau', 'power bi', 'pandas', 'data visualization', 'statistical analysis', 'etl', 'dashboards'],
  'machine learning engineer': ['python', 'scikit-learn', 'tensorflow', 'pytorch', 'model training', 'feature engineering', 'mlops', 'docker', 'pandas'],
  'devops engineer': ['docker', 'kubernetes', 'ci/cd', 'aws', 'terraform', 'linux', 'git', 'monitoring', 'ansible', 'cloud architecture'],
};

export function getUserId(): string {
  try {
    const session = storage.readSession();
    return session?.user?.user_id || 'student_local';
  } catch {
    return 'student_local';
  }
}

function getStorageKey(): string {
  return `${STORAGE_PREFIX}${getUserId()}`;
}

export function calculateCompletion(resume: Partial<ResumeDocument>): ResumeCompletion {
  const sections: { section: string; percentage: number; is_complete: boolean }[] = [];
  const suggestions: string[] = [];

  // 1. Personal Info
  const pi = resume.personal_info || ({} as any);
  const piFields = [pi.full_name, pi.email, pi.phone, pi.city || pi.country];
  const piScore = Math.round((piFields.filter(Boolean).length / piFields.length) * 100);
  sections.push({ section: 'Personal Info', percentage: piScore, is_complete: piScore >= 80 });
  if (piScore < 100) suggestions.push('Add your full contact info and professional links.');

  // 2. Summary
  const summary = (resume.professional_summary || '').trim();
  const summaryWords = summary ? summary.split(/\s+/).length : 0;
  const summaryScore = summaryWords >= 20 ? 100 : summaryWords > 0 ? 50 : 0;
  sections.push({ section: 'Summary', percentage: summaryScore, is_complete: summaryScore >= 80 });
  if (summaryScore === 0) suggestions.push('Add or generate a professional summary.');

  // 3. Education
  const edu = resume.education || [];
  const eduScore = Math.min(100, edu.length * 50);
  sections.push({ section: 'Education', percentage: eduScore, is_complete: eduScore >= 50 });
  if (eduScore === 0) suggestions.push('Add your university or college education.');

  // 4. Skills
  const skills = resume.skills || [];
  const skillsScore = Math.min(100, Math.round((skills.length / 8) * 100));
  sections.push({ section: 'Skills', percentage: skillsScore, is_complete: skillsScore >= 60 });
  if (skills.length < 5) suggestions.push('Add at least 5-8 relevant skills for ATS visibility.');

  // 5. Experience / Internships
  const exp = resume.experience || [];
  const intern = resume.internships || [];
  const expScore = exp.length > 0 ? 100 : intern.length > 0 ? 75 : 0;
  sections.push({ section: 'Experience', percentage: expScore, is_complete: expScore >= 75 });
  if (expScore === 0 && resume.template_id !== 'fresher') suggestions.push('Add work experience or internship details.');

  // 6. Projects
  const projects = resume.projects || [];
  const projScore = Math.min(100, projects.length * 50);
  sections.push({ section: 'Projects', percentage: projScore, is_complete: projScore >= 50 });
  if (projScore === 0) suggestions.push('Add at least one technical or academic project.');

  // 7. Certifications
  const certs = resume.certifications || [];
  const courses = resume.completed_courses || [];
  const certScore = certs.length > 0 || courses.length > 0 ? 100 : 0;
  sections.push({ section: 'Certifications', percentage: certScore, is_complete: certScore > 0 });

  const overall = Math.min(
    100,
    Math.round(
      piScore * 0.2 +
        summaryScore * 0.15 +
        eduScore * 0.15 +
        skillsScore * 0.2 +
        projScore * 0.2 +
        expScore * 0.1,
    ),
  );

  return {
    overall_percentage: overall,
    sections,
    suggestions,
  };
}

export function analyzeResume(resume: Partial<ResumeDocument>, targetRole: string = ''): ATSScoreData {
  const role = (targetRole || resume.target_role || 'Software Developer').toLowerCase();

  // 1. Contact score
  let contactScore = 0;
  const pi = resume.personal_info || ({} as any);
  if (pi.full_name) contactScore += 25;
  if (pi.email && pi.email.includes('@')) contactScore += 25;
  if (pi.phone) contactScore += 20;
  if (pi.city || pi.country) contactScore += 15;
  if (pi.linkedin_url || pi.github_url || pi.portfolio_url) contactScore += 15;

  // 2. Section Completeness
  let completenessScore = 0;
  const summary = (resume.professional_summary || '').trim();
  const edu = resume.education || [];
  const skills = resume.skills || [];
  const exp = resume.experience || [];
  const intern = resume.internships || [];
  const projects = resume.projects || [];

  if (summary) completenessScore += 20;
  if (edu.length > 0) completenessScore += 20;
  if (skills.length >= 5) completenessScore += 20;
  else if (skills.length > 0) completenessScore += 10;
  if (projects.length > 0) completenessScore += 20;
  if (exp.length > 0 || intern.length > 0) completenessScore += 20;

  // 3. Content Quality
  let contentScore = 70;
  const summaryWords = summary.split(/\s+/).filter(Boolean).length;
  if (summaryWords >= 30) contentScore += 15;
  else if (summaryWords >= 15) contentScore += 5;

  const expResp = exp.map((e) => e.responsibilities || '').join(' ');
  const projDesc = projects.map((p) => p.description || '').join(' ');
  const allText = `${summary} ${expResp} ${projDesc}`.toLowerCase();

  const actionVerbs = [
    'developed',
    'engineered',
    'built',
    'implemented',
    'designed',
    'architected',
    'optimized',
    'orchestrated',
    'spearheaded',
    'integrated',
  ];
  const matchedVerbs = actionVerbs.filter((v) => allText.includes(v));
  if (matchedVerbs.length >= 4) contentScore += 15;
  else if (matchedVerbs.length >= 2) contentScore += 10;
  contentScore = Math.min(100, contentScore);

  // 4. Keywords
  let matchedRoleKey = 'software developer';
  for (const k of Object.keys(ROLE_KEYWORDS_MAP)) {
    if (k.includes(role) || role.includes(k)) {
      matchedRoleKey = k;
      break;
    }
  }
  const expectedKeywords = ROLE_KEYWORDS_MAP[matchedRoleKey] || ROLE_KEYWORDS_MAP['software developer'] || [];
  const skillNames = skills.map((s) => (s.name || '').toLowerCase());

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];
  for (const kw of expectedKeywords) {
    if (skillNames.some((sn) => sn.includes(kw)) || allText.includes(kw)) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  const keywordPct = matchedKeywords.length / Math.max(expectedKeywords.length, 1);
  const keywordScore = Math.min(100, Math.max(40, Math.round(keywordPct * 100)));

  // 5. Readability & Formatting
  let readabilityScore = 90;
  const totalWords = allText.split(/\s+/).filter(Boolean).length;
  if (totalWords > 700) readabilityScore -= 15;
  else if (totalWords < 100) readabilityScore -= 20;

  const overall = Math.min(
    100,
    Math.round(
      contactScore * 0.15 +
        completenessScore * 0.25 +
        contentScore * 0.2 +
        keywordScore * 0.25 +
        readabilityScore * 0.15,
    ),
  );

  const categoryScores = [
    { category: 'Contact Information', score: contactScore, max_score: 100, feedback: contactScore >= 80 ? 'Complete contact details' : 'Add phone, location, and social links' },
    { category: 'ATS Section Coverage', score: completenessScore, max_score: 100, feedback: completenessScore >= 80 ? 'All essential sections populated' : 'Add summary, education and projects' },
    { category: 'Action Verbs & Impact', score: contentScore, max_score: 100, feedback: contentScore >= 80 ? 'Strong action-oriented phrasing' : 'Use verbs like engineered, optimized, developed' },
    { category: 'Role Keywords & Skills', score: keywordScore, max_score: 100, feedback: keywordScore >= 70 ? 'Good keyword alignment' : `Missing keywords: ${missingKeywords.slice(0, 3).join(', ')}` },
    { category: 'Readability & Layout', score: readabilityScore, max_score: 100, feedback: 'Clean typography and semantic layout' },
  ];

  return {
    overall_score: overall,
    category_scores: categoryScores,
    strengths: [
      matchedKeywords.length >= 3 ? `Matches key technologies: ${matchedKeywords.slice(0, 4).join(', ')}` : 'Clean single-column layout',
      contactScore >= 80 ? 'Clear header with contact credentials' : 'Organized section structure',
    ],
    improvements_needed: missingKeywords.length > 0 ? [`Add keywords: ${missingKeywords.slice(0, 3).join(', ')}`] : [],
    missing_keywords: missingKeywords,
    recommended_changes: [
      'Tailor bullet points to emphasize quantified metrics (e.g., improved performance by 30%).',
      'Ensure technical proficiencies align with job posting requirements.',
    ],
    disclaimer: 'Calculated using standard ATS scanning heuristics (semantic density, keyword matching, section structure).',
  };
}

export function getBlankResume(
  userId: string,
  resumeName: string = 'My Resume',
  targetRole: string = 'Software Developer',
  templateId: string = 'modern',
): ResumeDocument {
  const id = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const resume: ResumeDocument = {
    _id: id,
    user_id: userId,
    resume_name: resumeName,
    target_role: targetRole,
    template_id: templateId,
    styling: {
      font_family: 'Plus Jakarta Sans',
      font_size: 'md',
      line_spacing: 1.3,
      margins: 'normal',
      accent_color: '#635BFF',
      section_spacing: 'normal',
    },
    personal_info: {
      full_name: '',
      professional_title: targetRole,
      email: '',
      phone: '',
      city: '',
      state: '',
      country: '',
      linkedin_url: '',
      github_url: '',
      portfolio_url: '',
      website_url: '',
      photo_url: null,
    },
    professional_summary: '',
    education: [],
    skills: [],
    experience: [],
    internships: [],
    projects: [],
    certifications: [],
    completed_courses: [],
    achievements: [],
    languages: [],
    interests: [],
    custom_sections: [],
    section_order: DEFAULT_SECTIONS,
    ats_score: 45,
    completion_percentage: 15,
    created_at: now,
    updated_at: now,
  };

  resume.completion_details = calculateCompletion(resume);
  resume.ats_data = analyzeResume(resume, targetRole);
  resume.ats_score = resume.ats_data.overall_score;
  resume.completion_percentage = resume.completion_details.overall_percentage;

  return resume;
}

export function getDemoResume(
  userId: string,
  resumeName: string = 'Ananya Sharma - Full Stack Developer',
  targetRole: string = 'Full Stack Developer',
  templateId: string = 'modern',
): ResumeDocument {
  const id = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const resume: ResumeDocument = {
    _id: id,
    user_id: userId,
    resume_name: resumeName,
    target_role: targetRole,
    template_id: templateId,
    styling: {
      font_family: 'Plus Jakarta Sans',
      font_size: 'md',
      line_spacing: 1.3,
      margins: 'normal',
      accent_color: '#635BFF',
      section_spacing: 'normal',
    },
    personal_info: {
      full_name: 'Ananya Sharma',
      professional_title: 'Full Stack Developer',
      email: 'ananya.sharma@example.com',
      phone: '+91 98765 43210',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      linkedin_url: 'https://linkedin.com/in/ananyasharma',
      github_url: 'https://github.com/ananyasharma',
      portfolio_url: 'https://ananyasharma.dev',
      website_url: '',
      photo_url: null,
    },
    professional_summary:
      'Results-driven Full Stack Developer with hands-on experience building robust, high-performance web applications using React, TypeScript, Node.js, and PostgreSQL. Passionate about clean architecture, responsive user interfaces, and automated testing.',
    education: [
      {
        id: 'edu_1',
        degree: 'Bachelor of Technology',
        specialization: 'Computer Science and Engineering',
        institution: 'National Institute of Technology',
        location: 'Warangal, India',
        start_year: '2021',
        end_year: '2025',
        currently_studying: false,
        gpa: '8.8 / 10.0',
        percentage: '',
        description: 'Coursework: Data Structures & Algorithms, Database Systems, Computer Networks, Software Engineering.',
      },
    ],
    skills: [
      { id: 'sk_1', name: 'React', category: 'Frontend', level: 'Advanced' },
      { id: 'sk_2', name: 'TypeScript', category: 'Languages', level: 'Advanced' },
      { id: 'sk_3', name: 'Node.js', category: 'Backend', level: 'Intermediate' },
      { id: 'sk_4', name: 'FastAPI / Python', category: 'Backend', level: 'Intermediate' },
      { id: 'sk_5', name: 'PostgreSQL', category: 'Databases', level: 'Intermediate' },
      { id: 'sk_6', name: 'Tailwind CSS', category: 'Frontend', level: 'Advanced' },
      { id: 'sk_7', name: 'Docker', category: 'DevOps', level: 'Intermediate' },
      { id: 'sk_8', name: 'Git & GitHub', category: 'Tools', level: 'Advanced' },
      { id: 'sk_9', name: 'REST APIs', category: 'Architecture', level: 'Advanced' },
    ],
    experience: [
      {
        id: 'exp_1',
        job_title: 'Software Engineer Intern',
        company: 'CloudScale Technologies',
        employment_type: 'Full-time',
        location: 'Bengaluru, India (Hybrid)',
        start_date: 'May 2024',
        end_date: 'July 2024',
        currently_working: false,
        responsibilities:
          '• Developed responsive frontend dashboards in React and TypeScript, reducing initial load latency by 28%.\n• Designed and integrated REST APIs handling over 50,000 requests per day with automated error tracking.\n• Implemented automated unit tests with Vitest, elevating test coverage from 62% to 88%.',
        technologies: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
      },
    ],
    internships: [],
    projects: [
      {
        id: 'proj_1',
        name: 'AI-Powered Smart LMS Platform',
        project_type: 'Full Stack Web App',
        description:
          'Engineered a multi-tenant learning and hiring platform featuring role-based workflows, live test execution, automated evaluation pipelines, and integrated resume generation.',
        technologies: ['React', 'TypeScript', 'FastAPI', 'PostgreSQL', 'Tailwind CSS'],
        start_date: 'Jan 2024',
        end_date: 'April 2024',
        github_url: 'https://github.com/ananyasharma/smart-lms',
        demo_url: 'https://smart-lms-demo.example.com',
      },
      {
        id: 'proj_2',
        name: 'Distributed Task Queue & Notification Engine',
        project_type: 'Backend System',
        description:
          'Built an asynchronous task processing engine using Redis and Node.js with exponential backoff retry mechanisms, reducing email dispatch failures by 99.4%.',
        technologies: ['Node.js', 'Redis', 'Docker', 'Jest'],
        start_date: 'Aug 2023',
        end_date: 'Nov 2023',
        github_url: 'https://github.com/ananyasharma/task-queue',
        demo_url: '',
      },
    ],
    certifications: [
      {
        id: 'cert_1',
        name: 'AWS Certified Cloud Practitioner',
        issuing_organization: 'Amazon Web Services',
        issue_date: '2024',
        expiration_date: '2027',
        credential_id: 'AWS-CCP-987654',
        credential_url: 'https://aws.amazon.com/verification',
        skills_learned: ['Cloud Architecture', 'AWS IAM', 'EC2', 'S3'],
      },
    ],
    completed_courses: [],
    achievements: [
      {
        id: 'ach_1',
        title: 'Winner - National Smart Hackathon 2024',
        organization: 'Ministry of Education',
        date: '2024',
        description: 'Secured 1st place among 120+ teams for building an AI-assisted job matching and assessment tool.',
        achievement_type: 'Hackathon',
      },
    ],
    languages: [
      { id: 'lang_1', language: 'English', proficiency: 'Professional' },
      { id: 'lang_2', language: 'Hindi', proficiency: 'Native' },
    ],
    interests: ['Distributed Systems', 'Open Source', 'Competitive Programming', 'UI/UX Design'],
    custom_sections: [],
    section_order: DEFAULT_SECTIONS,
    ats_score: 92,
    completion_percentage: 95,
    created_at: now,
    updated_at: now,
  };

  resume.completion_details = calculateCompletion(resume);
  resume.ats_data = analyzeResume(resume, targetRole);
  resume.ats_score = resume.ats_data.overall_score;
  resume.completion_percentage = resume.completion_details.overall_percentage;

  return resume;
}

export function loadAllResumes(): ResumeDocument[] {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveAllResumes(resumes: ResumeDocument[]): void {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(resumes));
  } catch (err) {
    console.error('Failed to save resumes to localStorage:', err);
  }
}
