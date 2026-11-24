import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResumeDocument, ResumeStyling } from '../types';
import { resumeApi } from '../services/resumeApi';
import { trackingApi } from '../services/trackingApi';
import { ConfirmDialog } from './ConfirmDialog';
import { ResumePreview } from './ResumePreview';
import { PersonalInfoSection } from './sections/PersonalInfoSection';
import { SummarySection } from './sections/SummarySection';
import { EducationSection } from './sections/EducationSection';
import { SkillsSection } from './sections/SkillsSection';
import { ExperienceSection } from './sections/ExperienceSection';
import { InternshipSection } from './sections/InternshipSection';
import { ProjectSection } from './sections/ProjectSection';
import { CertificationSection } from './sections/CertificationSection';
import { LanguageInterestsSection } from './sections/LanguageInterestsSection';
import { AIReviewPanel } from './AIReviewPanel';
import { TEMPLATES } from '../templates';

import {
  User,
  FileText,
  GraduationCap,
  Wrench,
  Briefcase,
  Building,
  FolderGit2,
  ShieldCheck,
  Languages,
  Sparkles,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  Edit,
  Download,
  Check,
  Palette,
  Type,
  RefreshCw,
} from 'lucide-react';

interface ResumeEditorProps {
  initialResume: ResumeDocument;
}

const ACCENT_COLORS = [
  { name: 'Indigo (#635BFF)', hex: '#635BFF' },
  { name: 'Electric Blue', hex: '#2563EB' },
  { name: 'Deep Navy', hex: '#111827' },
  { name: 'Emerald (#16A37B)', hex: '#16A37B' },
  { name: 'Crimson Rose', hex: '#E11D48' },
  { name: 'Amber Gold', hex: '#D97706' },
];

const FONTS = [
  'Inter',
  'Plus Jakarta Sans',
  'Roboto',
  'Merriweather',
  'Playfair Display',
];

