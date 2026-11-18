import { useState } from "react";
import { useNotify } from "@/core/hooks/useNotify";
import { Button, PageHeader } from "@/shared/ui";
import { jcmsService } from "../jcmsService";
import type { PipelineCandidate } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { KpiCard } from "../components/KpiCard";

export function CandidateReviewPage() {
  const notify = useNotify();
  const [candidates, setCandidates] = useState<PipelineCandidate[]>(() =>
    jcmsService.getPipelineCandidates()
  );

  const [search, setSearch] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<PipelineCandidate | null>(
    candidates[0] || null
  );
  const [noteText, setNoteText] = useState("");

  const filtered = candidates.filter(
    (c) =>
      c.student_name.toLowerCase().includes(search.toLowerCase()) ||
      c.program.toLowerCase().includes(search.toLowerCase()) ||
      c.institution_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveNote = () => {
    if (!selectedCandidate) return;
    jcmsService.updateCandidateStage(
      selectedCandidate.id,
      selectedCandidate.pipeline_stage,
      noteText
    );
    setCandidates(jcmsService.getPipelineCandidates());
    notify.success("Recruiter note saved successfully!");
  };

  const handleAdvance = (stage: PipelineCandidate["pipeline_stage"]) => {
    if (!selectedCandidate) return;
    jcmsService.updateCandidateStage(selectedCandidate.id, stage, noteText);
    const updated = jcmsService.getPipelineCandidates();
    setCandidates(updated);
    setSelectedCandidate(updated.find((c) => c.id === selectedCandidate.id) || null);
    notify.success(`Advanced candidate to ${stage}!`);
  };

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Candidate Review Queue"
        description="Comprehensive evaluation workspace to inspect candidate resumes, academic performance, and scoring."
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total Applicants"
          value={candidates.length}
          subtitle="In evaluation pipeline"
          accent="indigo"
        />
        <KpiCard
          label="Top Matches (90%+)"
          value={candidates.filter((c) => c.match_percent >= 90).length}
          subtitle="High alignment profiles"
          accent="success"
        />
        <KpiCard
          label="Average CGPA"
          value={(
            candidates.reduce((acc, c) => acc + c.cgpa, 0) / (candidates.length || 1)
          ).toFixed(1)}
          subtitle="Out of 10.0 scale"
          accent="default"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left List: Candidates */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by name, college, or degree..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs"
            />
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto">
            {filtered.map((c) => {
              const isSelected = selectedCandidate?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCandidate(c);
                    setNoteText(c.internal_note || "");
                  }}
                  className={`group cursor-pointer rounded-2xl border p-4 transition-all shadow-2xs ${
                    isSelected
                      ? "border-brand-600 bg-brand-50/20 ring-1 ring-brand-500 shadow-lift"
                      : "border-slate-200/80 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-navy-950">{c.student_name}</h4>
                      <p className="text-xs text-slate-500">{c.program}</p>
                    </div>
                    <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-100">
                      {c.match_percent}%
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{c.institution_name}</span>
                    <StatusBadge status={c.pipeline_stage} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detail Pane */}
        <div className="space-y-6 lg:col-span-7">
          {selectedCandidate ? (
            <div className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-navy-950">
                    {selectedCandidate.student_name}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedCandidate.program}</p>
                  <p className="text-xs text-slate-400">{selectedCandidate.institution_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedCandidate.pipeline_stage} />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <span className="text-slate-400 font-medium block">Academic CGPA</span>
                  <span className="text-base font-bold text-slate-800">
                    {selectedCandidate.cgpa} / 10.0
                  </span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <span className="text-slate-400 font-medium block">Graduation Year</span>
                  <span className="text-base font-bold text-slate-800">
                    {selectedCandidate.graduation_year}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <span className="text-slate-400 font-medium block">Role Compatibility</span>
                  <span className="text-base font-bold text-emerald-700">
                    {selectedCandidate.match_percent}% ATS fit
                  </span>
                </div>
              </div>

              {/* Verified Skills */}
              {selectedCandidate.skills && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Verified Technical Skills
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCandidate.skills.map((sk) => (
                      <span
                        key={sk}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recruiter Evaluation Notes */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Recruiter Confidential Note
                </h4>
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Record strengths, interview feedback, or cultural observations..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed"
                />
                <Button variant="secondary" size="sm" onClick={handleSaveNote}>
                  Save Note
                </Button>
              </div>

              {/* Actions Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAdvance("Rejected")}
                >
                  Reject Candidate
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAdvance("Assessment")}
                  >
                    Send Assessment
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAdvance("Interview")}
                  >
                    Invite to Interview →
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center text-sm text-slate-400">
              Select a candidate from the left list to review profile and evaluation metrics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
