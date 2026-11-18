import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotify } from "@/core/hooks/useNotify";
import { Button, PageHeader } from "@/shared/ui";
import { jcmsService } from "../jcmsService";

export function CreateOfferPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const candidates = jcmsService.getPipelineCandidates();

  const [selectedCandidateId, setSelectedCandidateId] = useState(candidates[0]?.id || "");
  const [roleTitle, setRoleTitle] = useState("Software Development Engineer (SDE-1)");
  const [annualPackage, setAnnualPackage] = useState(1800000);
  const [location, setLocation] = useState("Bengaluru, Karnataka");
  const [joiningDate, setJoiningDate] = useState("2026-07-01");
  const [respondBy, setRespondBy] = useState("2026-06-15");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      jcmsService.createOffer(
        selectedCandidateId,
        roleTitle,
        Number(annualPackage),
        location,
        joiningDate,
        respondBy
      );

      notify.success("Formal offer letter issued to candidate successfully!");
      navigate("/jobs/pipeline");
    } catch (err) {
      notify.error("Failed to generate offer letter");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <PageHeader
        title="Generate Formal Job Offer"
        description="Draft and issue formal employment offer letters with CTC compensation breakdown."
      />

      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card space-y-6 text-xs"
      >
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-navy-950">Offer Specifications</h3>
          <p className="text-slate-500">Provide package details, dates, and candidate assignment.</p>
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Select Candidate *</label>
          <select
            value={selectedCandidateId}
            onChange={(e) => setSelectedCandidateId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-900 bg-white"
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.student_name} — {c.program} ({c.institution_name})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Designation / Role Title *</label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-900"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Annual CTC (INR) *</label>
            <input
              type="number"
              value={annualPackage}
              onChange={(e) => setAnnualPackage(Number(e.target.value))}
              placeholder="1800000"
              className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-900"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Joining Date *</label>
            <input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-900"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Acceptance Deadline *</label>
            <input
              type="date"
              value={respondBy}
              onChange={(e) => setRespondBy(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-900"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">Work Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-900"
              required
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
          <span className="font-bold text-slate-800 block">Package Summary Preview:</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">
              ₹{(annualPackage / 100000).toFixed(2)} LPA
            </span>
            <span className="text-slate-500 font-medium">Fixed & Variable CTC</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Includes base compensation, health benefits, and performance bonuses. The candidate
            will be notified immediately in their Student Dashboard.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={() => navigate("/jobs/pipeline")}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isSubmitting} icon="check">
            Issue Formal Offer
          </Button>
        </div>
      </form>
    </div>
  );
}
