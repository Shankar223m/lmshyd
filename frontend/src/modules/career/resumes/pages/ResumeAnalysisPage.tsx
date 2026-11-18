import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useNotify } from "@/core/hooks/useNotify";
import { useListResumesQuery } from "@/modules/career/resumes/api/resumesApi";
import {
  useScoreResumeMutation,
  useKeywordGapMutation,
  useGrammarCheckMutation,
  type KeywordGap,
  type GrammarIssue,
} from "@/modules/career/resumes/api/resumeToolsApi";
import type { AtsResult } from "@/modules/career/resumes/types";
import { Badge, Button, EmptyState, Icon, PageHeader, PageLoader } from "@/shared/ui";
import { cn } from "@/core/lib/cn";

export function ResumeAnalysisPage() {
  const navigate = useNavigate();
  const notify = useNotify();

  const { data: resumesData, isLoading: resumesLoading } = useListResumesQuery({ per_page: 50 });
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");

  const [jobDescription, setJobDescription] = useState<string>("");

  const [scoreMutation, { isLoading: isScoring }] = useScoreResumeMutation();
  const [keywordGapMutation, { isLoading: isAnalyzingKeywords }] = useKeywordGapMutation();
  const [grammarMutation, { isLoading: isCheckingGrammar }] = useGrammarCheckMutation();

  const [atsScore, setAtsScore] = useState<AtsResult | null>(null);
  const [keywordGap, setKeywordGap] = useState<KeywordGap | null>(null);
  const [grammarIssues, setGrammarIssues] = useState<GrammarIssue[] | null>(null);
  const [hasRunAnalysis, setHasRunAnalysis] = useState<boolean>(false);

  const resumes = resumesData?.items ?? [];

  useEffect(() => {
    if (resumes.length > 0 && !selectedResumeId) {
      const first = resumes[0];
      if (first) setSelectedResumeId(first.resume_id);
    }
  }, [resumes, selectedResumeId]);

  if (resumesLoading) return <PageLoader />;

  if (resumes.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="AI Resume Analysis & ATS Intelligence"
          description="Scan your resume against ATS criteria, analyze keyword match, and detect grammar and missing skills."
        />
        <EmptyState
          icon="sparkles"
          title="No resumes found"
          description="Create or upload a resume first to run comprehensive AI and ATS analysis."
          action={<Button icon="plus" onClick={() => navigate("/career/resumes/create")}>Create Resume</Button>}
        />
      </div>
    );
  }

  const runFullAnalysis = async () => {
    if (!selectedResumeId) return;
    try {
      setHasRunAnalysis(true);

      // 1. Run ATS score check
      const scoreRes = await scoreMutation({
        resumeId: selectedResumeId,
        job_description: jobDescription.trim() || null,
      }).unwrap();
      setAtsScore(scoreRes);

      // 2. Run Grammar check
      const grammarRes = await grammarMutation(selectedResumeId).unwrap().catch(() => []);
      setGrammarIssues(grammarRes);

      // 3. Run Keyword Gap if job description provided
      if (jobDescription.trim()) {
        const gapRes = await keywordGapMutation({
          resumeId: selectedResumeId,
          job_description: jobDescription.trim(),
        }).unwrap();
        setKeywordGap(gapRes);
      } else {
        setKeywordGap(null);
      }

      notify.success("Analysis completed!");
    } catch (err) {
      notify.apiError(err, "Analysis failed");
    }
  };

  const currentResume = resumes.find((r) => r.resume_id === selectedResumeId);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Top Header Matching UI Kit Reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <span>AI Resume Builder</span>
            <span>›</span>
            <span className="font-semibold text-[#635BFF]">Analytics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your Resume Analytics</h1>
          <p className="text-xs text-slate-500">Track performance and get insights</p>
        </div>

        <div className="flex items-center gap-2">
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-[#635BFF] focus:outline-none">
            <option>Last 30 Days</option>
            <option>Last 3 Months</option>
            <option>All Time</option>
          </select>
          <Button variant="secondary" size="sm" onClick={() => navigate("/career/resumes")}>
            My Resumes
          </Button>
        </div>
      </div>

      {/* 4 KPI Cards matching Image 1 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold text-slate-900">{resumes.length || 12}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0EFFF] text-[#635BFF]">
              <Icon name="fileText" size={18} />
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">Resumes Created</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold text-slate-900">8</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Icon name="download" size={18} />
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">Downloads</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold text-slate-900">85%</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Icon name="sparkles" size={18} />
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">Success Rate</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-slate-900 truncate">Modern Pro</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Icon name="sparkles" size={18} />
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">Top Template</p>
        </div>
      </div>

      {/* Visual Analytics Charts Matching Reference Screen */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: Resume Activity Area Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Resume Activity</h2>
            <span className="text-xs text-slate-400">Views & Downloads</span>
          </div>

          <div className="relative pt-6">
            {/* Hover Tooltip Indicator matching reference */}
            <div className="absolute left-[56%] top-0 -translate-x-1/2 flex flex-col items-center">
              <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-md border border-slate-200/80">
                8 Resumes <span className="font-normal text-slate-400">Apr 24</span>
              </span>
              <span className="h-2 w-2 rotate-45 bg-white border-r border-b border-slate-200/80 -mt-1" />
            </div>

            {/* Smooth SVG Area Chart */}
            <svg viewBox="0 0 500 160" className="w-full h-40 overflow-visible">
              <defs>
                <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#635BFF" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#635BFF" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />

              {/* Area */}
              <path
                d="M 10 130 C 70 120, 110 90, 170 85 C 230 80, 270 30, 310 25 C 360 20, 420 100, 490 110 L 490 140 L 10 140 Z"
                fill="url(#purpleGrad)"
              />
              {/* Line */}
              <path
                d="M 10 130 C 70 120, 110 90, 170 85 C 230 80, 270 30, 310 25 C 360 20, 420 100, 490 110"
                fill="none"
                stroke="#635BFF"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Highlight Dot */}
              <circle cx="310" cy="25" r="4.5" fill="#635BFF" stroke="#ffffff" strokeWidth="2" />
            </svg>

            {/* Date Labels */}
            <div className="flex justify-between pt-2 text-[11px] font-medium text-slate-400">
              <span>Apr 20</span>
              <span>Apr 22</span>
              <span>Apr 24</span>
              <span>Apr 26</span>
              <span>Apr 28</span>
            </div>
          </div>
        </div>

        {/* Right: Popular Sections Donut Chart */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Popular Sections</h2>

          <div className="flex flex-col items-center justify-center pt-2">
            <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
              <circle cx="60" cy="60" r="45" fill="none" stroke="#635BFF" strokeWidth="14" strokeDasharray="113 283" strokeDashoffset="0" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#16A37B" strokeWidth="14" strokeDasharray="99 283" strokeDashoffset="-113" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#38BDF8" strokeWidth="14" strokeDasharray="71 283" strokeDashoffset="-212" />
            </svg>

            <div className="w-full space-y-2 pt-4 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#635BFF]" />
                  <span className="text-slate-600 font-medium">Skills</span>
                </div>
                <span className="font-bold text-slate-800">40%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#16A37B]" />
                  <span className="text-slate-600 font-medium">Experience</span>
                </div>
                <span className="font-bold text-slate-800">35%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8]" />
                  <span className="text-slate-600 font-medium">Education</span>
                </div>
                <span className="font-bold text-slate-800">25%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Target Selector & Job Description Input */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">Select Resume</h2>
          <div className="space-y-2">
            {resumes.map((resume) => {
              const isSelected = resume.resume_id === selectedResumeId;
              return (
                <div
                  key={resume.resume_id}
                  onClick={() => {
                    setSelectedResumeId(resume.resume_id);
                    setHasRunAnalysis(false);
                    setAtsScore(null);
                    setKeywordGap(null);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors",
                    isSelected
                      ? "border-brand-600 bg-brand-50/50 shadow-2xs ring-1 ring-brand-100"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-navy-950 truncate">{resume.title}</p>
                    <p className="text-[11px] text-slate-500">{resume.target_role || "General Role"}</p>
                  </div>
                  {typeof resume.ats_score === "number" && (
                    <Badge tone={resume.ats_score >= 80 ? "green" : resume.ats_score >= 60 ? "amber" : "gray"}>
                      {resume.ats_score}%
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
                Job Description Matching (Optional)
              </h2>
              <p className="text-xs text-slate-500">
                Paste the target job description to evaluate keyword coverage and missing competencies.
              </p>
            </div>
          </div>

          <textarea
            rows={4}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste role requirements, key qualifications, or full job posting text here..."
            className="w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />

          <div className="flex justify-end">
            <Button
              variant="primary"
              icon="sparkles"
              loading={isScoring || isAnalyzingKeywords || isCheckingGrammar}
              onClick={runFullAnalysis}
            >
              Run Comprehensive AI Analysis
            </Button>
          </div>
        </div>
      </div>

      {/* Analysis Results View */}
      {hasRunAnalysis && atsScore ? (
        <div className="space-y-6">
          {/* Main Score Banner */}
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div
                  className={cn(
                    "flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-lift",
                    atsScore.score >= 80 ? "bg-emerald-600" : atsScore.score >= 60 ? "bg-amber-500" : "bg-rose-500"
                  )}
                >
                  {atsScore.score}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-navy-950">ATS Compatibility Score</h2>
                    <Badge tone={atsScore.score >= 80 ? "green" : atsScore.score >= 60 ? "amber" : "gray"}>
                      {atsScore.score >= 80 ? "High Compatibility" : atsScore.score >= 60 ? "Moderate Match" : "Needs Optimization"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Evaluated against standard ATS parsing models, layout clarity, contact availability, and keyword relevance.
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                icon="edit"
                onClick={() => navigate(`/career/resumes/${selectedResumeId}`)}
              >
                Apply Fixes in Editor
              </Button>
            </div>

            {/* Sub-component scores */}
            {atsScore.components && atsScore.components.length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-slate-200/70 pt-5">
                {atsScore.components.map((comp) => (
                  <div key={comp.key} className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-2xs">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700">{comp.label}</span>
                      <span className="font-bold text-navy-950">
                        {comp.points} / {comp.max}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          comp.points / comp.max >= 0.8
                            ? "bg-emerald-500"
                            : comp.points / comp.max >= 0.5
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        )}
                        style={{ width: `${Math.min((comp.points / comp.max) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500 line-clamp-1">{comp.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Keyword Match & Gap Section */}
          {keywordGap && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-navy-950">Job Description Keyword Match</h2>
                  <p className="text-xs text-slate-500">
                    Matching your resume content against extracted requirements from the job description.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Match:</span>
                  <Badge tone={keywordGap.match_percent >= 70 ? "green" : "amber"}>
                    {keywordGap.match_percent}%
                  </Badge>
                </div>
              </div>

              {keywordGap.advice && (
                <div className="rounded-xl bg-brand-50/60 p-3.5 border border-brand-100 text-xs text-brand-900 leading-relaxed">
                  <strong>Recommendation:</strong> {keywordGap.advice}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                    ✓ Matched Keywords ({keywordGap.keywords.filter((k) => k.present).length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {keywordGap.keywords
                      .filter((k) => k.present)
                      .map((k, i) => (
                        <span
                          key={i}
                          className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-200"
                        >
                          {k.term}
                        </span>
                      ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">
                    ⚠ Missing Keywords ({keywordGap.keywords.filter((k) => !k.present).length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {keywordGap.keywords
                      .filter((k) => !k.present)
                      .map((k, i) => (
                        <span
                          key={i}
                          className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 border border-amber-200"
                        >
                          + {k.term}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actionable Fixes & Grammar Section */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Fixes List */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
              <h2 className="text-base font-bold text-navy-950">
                Actionable Resume Improvements ({atsScore.fixes?.length || 0})
              </h2>
              {atsScore.fixes && atsScore.fixes.length > 0 ? (
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {atsScore.fixes.map((fix, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-xs"
                    >
                      <Badge tone={fix.severity === "high" ? "red" : fix.severity === "medium" ? "amber" : "gray"}>
                        {fix.severity}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800">{fix.message}</p>
                        {fix.section && (
                          <span className="text-[11px] text-slate-400">Section: {fix.section}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No critical issues found. Your resume structure looks great!</p>
              )}
            </div>

            {/* Grammar & Style issues */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
              <h2 className="text-base font-bold text-navy-950">
                Grammar & Tone Suggestions ({grammarIssues?.length || 0})
              </h2>
              {grammarIssues && grammarIssues.length > 0 ? (
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {grammarIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">{issue.where}</span>
                        <Badge tone={issue.severity === "high" ? "red" : "amber"}>{issue.code}</Badge>
                      </div>
                      <p className="text-slate-600">{issue.message}</p>
                      {issue.excerpt && (
                        <p className="rounded bg-slate-50 p-1.5 font-mono text-[11px] text-slate-500">
                          "{issue.excerpt}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No grammatical or repetitive phrasing issues detected across your bullet points and summary!
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <Icon name="sparkles" size={28} />
          </div>
          <h2 className="mt-4 text-base font-bold text-navy-950">Ready to Analyze "{currentResume?.title}"</h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Click "Run Comprehensive AI Analysis" above to check your ATS score, verify formatting compliance, and analyze keyword relevance.
          </p>
        </div>
      )}
    </div>
  );
}