export const ResumeEditor: React.FC<ResumeEditorProps> = ({ initialResume }) => {
  const navigate = useNavigate();
  const [resume, setResume] = useState<ResumeDocument>(initialResume);
  
  // 3-tab layout matching Reference Screen 2: Templates | Sections | Design
  const [mainTab, setMainTab] = useState<'templates' | 'sections' | 'design'>('templates');
  const [activeTab, setActiveTab] = useState('personal_info');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  const [showDemoConfirm, setShowDemoConfirm] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Back navigation and unsaved changes confirmation states
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const isInitialMount = useRef(true);
  const autoSaveTimerRef = useRef<any>(null);
  const resumeRef = useRef<ResumeDocument>(resume);
  const isDirtyRef = useRef(false);
  const savePromiseRef = useRef<Promise<any> | null>(null);

  useEffect(() => {
    resumeRef.current = resume;
  }, [resume]);

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    try {
      const demoResume = await resumeApi.loadDemoResume(resume._id);
      setResume(demoResume);
      resumeRef.current = demoResume;
      isDirtyRef.current = false;
      setSaveStatus('saved');
      setLastSavedTime('Just now');
      setShowDemoConfirm(false);
    } catch (err) {
      console.error('Failed to load demo profile:', err);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const performSave = async (resumeToSave: ResumeDocument): Promise<boolean> => {
    try {
      setSaveStatus('saving');
      const promise = resumeApi.updateResume(resumeToSave._id, resumeToSave);
      savePromiseRef.current = promise;
      const updated = await promise;

      setResume((prev) => ({
        ...prev,
        ats_score: updated.ats_score,
        ats_data: updated.ats_data,
        completion_percentage: updated.completion_percentage,
        completion_details: updated.completion_details,
      }));

      isDirtyRef.current = false;
      setSaveStatus('saved');
      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
      return true;
    } catch (err) {
      console.error('Autosave error:', err);
      setSaveStatus('error');
      return false;
    } finally {
      savePromiseRef.current = null;
    }
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    isDirtyRef.current = true;
    setSaveStatus('saving');

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      performSave(resumeRef.current);
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [resume]);

  const handleSaveDraft = async () => {
    await performSave(resumeRef.current);
  };

  const handlePreviewNavigate = async () => {
    if (isDirtyRef.current) {
      await performSave(resumeRef.current);
    }
    navigate(`/jobs/student/resume-builder/${resume._id}/preview`);
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    const fullName = resume.personal_info?.full_name || 'Resume';
    const targetRole = resume.target_role || 'Developer';
    const cleanFileName = `${fullName.replace(/\s+/g, '_')}_${targetRole.replace(/\s+/g, '_')}_Resume.pdf`;

    try {
      await resumeApi.downloadBackendPdf(resume._id, cleanFileName);
      trackingApi.track('download_pdf', resume._id).catch(() => {});
    } catch (err) {
      console.warn('PDF download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBack = async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    if (isDirtyRef.current || saveStatus === 'saving') {
      setIsNavigatingBack(true);
      if (savePromiseRef.current) {
        try {
          await savePromiseRef.current;
        } catch {}
      }

      let success = true;
      if (isDirtyRef.current) {
        success = await performSave(resumeRef.current);
      }

      setIsNavigatingBack(false);

      if (success) {
        navigate('/jobs/student/resume-builder');
      } else {
        setShowUnsavedConfirm(true);
      }
    } else {
      navigate('/jobs/student/resume-builder');
    }
  };

  const updateSection = <K extends keyof ResumeDocument>(key: K, value: ResumeDocument[K]) => {
    setResume((prev) => ({ ...prev, [key]: value }));
  };

  const updateStyling = (patch: Partial<ResumeStyling>) => {
    const current = resume.styling || {
      font_family: 'Plus Jakarta Sans',
      font_size: 'md',
      line_spacing: 1.3,
      margins: 'normal',
      accent_color: '#4F46E5',
      section_spacing: 'normal',
    };
    updateSection('styling', { ...current, ...patch });
  };

  const SECTIONS_NAV = [
    { id: 'personal_info', label: 'Personal Info', icon: User },
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'education', label: 'Education', icon: GraduationCap },
    { id: 'skills', label: 'Skills', icon: Wrench },
    { id: 'experience', label: 'Experience', icon: Briefcase },
    { id: 'internships', label: 'Internships', icon: Building },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'certifications', label: 'Certifications', icon: ShieldCheck },
    { id: 'languages', label: 'Languages', icon: Languages },
    { id: 'ai_review', label: 'AI Review', icon: Sparkles },
  ];

  const currentNavIndex = SECTIONS_NAV.findIndex((s) => s.id === activeTab);
  const activeTemplateId = resume.template_id?.toLowerCase() || 'modern';
  const styling = resume.styling || {
    font_family: 'Inter',
    font_size: 'md',
    line_spacing: 1.3,
    margins: 'normal',
    accent_color: '#635BFF',
    section_spacing: 'normal',
  };

  return (
    <div className="resume-editor-layout flex-1 flex flex-col h-full w-full min-h-0 overflow-hidden bg-[#F8FAFC]">
      {/* TOP HEADER BAR (Matching Reference Screen 2) */}
      <div className="no-print h-16 bg-[#FFFFFF] border-b border-[#E5E7EB] px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 z-20 shadow-xs">
        {/* Left: Back Button + Title + Subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            disabled={isNavigatingBack}
            aria-label="Back to My Resumes"
            title="Back to My Resumes"
            className="w-10 h-10 rounded-[12px] border border-[#E5E7EB] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#111827] hover:text-[#635BFF] flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-50"
          >
            {isNavigatingBack ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#635BFF]" />
            ) : (
              <ArrowLeft className="w-4 h-4" />
            )}
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-semibold text-[#111827] tracking-tight leading-tight truncate">
                Resume Editor
              </h1>
              {/* AutoSave status chip */}
              <span className="hidden sm:inline-flex items-center gap-1 text-[12px] text-[#64748B] font-normal ml-1">
                {saveStatus === 'saving' && (
                  <span className="text-[#635BFF] flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#635BFF] animate-pulse" /> Saving...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-[#16A37B] flex items-center gap-1 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" /> Saved {lastSavedTime ? `· ${lastSavedTime}` : ''}
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-rose-500 font-medium">Save error</span>
                )}
              </span>
            </div>
            <p className="text-[12px] font-normal text-[#64748B] truncate">Customize your resume with ease</p>
          </div>
        </div>

        {/* Center: Mobile View Toggle (Edit vs Preview) */}
        <div className="flex md:hidden items-center bg-[#F8FAFC] p-0.5 rounded-[12px] border border-[#E5E7EB] text-xs font-semibold">
          <button
            onClick={() => setMobileView('edit')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-[8px] ${
              mobileView === 'edit' ? 'bg-[#FFFFFF] text-[#635BFF] shadow-xs' : 'text-[#64748B]'
            }`}
          >
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => setMobileView('preview')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-[8px] ${
              mobileView === 'preview' ? 'bg-[#FFFFFF] text-[#635BFF] shadow-xs' : 'text-[#64748B]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
        </div>

        {/* Right Action Buttons (Save Draft, Preview, Download) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="hidden sm:inline-flex items-center h-[40px] px-4 rounded-[12px] border border-[#E5E7EB] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#111827] text-[14px] font-semibold shadow-2xs transition-all active:scale-95"
          >
            Save Draft
          </button>

          <button
            type="button"
            onClick={handlePreviewNavigate}
            className="inline-flex items-center gap-1.5 h-[40px] px-4 rounded-[12px] border border-[#E5E7EB] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#111827] text-[14px] font-semibold shadow-2xs transition-all active:scale-95"
          >
            <Eye className="w-4 h-4 text-[#64748B]" />
            <span>Preview</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 h-[40px] px-5 rounded-[12px] bg-[#635BFF] hover:bg-[#5046E5] text-white text-[14px] font-semibold shadow-xs transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
          >
            {isDownloading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* MAIN 2-COLUMN WORKSPACE */}
      <div className="resume-editor-main flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT COLUMN: 3 Tabs (Templates | Sections | Design) */}
        <div
          className={`no-print w-full md:w-1/2 xl:w-5/12 flex flex-col bg-[#FFFFFF] border-r border-[#E5E7EB] h-full min-h-0 overflow-hidden ${
            mobileView === 'preview' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Main 3-Tab Header (Templates | Sections | Design) */}
          <div className="border-b border-[#E5E7EB] bg-[#FFFFFF] px-6 shrink-0 flex items-center justify-between">
            <div className="flex gap-8">
              <button
                type="button"
                onClick={() => setMainTab('templates')}
                className={`py-3.5 text-[14px] font-semibold transition-all relative ${
                  mainTab === 'templates'
                    ? 'text-[#635BFF]'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                <span>Templates</span>
                {mainTab === 'templates' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#635BFF] rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setMainTab('sections')}
                className={`py-3.5 text-[14px] font-semibold transition-all relative ${
                  mainTab === 'sections'
                    ? 'text-[#635BFF]'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                <span>Sections</span>
                {mainTab === 'sections' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#635BFF] rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setMainTab('design')}
                className={`py-3.5 text-[14px] font-semibold transition-all relative ${
                  mainTab === 'design'
                    ? 'text-[#635BFF]'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                <span>Design</span>
                {mainTab === 'design' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#635BFF] rounded-full" />
                )}
              </button>
            </div>

            {/* Rename Resume Input */}
            <div className="hidden lg:flex items-center gap-1 max-w-[180px]">
              <input
                type="text"
                value={resume.resume_name}
                onChange={(e) => updateSection('resume_name', e.target.value)}
                className="h-[36px] text-[13px] font-normal text-[#111827] bg-[#F8FAFC] border border-[#E5E7EB] rounded-[8px] px-2.5 outline-none focus:border-[#635BFF] truncate w-full"
                title="Resume title"
              />
            </div>
          </div>

          {/* TAB 1: TEMPLATES GRID (2x3 Grid matching Screen 2) */}
          {mainTab === 'templates' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-[20px]">
              <div className="mb-4">
                <h3 className="text-[16px] font-semibold text-[#111827]">
                  Select a Template
                </h3>
                <p className="text-[12px] font-normal text-[#64748B]">
                  Click any template to instantly update your resume layout
                </p>
              </div>

              <div className="grid grid-cols-2 gap-[20px]">
                {TEMPLATES.map((tmpl) => {
                  const isSelected = activeTemplateId === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => updateSection('template_id', tmpl.id)}
                      className={`relative rounded-[12px] border cursor-pointer p-3 transition-all flex flex-col justify-between group ${
                        isSelected
                          ? 'border-2 border-[#635BFF] bg-indigo-50/15 shadow-sm'
                          : 'border-[#E5E7EB] hover:border-[#635BFF] bg-[#FFFFFF] hover:shadow-xs'
                      }`}
                    >
                      {/* Miniature Document Wireframe Preview */}
                      <div className="h-36 bg-[#F8FAFC] rounded-[8px] border border-[#E5E7EB] p-2.5 flex flex-col justify-between relative overflow-hidden group-hover:border-indigo-100">
                        {/* Wireframe Header */}
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-300 shrink-0" />
                          <div className="space-y-1 flex-1">
                            <div className="w-16 h-1.5 bg-slate-300 rounded-full" />
                            <div className="w-10 h-1 bg-slate-200 rounded-full" />
                          </div>
                        </div>

                        {/* Wireframe Sections */}
                        <div className="space-y-1.5 py-1">
                          <div className="w-full h-1 bg-slate-200 rounded-full" />
                          <div className="w-5/6 h-1 bg-slate-200 rounded-full" />
                          <div className="w-4/6 h-1 bg-slate-200 rounded-full" />

                          <div className="pt-1 flex gap-1">
                            <div className="w-8 h-2.5 rounded bg-slate-200" />
                            <div className="w-8 h-2.5 rounded bg-slate-200" />
                            <div className="w-8 h-2.5 rounded bg-indigo-100" />
                          </div>
                        </div>

                        <div className="w-20 h-1 bg-slate-200 rounded-full" />

                        {/* Selected Checkmark Badge (Bottom Right Circle Checkmark as in Screen 2) */}
                        {isSelected && (
                          <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-[#635BFF] text-white flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-[#111827] truncate">
                          {tmpl.name}
                        </span>
                        <span className="text-[11px] font-normal text-[#64748B] capitalize">
                          {tmpl.id}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SECTIONS FORM EDITOR */}
          {mainTab === 'sections' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Horizontal Section Selector Tabs */}
              <div className="border-b border-[#E5E7EB] bg-[#F8FAFC] overflow-x-auto no-scrollbar shrink-0 px-2 py-1.5 flex gap-1">
                {SECTIONS_NAV.map((s) => {
                  const Icon = s.icon;
                  const isActive = activeTab === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveTab(s.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-[#635BFF] text-white shadow-xs'
                          : 'text-[#64748B] hover:text-[#635BFF] hover:bg-indigo-50/50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Section Form Body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
                {activeTab === 'personal_info' && (
                  <PersonalInfoSection
                    data={resume.personal_info}
                    onChange={(pi) => updateSection('personal_info', pi)}
                  />
                )}

                {activeTab === 'summary' && (
                  <SummarySection
                    summary={resume.professional_summary}
                    resumeId={resume._id}
                    targetRole={resume.target_role}
                    onChange={(s) => updateSection('professional_summary', s)}
                  />
                )}

                {activeTab === 'education' && (
                  <EducationSection
                    education={resume.education}
                    onChange={(e) => updateSection('education', e)}
                  />
                )}

                {activeTab === 'skills' && (
                  <SkillsSection
                    skills={resume.skills}
                    resumeId={resume._id}
                    targetRole={resume.target_role}
                    onChange={(sk) => updateSection('skills', sk)}
                  />
                )}

                {activeTab === 'experience' && (
                  <ExperienceSection
                    experience={resume.experience}
                    resumeId={resume._id}
                    onChange={(exp) => updateSection('experience', exp)}
                  />
                )}

                {activeTab === 'internships' && (
                  <InternshipSection
                    internships={resume.internships}
                    resumeId={resume._id}
                    onChange={(i) => updateSection('internships', i)}
                  />
                )}

                {activeTab === 'projects' && (
                  <ProjectSection
                    projects={resume.projects}
                    resumeId={resume._id}
                    onChange={(p) => updateSection('projects', p)}
                  />
                )}

                {activeTab === 'certifications' && (
                  <CertificationSection
                    certifications={resume.certifications}
                    onChange={(c) => updateSection('certifications', c)}
                  />
                )}

                {activeTab === 'languages' && (
                  <LanguageInterestsSection
                    languages={resume.languages}
                    interests={resume.interests}
                    onChangeLanguages={(l) => updateSection('languages', l)}
                    onChangeInterests={(i) => updateSection('interests', i)}
                  />
                )}

                {activeTab === 'ai_review' && (
                  <AIReviewPanel
                    resumeId={resume._id}
                    onNavigateSection={(sec) => {
                      if (sec === 'summary') setActiveTab('summary');
                      else if (sec === 'experience') setActiveTab('experience');
                      else if (sec === 'project') setActiveTab('projects');
                      else if (sec === 'skills') setActiveTab('skills');
                      else if (sec === 'preview') setMobileView('preview');
                    }}
                  />
                )}
              </div>

              {/* Step Navigation Footer */}
              <div className="h-12 border-t border-slate-200 px-4 bg-slate-50/70 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  disabled={currentNavIndex <= 0}
                  onClick={() => {
                    const prev = SECTIONS_NAV[currentNavIndex - 1];
                    if (prev) setActiveTab(prev.id);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#111827] disabled:opacity-30 disabled:hover:text-slate-600 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <span className="text-[11px] text-slate-500 font-medium">
                  {currentNavIndex + 1} of {SECTIONS_NAV.length}
                </span>

                <button
                  type="button"
                  disabled={currentNavIndex >= SECTIONS_NAV.length - 1}
                  onClick={() => {
                    const next = SECTIONS_NAV[currentNavIndex + 1];
                    if (next) setActiveTab(next.id);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] disabled:opacity-30 disabled:hover:text-[#4F46E5] transition-colors"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DESIGN CONTROLS */}
          {mainTab === 'design' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-[20px] space-y-6">
              {/* Typography / Font Family */}
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-[#635BFF]" />
                  <span>Typography</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {FONTS.map((font) => (
                    <button
                      key={font}
                      type="button"
                      onClick={() => updateStyling({ font_family: font })}
                      style={{ fontFamily: font }}
                      className={`w-full p-3 rounded-[12px] border text-left text-[14px] font-medium transition-all flex items-center justify-between ${
                        styling.font_family === font
                          ? 'border-[#635BFF] bg-indigo-50/20 text-[#635BFF] shadow-2xs font-semibold'
                          : 'border-[#E5E7EB] hover:border-[#635BFF] text-[#111827] bg-[#FFFFFF]'
                      }`}
                    >
                      <span>{font}</span>
                      {styling.font_family === font && <Check className="w-4 h-4 text-[#635BFF]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color Palette */}
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#635BFF]" />
                  <span>Accent Color</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {ACCENT_COLORS.map((col) => (
                    <button
                      key={col.hex}
                      type="button"
                      onClick={() => updateStyling({ accent_color: col.hex })}
                      className={`p-2.5 rounded-[12px] border flex items-center gap-2 text-[13px] font-medium transition-all ${
                        styling.accent_color === col.hex
                          ? 'border-2 border-[#635BFF] bg-indigo-50/20 text-[#635BFF] font-semibold'
                          : 'border-[#E5E7EB] hover:border-[#635BFF] text-[#111827] bg-[#FFFFFF]'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-2xs border border-white"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span className="truncate">{col.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size & Margins */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[#111827] uppercase tracking-wider">
                    Font Sizing
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['sm', 'md', 'lg'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => updateStyling({ font_size: sz })}
                        className={`h-[40px] rounded-[12px] border text-[13px] font-medium capitalize transition-all ${
                          styling.font_size === sz
                            ? 'bg-[#635BFF] text-white border-[#635BFF] shadow-xs font-semibold'
                            : 'bg-[#FFFFFF] border-[#E5E7EB] text-[#111827] hover:border-[#635BFF]'
                        }`}
                      >
                        {sz === 'sm' ? 'Compact' : sz === 'md' ? 'Default' : 'Large'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[#111827] uppercase tracking-wider">
                    Margins
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['compact', 'normal', 'spacious'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => updateStyling({ margins: m })}
                        className={`h-[40px] rounded-[12px] border text-[13px] font-medium capitalize transition-all ${
                          styling.margins === m
                            ? 'bg-[#635BFF] text-white border-[#635BFF] shadow-xs font-semibold'
                            : 'bg-[#FFFFFF] border-[#E5E7EB] text-[#111827] hover:border-[#635BFF]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Live Document Canvas Preview */}
        <div
          className={`resume-preview-column w-full md:w-1/2 xl:w-7/12 h-full min-h-0 overflow-hidden ${
            mobileView === 'edit' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ResumePreview
            resume={resume}
            onTemplateChange={(tid) => updateSection('template_id', tid)}
            onStylingChange={(st) => updateSection('styling', st)}
            onRestoreVersion={(restored) => {
              setResume(restored);
              resumeRef.current = restored;
            }}
          />
        </div>
      </div>

      {/* Confirmation Modal for Unsaved Changes */}
      <ConfirmDialog
        open={showUnsavedConfirm}
        title="Leave without saving?"
        message="We encountered an issue saving your latest changes to this resume. If you leave now, recent edits may not be saved."
        confirmText="Leave Anyway"
        cancelText="Stay and Try Again"
        variant="danger"
        onConfirm={() => {
          setShowUnsavedConfirm(false);
          navigate('/jobs/student/resume-builder');
        }}
        onCancel={() => setShowUnsavedConfirm(false)}
      />

      {/* Demo Profile Modal */}
      <ConfirmDialog
        open={showDemoConfirm}
        title="Load Example Profile?"
        message="This will populate your resume with a complete, realistic profile: Ananya Sharma (Full Stack Developer, Hyderabad). Any unsaved edits will be replaced."
        confirmText="Yes, Load Example"
        cancelText="Cancel"
        variant="default"
        loading={isLoadingDemo}
        onConfirm={handleLoadDemo}
        onCancel={() => setShowDemoConfirm(false)}
      />
    </div>
  );
};
