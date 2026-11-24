import {
  loadAllResumes,
  saveAllResumes,
  getUserId,
  getBlankResume,
  getDemoResume,
  calculateCompletion,
  analyzeResume,
} from './resumeStorage';
import { ResumeDocument, ResumeVersion } from '../types';
import { exportResumeToPdf } from '../utils/pdfExport';

const VERSIONS_PREFIX = 'lms_ai_resume_versions_';

function getVersionsKey(resumeId: string): string {
  return `${VERSIONS_PREFIX}${resumeId}`;
}

function loadVersions(resumeId: string): ResumeVersion[] {
  try {
    const raw = localStorage.getItem(getVersionsKey(resumeId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVersions(resumeId: string, versions: ResumeVersion[]): void {
  try {
    localStorage.setItem(getVersionsKey(resumeId), JSON.stringify(versions));
  } catch {}
}

export const resumeApi = {
  async getResumes(): Promise<ResumeDocument[]> {
    let list = loadAllResumes();
    if (list.length === 0) {
      // Initialize with a high-quality demo resume for the student so they have a ready-made template
      const demo = getDemoResume(getUserId());
      list = [demo];
      saveAllResumes(list);
    }
    return list;
  },

  async getResume(id: string): Promise<ResumeDocument> {
    const list = loadAllResumes();
    const found = list.find((r) => r._id === id);
    if (!found) {
      // Check if it's the initial demo
      const demo = getDemoResume(getUserId());
      if (demo._id === id || id === 'demo') {
        return demo;
      }
      throw new Error(`Resume #${id} not found.`);
    }
    return found;
  },

  async createResume(data: {
    resume_name: string;
    target_role: string;
    template_id: string;
  }): Promise<ResumeDocument> {
    const userId = getUserId();
    const resume = getBlankResume(userId, data.resume_name, data.target_role, data.template_id);
    const list = loadAllResumes();
    list.unshift(resume);
    saveAllResumes(list);
    return resume;
  },

  async createDemoResume(data?: {
    resume_name?: string;
    target_role?: string;
    template_id?: string;
  }): Promise<ResumeDocument> {
    const userId = getUserId();
    const resume = getDemoResume(
      userId,
      data?.resume_name || 'Ananya Sharma - Full Stack Developer',
      data?.target_role || 'Full Stack Developer',
      data?.template_id || 'modern',
    );
    const list = loadAllResumes();
    list.unshift(resume);
    saveAllResumes(list);
    return resume;
  },

  async loadDemoResume(id: string): Promise<ResumeDocument> {
    const list = loadAllResumes();
    const idx = list.findIndex((r) => r._id === id);
    const userId = getUserId();
    const demo = getDemoResume(userId);
    demo._id = id;
    demo.updated_at = new Date().toISOString();

    if (idx !== -1 && list[idx]) {
      demo.resume_name = list[idx].resume_name;
      demo.template_id = list[idx].template_id;
      list[idx] = demo;
    } else {
      list.unshift(demo);
    }
    saveAllResumes(list);
    return demo;
  },

  async updateResume(id: string, updates: Partial<ResumeDocument>): Promise<ResumeDocument> {
    const list = loadAllResumes();
    const idx = list.findIndex((r) => r._id === id);
    if (idx === -1 || !list[idx]) {
      throw new Error(`Resume #${id} not found.`);
    }

    const current = list[idx];
    const updated: ResumeDocument = {
      ...current,
      ...updates,
      _id: id,
      updated_at: new Date().toISOString(),
    };

    // Recalculate metrics
    updated.completion_details = calculateCompletion(updated);
    updated.completion_percentage = updated.completion_details.overall_percentage;
    updated.ats_data = analyzeResume(updated, updated.target_role);
    updated.ats_score = updated.ats_data.overall_score;

    list[idx] = updated;
    saveAllResumes(list);
    return updated;
  },

  async deleteResume(id: string): Promise<{ message: string; id: string }> {
    let list = loadAllResumes();
    list = list.filter((r) => r._id !== id);
    saveAllResumes(list);
    try {
      localStorage.removeItem(getVersionsKey(id));
    } catch {}
    return { message: 'Resume deleted successfully', id };
  },

  async duplicateResume(id: string): Promise<ResumeDocument> {
    const list = loadAllResumes();
    const source = list.find((r) => r._id === id);
    if (!source) throw new Error('Source resume not found');

    const copy: ResumeDocument = {
      ...JSON.parse(JSON.stringify(source)),
      _id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      resume_name: `${source.resume_name} (Copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    list.unshift(copy);
    saveAllResumes(list);
    return copy;
  },

  async renameResume(id: string, resume_name: string): Promise<ResumeDocument> {
    return this.updateResume(id, { resume_name: resume_name.trim() });
  },

  async downloadBackendPdf(_id: string, filename: string): Promise<void> {
    await exportResumeToPdf('resume-document-sheet', filename);
  },

  async getVersions(resumeId: string): Promise<ResumeVersion[]> {
    return loadVersions(resumeId);
  },

  async createVersion(resumeId: string, version_name?: string): Promise<ResumeVersion> {
    const resume = await this.getResume(resumeId);
    const versions = loadVersions(resumeId);
    const newVersion: ResumeVersion = {
      _id: `ver_${Date.now()}`,
      resume_id: resumeId,
      user_id: resume.user_id,
      version_name: version_name?.trim() || `Version ${versions.length + 1} (${new Date().toLocaleDateString()})`,
      score: resume.ats_score,
      snapshot: JSON.parse(JSON.stringify(resume)),
      created_at: new Date().toISOString(),
    };
    versions.unshift(newVersion);
    saveVersions(resumeId, versions);
    return newVersion;
  },

  async restoreVersion(resumeId: string, versionId: string): Promise<ResumeDocument> {
    const versions = loadVersions(resumeId);
    const ver = versions.find((v) => v._id === versionId);
    if (!ver || !ver.snapshot) throw new Error('Version snapshot not found');

    const restored: ResumeDocument = {
      ...ver.snapshot,
      _id: resumeId,
      updated_at: new Date().toISOString(),
    };
    await this.updateResume(resumeId, restored);
    return restored;
  },

  async deleteVersion(resumeId: string, versionId: string): Promise<{ message: string }> {
    let versions = loadVersions(resumeId);
    versions = versions.filter((v) => v._id !== versionId);
    saveVersions(resumeId, versions);
    return { message: 'Version deleted' };
  },

  async uploadAndParseResume(file: File): Promise<any> {
    return {
      message: 'Parsed resume successfully',
      name: file.name.replace(/\.[^/.]+$/, ''),
    };
  },
};
