import { useState } from "react";
import { useNotify } from "@/core/hooks/useNotify";
import { Button, PageHeader } from "@/shared/ui";
import { jcmsService } from "../jcmsService";
import type { ModerationJob } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { KpiCard } from "../components/KpiCard";

export function JobModerationPage() {
  const notify = useNotify();
  const [tab, setTab] = useState<"queue" | "approved" | "rejected">("queue");
  const [jobs, setJobs] = useState<ModerationJob[]>(() => jcmsService.getModerationJobs(tab));
  const [selectedJob, setSelectedJob] = useState<ModerationJob | null>(null);
  const [moderationNote, setModerationNote] = useState("");

  const handleModerate = (action: "approve" | "reject" | "request_changes") => {
    if (!selectedJob) return;
    jcmsService.moderateJob(selectedJob.id, action, moderationNote);
    setJobs(jcmsService.getModerationJobs(tab));
    setSelectedJob(null);
    setModerationNote("");
    notify.success(`Job posting updated: ${action.replace("_", " ")}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <PageHeader
        title="Job Posting Moderation & Compliance"
        description="Audit corporate postings against platform quality guidelines, non-discrimination policies, and salary standards."
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Pending Review"
          value={jobs.filter((j) => j.status === "PENDING_APPROVAL").length}
          subtitle="Postings awaiting moderation"
          accent="warning"
        />
        <KpiCard
          label="Automated Safety Pass"
          value="100%"
          subtitle="No fraud or fee violations"
          accent="success"
        />
        <KpiCard
          label="Avg Turnaround"
          value="< 2 hrs"
          subtitle="Moderation speed"
          accent="indigo"
        />
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
        {(["queue", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setJobs(jcmsService.getModerationJobs(t));
            }}
            className={`pb-3 cursor-pointer capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-brand-600 text-brand-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t === "queue" ? "Pending Approval Queue" : t === "approved" ? "Published Postings" : "Flagged & Rejected"}
          </button>
        ))}
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            No job postings in this moderation view.
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                      {job.organization_name}
                    </span>
                    {job.organization_verified && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                        Verified Employer ✓
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-navy-950">{job.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {job.location} • {job.employment_type} ({job.work_mode}) • {job.openings} Openings
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-medium block">Compensation</span>
                    <span className="text-base font-bold text-slate-800">
                      ₹{(job.salary_min / 100000).toFixed(1)} - ₹{(job.salary_max / 100000).toFixed(1)} LPA
                    </span>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              </div>

              {/* Safety Checks */}
              {job.safety_checks && (
                <div className="grid gap-2 sm:grid-cols-4 text-[11px]">
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 p-2 text-emerald-800 font-medium">
                    <span>✓</span> Salary Benchmark Met
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 p-2 text-emerald-800 font-medium">
                    <span>✓</span> Zero Recruitment Fees
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 p-2 text-emerald-800 font-medium">
                    <span>✓</span> No Duplication
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 p-2 text-emerald-800 font-medium">
                    <span>✓</span> Registered Organization
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">{job.description}</p>

              {/* Skills */}
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((sk) => (
                  <span
                    key={sk}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                  >
                    {sk}
                  </span>
                ))}
              </div>

              {job.moderation_note && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <strong className="text-slate-700 block mb-0.5">Moderator Note:</strong>
                  <span className="text-slate-600">{job.moderation_note}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedJob(job)}
                >
                  Review & Moderate
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Moderation Decision Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-navy-950">Moderate: {selectedJob.title}</h3>
            <p className="text-xs text-slate-500">{selectedJob.organization_name}</p>

            <div className="text-xs">
              <label className="block font-medium text-slate-600 mb-1">
                Moderator Instructions / Feedback
              </label>
              <textarea
                rows={3}
                value={moderationNote}
                onChange={(e) => setModerationNote(e.target.value)}
                placeholder="e.g. Approved. Meets all salary transparency guidelines."
                className="w-full rounded-xl border border-slate-200 p-2.5"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedJob(null)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleModerate("request_changes")}
              >
                Request Edits
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="check"
                onClick={() => handleModerate("approve")}
              >
                Approve & Publish
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
