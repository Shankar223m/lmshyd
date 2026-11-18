import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useNotify } from "@/core/hooks/useNotify";
import {
  useCreateResumeMutation,
  useListResumeTemplatesQuery,
} from "@/modules/career/resumes/api/resumesApi";
import { Badge, Button, PageHeader, PageLoader } from "@/shared/ui";
import { cn } from "@/core/lib/cn";

export function ResumeTemplatesPage() {
  const navigate = useNavigate();
  const notify = useNotify();

  const { isLoading } = useListResumeTemplatesQuery();
  const [createResume, { isLoading: isCreating }] = useCreateResumeMutation();

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("modern");
  const targetRole = "Software Engineer";

  const templatesList = [
    {
      key: "modern",
      name: "Modern Indigo",
      category: "Tech & Software",
      description: "Clean sans-serif typography with electric indigo section dividers. Ideal for tech, product, and engineering roles.",
      atsRating: "100% ATS Compliant",
      font: "Inter / Plus Jakarta Sans",
      layout: "Single-column structural hierarchy",
      accent: "#4f46e5",
      previewData: {
        name: "Alex Morgan",
        role: "Full Stack Engineer",
        contact: "alex.morgan@email.com • +91 98765 43210 • Bangalore, India",
        summary: "Forward-thinking software engineer with 3+ years experience building cloud-native web applications with React, TypeScript, and FastAPI.",
        skills: "TypeScript, Python, React, FastAPI, PostgreSQL, Docker, AWS",
        experience: "Software Engineer at TechGlobal Inc (2023 - Present)\n• Designed RESTful microservices reducing latency by 32%\n• Mentored 4 junior engineers in test-driven development",
      },
    },
    {
      key: "classic",
      name: "Classic Academic",
      category: "General & Academic",
      description: "Traditional serif styling, centered header, elegant rule dividers. Proven format preferred by enterprise recruiters.",
      atsRating: "100% ATS Compliant",
      font: "Times-Roman / Georgia",
      layout: "Centered header with horizontal rules",
      accent: "#0f172a",
      previewData: {
        name: "Alex Morgan",
        role: "Full Stack Engineer",
        contact: "alex.morgan@email.com • +91 98765 43210 • Bangalore, India",
        summary: "Forward-thinking software engineer with 3+ years experience building cloud-native web applications with React, TypeScript, and FastAPI.",
        skills: "TypeScript, Python, React, FastAPI, PostgreSQL, Docker, AWS",
        experience: "Software Engineer at TechGlobal Inc (2023 - Present)\n• Designed RESTful microservices reducing latency by 32%\n• Mentored 4 junior engineers in test-driven development",
      },
    },
    {
      key: "compact",
      name: "Compact Minimal",
      category: "High-Density",
      description: "Optimized spacing and concise leading designed to fit extensive project and work experience onto a clean single page.",
      atsRating: "100% ATS Compliant",
      font: "Helvetica / Inter",
      layout: "Tight leading with maximum information density",
      accent: "#000000",
      previewData: {
        name: "Alex Morgan",
        role: "Full Stack Engineer",
        contact: "alex.morgan@email.com • +91 98765 43210 • Bangalore, India",
        summary: "Forward-thinking software engineer with 3+ years experience building cloud-native web applications with React, TypeScript, and FastAPI.",
        skills: "TypeScript, Python, React, FastAPI, PostgreSQL, Docker, AWS",
        experience: "Software Engineer at TechGlobal Inc (2023 - Present)\n• Designed RESTful microservices reducing latency by 32%\n• Mentored 4 junior engineers in test-driven development",
      },
    },
    {
      key: "executive",
      name: "Executive Slate",
      category: "Leadership & Senior",
      description: "Subtle tinted top banner, crisp dual-tier section headers, balanced margin allocation for experienced candidates.",
      atsRating: "100% ATS Compliant",
      font: "Plus Jakarta Sans",
      layout: "Subtle banner header with distinct section borders",
      accent: "#1e293b",
      previewData: {
        name: "Alex Morgan",
        role: "Full Stack Engineer",
        contact: "alex.morgan@email.com • +91 98765 43210 • Bangalore, India",
        summary: "Forward-thinking software engineer with 3+ years experience building cloud-native web applications with React, TypeScript, and FastAPI.",
        skills: "TypeScript, Python, React, FastAPI, PostgreSQL, Docker, AWS",
        experience: "Software Engineer at TechGlobal Inc (2023 - Present)\n• Designed RESTful microservices reducing latency by 32%\n• Mentored 4 junior engineers in test-driven development",
      },
    },
  ];

  if (isLoading) return <PageLoader />;

  const handleUseTemplate = async (templateKey: string) => {
    try {
      const created = await createResume({
        title: `My ${templateKey.toUpperCase()} Resume`,
        target_role: targetRole,
        experience_level: "mid",
        template_key: templateKey,
        blank: false,
      }).unwrap();

      notify.success("Resume created with selected template!");
      navigate(`/career/resumes/${created.resume_id}`);
    } catch (err) {
      notify.apiError(err, "Failed to create resume");
    }
  };

  const selectedTemplate = templatesList.find((t) => t.key === selectedTemplateKey) ?? templatesList[0]!;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <PageHeader
        title="Resume Template Gallery"
        description="Every template is single-column plain text with standard headings, fully verified for flawless ATS machine readability."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/career/resumes")}>
              My Resumes
            </Button>
            <Button icon="plus" onClick={() => navigate("/career/resumes/create")}>
              Create Wizard
            </Button>
          </div>
        }
      />

      {/* Template Cards Grid */}
      <div className="grid gap-6 lg:grid-cols-4">
        {templatesList.map((tpl) => {
          const isSelected = tpl.key === selectedTemplateKey;
          return (
            <div
              key={tpl.key}
              onClick={() => setSelectedTemplateKey(tpl.key)}
              className={cn(
                "group flex cursor-pointer flex-col justify-between rounded-2xl border bg-white p-5 transition-all shadow-card hover:-translate-y-0.5",
                isSelected
                  ? "border-brand-600 ring-2 ring-brand-100 shadow-lift"
                  : "border-slate-200/80 hover:border-slate-300"
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge tone={isSelected ? "indigo" : "gray"}>{tpl.category}</Badge>
                  <span className="flex h-3 w-3 rounded-full" style={{ backgroundColor: tpl.accent }} />
                </div>

                <h2 className="text-base font-bold text-navy-950">{tpl.name}</h2>
                <p className="text-xs text-slate-500 leading-relaxed">{tpl.description}</p>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Typography:</span>
                    <span className="font-medium text-slate-800">{tpl.font}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Compliance:</span>
                    <span className="font-semibold text-emerald-600">{tpl.atsRating}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100">
                <Button
                  size="sm"
                  variant={isSelected ? "primary" : "secondary"}
                  className="w-full"
                  loading={isCreating && isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseTemplate(tpl.key);
                  }}
                >
                  Use Template
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Interactive Preview Box */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-navy-950">Live Preview: {selectedTemplate.name}</h2>
            <p className="text-xs text-slate-500">
              Previewing formatting, font styling, and section rules with candidate sample data.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              icon="plus"
              loading={isCreating}
              onClick={() => handleUseTemplate(selectedTemplate.key)}
            >
              Build Resume with {selectedTemplate.name}
            </Button>
          </div>
        </div>

        {/* Paper Container */}
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          {selectedTemplate.key === "classic" && (
            <div className="space-y-4 font-serif text-slate-900 text-xs">
              <div className="text-center pb-3 border-b border-slate-900">
                <h1 className="text-xl font-bold tracking-tight">{selectedTemplate.previewData.name}</h1>
                <p className="italic text-slate-700 mt-0.5">{selectedTemplate.previewData.role}</p>
                <p className="text-[11px] text-slate-600 mt-1">{selectedTemplate.previewData.contact}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-wider text-[11px] border-b border-slate-300 pb-0.5 mb-1.5">
                  Professional Summary
                </h2>
                <p className="leading-relaxed text-slate-800">{selectedTemplate.previewData.summary}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-wider text-[11px] border-b border-slate-300 pb-0.5 mb-1.5">
                  Technical Skills
                </h2>
                <p className="leading-relaxed text-slate-800">{selectedTemplate.previewData.skills}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-wider text-[11px] border-b border-slate-300 pb-0.5 mb-1.5">
                  Work Experience
                </h2>
                <p className="whitespace-pre-line leading-relaxed text-slate-800">
                  {selectedTemplate.previewData.experience}
                </p>
              </div>
            </div>
          )}

          {selectedTemplate.key === "modern" && (
            <div className="space-y-4 font-sans text-slate-900 text-xs">
              <div className="pb-3 border-b-2 border-indigo-600">
                <h1 className="text-2xl font-black text-indigo-950 tracking-tight">
                  {selectedTemplate.previewData.name}
                </h1>
                <p className="font-semibold text-indigo-700 mt-0.5">{selectedTemplate.previewData.role}</p>
                <p className="text-[11px] text-slate-500 mt-1">{selectedTemplate.previewData.contact}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-wider text-[11px] text-indigo-700 mb-1">
                  Professional Summary
                </h2>
                <p className="leading-relaxed text-slate-700">{selectedTemplate.previewData.summary}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-wider text-[11px] text-indigo-700 mb-1">
                  Core Skills
                </h2>
                <p className="leading-relaxed text-slate-700">{selectedTemplate.previewData.skills}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-wider text-[11px] text-indigo-700 mb-1">
                  Experience
                </h2>
                <p className="whitespace-pre-line leading-relaxed text-slate-700">
                  {selectedTemplate.previewData.experience}
                </p>
              </div>
            </div>
          )}

          {selectedTemplate.key === "compact" && (
            <div className="space-y-3 font-sans text-slate-900 text-[11px] leading-tight">
              <div className="flex justify-between items-baseline pb-2 border-b border-slate-300">
                <div>
                  <h1 className="text-lg font-bold">{selectedTemplate.previewData.name}</h1>
                  <p className="text-slate-600">{selectedTemplate.previewData.role}</p>
                </div>
                <p className="text-[10px] text-slate-500 text-right">{selectedTemplate.previewData.contact}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase text-[10px] tracking-wide text-slate-700">Summary</h2>
                <p className="mt-0.5 text-slate-700">{selectedTemplate.previewData.summary}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase text-[10px] tracking-wide text-slate-700">Skills</h2>
                <p className="mt-0.5 text-slate-700">{selectedTemplate.previewData.skills}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase text-[10px] tracking-wide text-slate-700">Experience</h2>
                <p className="mt-0.5 whitespace-pre-line text-slate-700">
                  {selectedTemplate.previewData.experience}
                </p>
              </div>
            </div>
          )}

          {selectedTemplate.key === "executive" && (
            <div className="space-y-4 font-sans text-slate-900 text-xs">
              <div className="rounded-lg bg-slate-900 text-white p-4">
                <h1 className="text-xl font-bold tracking-tight">{selectedTemplate.previewData.name}</h1>
                <p className="text-slate-300 text-xs mt-0.5">{selectedTemplate.previewData.role}</p>
                <p className="text-[11px] text-slate-400 mt-1">{selectedTemplate.previewData.contact}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-wider text-[11px] text-slate-900 border-b border-slate-200 pb-1 mb-1.5">
                  Executive Profile
                </h2>
                <p className="leading-relaxed text-slate-700">{selectedTemplate.previewData.summary}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-wider text-[11px] text-slate-900 border-b border-slate-200 pb-1 mb-1.5">
                  Core Competencies
                </h2>
                <p className="leading-relaxed text-slate-700">{selectedTemplate.previewData.skills}</p>
              </div>
              <div>
                <h2 className="font-bold uppercase tracking-wider text-[11px] text-slate-900 border-b border-slate-200 pb-1 mb-1.5">
                  Professional Experience
                </h2>
                <p className="whitespace-pre-line leading-relaxed text-slate-700">
                  {selectedTemplate.previewData.experience}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
