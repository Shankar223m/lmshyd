import { useState } from "react";
import { useNotify } from "@/core/hooks/useNotify";
import { Button, PageHeader } from "@/shared/ui";
import { jcmsService } from "../jcmsService";
import type { PipelineCandidate } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { KpiCard } from "../components/KpiCard";

const STAGES: PipelineCandidate["pipeline_stage"][] = [
  "Screening",
  "Shortlisted",
  "Assessment",
  "Interview",
  "Selected",
];

export function HiringPipelinePage() {
  const notify = useNotify();
  const [candidates, setCandidates] = useState<PipelineCandidate[]>(() =>
    jcmsService.getPipelineCandidates()
  );

  const [selectedCandidate, setSelectedCandidate] = useState<PipelineCandidate | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PipelineCandidate | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleMoveStage = (candidateId: string, stage: PipelineCandidate["pipeline_stage"]) => {
    jcmsService.updateCandidateStage(candidateId, stage);
    setCandidates(jcmsService.getPipelineCandidates());
    notify.success(`Moved candidate to "${stage}"!`);
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    jcmsService.updateCandidateStage(rejectTarget.id, "Rejected", rejectReason);
    setCandidates(jcmsService.getPipelineCandidates());
    notify.info(`Candidate moved to Rejected`);
    setRejectTarget(null);
    setRejectReason("");
  };

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Hiring Pipeline & Candidate Tracking"
        description="Visual Kanban board to screen, evaluate, interview, and advance applicants."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCandidates(jcmsService.getPipelineCandidates());
                notify.success("Pipeline refreshed");
              }}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Pipeline KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard
          label="Total In Pipeline"
          value={candidates.filter((c) => c.pipeline_stage !== "Rejected").length}
          subtitle="Active applicants"
          accent="indigo"
        />
        <KpiCard
          label="Interview Stage"
          value={candidates.filter((c) => c.pipeline_stage === "Interview").length}
          subtitle="Live technical evaluations"
          accent="warning"
        />
        <KpiCard
          label="Selected"
          value={candidates.filter((c) => c.pipeline_stage === "Selected").length}
          subtitle="Ready for offer"
          accent="success"
        />
        <KpiCard
          label="Avg Match Score"
          value="93%"
          subtitle="Top tier talent pool"
          accent="default"
        />
      </div>

      {/* Kanban Board */}
      <div className="grid gap-4 overflow-x-auto pb-6 lg:grid-cols-5 min-w-[1000px]">
        {STAGES.map((stage) => {
          const stageCandidates = candidates.filter((c) => c.pipeline_stage === stage);

          return (
            <div
              key={stage}
              className="flex flex-col rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-3"
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {stage}
                </span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                  {stageCandidates.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {stageCandidates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                    No candidates
                  </div>
                ) : (
                  stageCandidates.map((cand) => (
                    <div
                      key={cand.id}
                      onClick={() => setSelectedCandidate(cand)}
                      className="group cursor-pointer rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all hover:border-brand-500 hover:shadow-card space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <h4 className="text-sm font-bold text-navy-950 group-hover:text-brand-600 transition-colors">
                            {cand.student_name}
                          </h4>
                          <p className="text-[11px] text-slate-400">{cand.institution_name}</p>
                        </div>
                        <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                          {cand.match_percent}% match
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-medium">
                        CGPA: <strong className="text-slate-800">{cand.cgpa}</strong> • Grad:{" "}
                        {cand.graduation_year}
                      </div>

                      {/* Skills Tags */}
                      {cand.skills && (
                        <div className="flex flex-wrap gap-1">
                          {cand.skills.slice(0, 3).map((sk) => (
                            <span
                              key={sk}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Stage Advance Dropdown */}
                      <div
                        className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={cand.pipeline_stage}
                          onChange={(e) =>
                            handleMoveStage(
                              cand.id,
                              e.target.value as PipelineCandidate["pipeline_stage"]
                            )
                          }
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              Move: {s}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => setRejectTarget(cand)}
                          className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Candidate Profile Details Drawer / Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xl font-bold text-navy-950">
                  {selectedCandidate.student_name}
                </h3>
                <p className="text-xs text-slate-500">{selectedCandidate.program}</p>
                <p className="text-xs text-slate-400">{selectedCandidate.institution_name}</p>
              </div>
              <StatusBadge status={selectedCandidate.pipeline_stage} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-slate-400 block font-medium">Email Address:</span>
                <span className="font-semibold text-slate-800">
                  {selectedCandidate.student_email}
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-slate-400 block font-medium">Academic CGPA:</span>
                <span className="font-semibold text-slate-800">{selectedCandidate.cgpa} / 10</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-slate-400 block font-medium">Graduation Year:</span>
                <span className="font-semibold text-slate-800">
                  {selectedCandidate.graduation_year}
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-slate-400 block font-medium">Role Match Score:</span>
                <span className="font-bold text-emerald-700">
                  {selectedCandidate.match_percent}% ATS fit
                </span>
              </div>
            </div>

            {selectedCandidate.skills && (
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1.5">
                  Verified Technical Skills:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCandidate.skills.map((sk) => (
                    <span
                      key={sk}
                      className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 border border-brand-100"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedCandidate.internal_note && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <strong className="text-slate-700 block mb-0.5">Recruiter Note:</strong>
                <span className="text-slate-600">{selectedCandidate.internal_note}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedCandidate(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-navy-950">Reject Candidate Application?</h3>
            <p className="text-xs text-slate-600">
              Candidate: <strong>{rejectTarget.student_name}</strong>
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Reason / Internal Feedback:
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Insufficient experience with concurrent programming..."
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setRejectTarget(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleReject}>
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
