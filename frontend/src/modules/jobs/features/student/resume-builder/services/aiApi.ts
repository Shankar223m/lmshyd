import { resumeApi } from './resumeApi';
import { ROLE_KEYWORDS_MAP } from './resumeStorage';
import { AIReviewCard } from '../types';

export const aiApi = {
  async getLmsCertificates(): Promise<any[]> {
    return [];
  },

  async recordAction(
    _resumeId: string,
    _action: string,
    _original: string,
    _suggestion: string,
    _accepted: boolean,
  ): Promise<void> {
    // client telemetry no-op
  },

  async reviewResume(resumeId: string): Promise<{ reviews: AIReviewCard[] }> {
    const cards = await this.generateReviewCards(resumeId);
    return { reviews: cards };
  },

  async generateSummary(
    resumeId: string,
    targetRole?: string,
  ): Promise<{ original: string; suggestion: string; target_role: string }> {
    const resume = await resumeApi.getResume(resumeId);
    const role = targetRole || resume.target_role || 'Software Developer';
    const skills = resume.skills?.map((s) => s.name).join(', ') || 'modern web technologies and system design';
    const original = resume.professional_summary || '';

    let suggestion = '';
    if (resume.experience && resume.experience.length > 0 && resume.experience[0]) {
      const exp = resume.experience[0];
      suggestion = `Results-oriented ${role} with proven experience at ${exp.company || 'leading tech teams'}. Proficient in ${skills}, with a track record of developing scalable applications, optimizing execution pipelines, and delivering robust software solutions.`;
    } else if (resume.education && resume.education.length > 0 && resume.education[0]) {
      const edu = resume.education[0];
      suggestion = `Motivated ${edu.degree || 'Engineering'} graduate in ${edu.specialization || 'Computer Science'} from ${edu.institution || 'University'}, targeting high-impact opportunities as a ${role}. Strong foundations in ${skills}, combined with hands-on project implementations and a passion for clean, testable code.`;
    } else {
      suggestion = `Analytical and detail-focused ${role} skilled in ${skills}. Dedicated to building high-performance, maintainable web systems and collaborating effectively across modern agile workflows.`;
    }

    return {
      original,
      suggestion,
      target_role: role,
    };
  },

  async improveText(
    _resumeId: string,
    text: string,
    tone: 'improve' | 'shorten' | 'more_professional' | 'more_technical' | 'grammar_fix',
    _targetRole?: string,
  ): Promise<{ original: string; suggestion: string; tone: string }> {
    const original = text;
    let suggestion = text;

    if (tone === 'shorten') {
      suggestion =
        text
          .split('.')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 2)
          .join('. ') + '.';
    } else if (tone === 'more_technical') {
      suggestion = text
        .replace(/worked on/gi, 'architected and implemented')
        .replace(/made/gi, 'engineered')
        .replace(/helped/gi, 'collaborated to optimize')
        .replace(/used/gi, 'leveraged industry-standard');
    } else if (tone === 'more_professional') {
      suggestion = text
        .replace(/did/gi, 'executed')
        .replace(/good at/gi, 'specializing in')
        .replace(/fast/gi, 'high-throughput')
        .replace(/easy to use/gi, 'intuitive and accessible');
    } else {
      // General improve / grammar fix
      suggestion = text
        .replace(/handled/gi, 'spearheaded')
        .replace(/created/gi, 'designed and deployed')
        .replace(/fixed bugs/gi, 'resolved critical defects and optimized test coverage');
      if (!suggestion.endsWith('.')) suggestion += '.';
    }

    return {
      original,
      suggestion,
      tone,
    };
  },

  async improveProjectDescription(
    _resumeId: string,
    projectName: string,
    description: string,
    technologies: string[],
    actionType: 'improve' | 'bullet_points' | 'more_technical' | 'shorten' = 'improve',
  ): Promise<{ original: string; suggestion: string; project_name: string }> {
    const techStr = technologies.length > 0 ? ` using ${technologies.join(', ')}` : '';
    let suggestion = '';

    if (actionType === 'bullet_points') {
      suggestion = `• Architected and deployed ${projectName}${techStr}, ensuring high availability and responsive UX.\n• Implemented automated CI/CD workflows and end-to-end integration testing.\n• Optimized database querying and network caching, reducing request latency by over 30%.`;
    } else if (actionType === 'more_technical') {
      suggestion = `Designed modular, test-driven application architecture for ${projectName}${techStr}. Integrated robust state management, RESTful microservice contracts, and secure session management.`;
    } else {
      suggestion = `Engineered ${projectName}${techStr} to solve end-user workflow bottlenecks. Built clean, reactive components and scalable service interfaces adhering to strict architectural best practices.`;
    }

    return {
      original: description,
      suggestion,
      project_name: projectName,
    };
  },

  async improveExperience(
    _resumeId: string,
    role: string,
    company: string,
    responsibilities: string,
    technologies: string[],
  ): Promise<{ original: string; suggestion: string }> {
    const techStr = technologies.length > 0 ? ` leveraging ${technologies.join(', ')}` : '';
    const suggestion = `• Spearheaded core feature development as ${role} at ${company}${techStr}.\n• Partnered with cross-functional engineering teams to deliver resilient, scalable features on tight sprint deadlines.\n• Enhanced system reliability through rigorous unit and integration testing, cutting defect resolution time by 35%.`;

    return {
      original: responsibilities,
      suggestion,
    };
  },

  async suggestSkills(
    resumeId: string,
    targetRole?: string,
  ): Promise<{
    target_role: string;
    suggestions: Array<{ name: string; category: string; reason: string }>;
    instruction: string;
  }> {
    const resume = await resumeApi.getResume(resumeId);
    const role = (targetRole || resume.target_role || 'Software Developer').toLowerCase();

    let matchedRoleKey = 'software developer';
    for (const k of Object.keys(ROLE_KEYWORDS_MAP)) {
      if (k.includes(role) || role.includes(k)) {
        matchedRoleKey = k;
        break;
      }
    }

    const keywords = ROLE_KEYWORDS_MAP[matchedRoleKey] || ROLE_KEYWORDS_MAP['software developer'] || [];
    const currentSkills = (resume.skills || []).map((s) => s.name.toLowerCase());

    const suggestions = keywords
      .filter((kw) => !currentSkills.some((cs) => cs.includes(kw)))
      .slice(0, 6)
      .map((kw) => ({
        name: kw.toUpperCase().length <= 4 ? kw.toUpperCase() : kw.charAt(0).toUpperCase() + kw.slice(1),
        category: 'Core Competency',
        reason: `Frequently scanned by ATS systems for ${role} roles.`,
      }));

    return {
      target_role: role,
      suggestions,
      instruction: 'Click + to add any relevant skills you possess.',
    };
  },

  async generateReviewCards(resumeId: string): Promise<AIReviewCard[]> {
    const resume = await resumeApi.getResume(resumeId);
    const cards: AIReviewCard[] = [];

    if (!resume.professional_summary || resume.professional_summary.length < 50) {
      cards.push({
        section: 'Summary',
        type: 'warning',
        recommendation: 'Add a concise professional summary to grab recruiters’ attention in the first 6 seconds.',
        action_label: 'Generate Summary',
        action_type: 'summary',
      });
    }

    if (!resume.skills || resume.skills.length < 5) {
      cards.push({
        section: 'Skills',
        type: 'suggestion',
        recommendation: 'Include at least 6 relevant technical skills to pass ATS filters for your target role.',
        action_label: 'Explore Skills',
        action_type: 'skills',
      });
    }

    if (!resume.projects || resume.projects.length === 0) {
      cards.push({
        section: 'Projects',
        type: 'warning',
        recommendation: 'Showcase at least 1-2 practical technical projects with live links or GitHub repos.',
        action_label: 'Add Project',
        action_type: 'project',
      });
    }

    if (cards.length === 0) {
      cards.push({
        section: 'Resume Readiness',
        type: 'success',
        recommendation: 'Your resume meets all key ATS criteria! Ready to export or submit with job applications.',
        action_label: 'Preview Resume',
        action_type: 'preview',
      });
    }

    return cards;
  },
};
