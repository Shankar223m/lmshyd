import { useState } from "react";
import { useNotify } from "@/core/hooks/useNotify";
import { Button, PageHeader } from "@/shared/ui";
import { jcmsService } from "../jcmsService";
import type { OrganizationItem } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { KpiCard } from "../components/KpiCard";

export function OrganisationVerificationPage() {
  const notify = useNotify();
  const [filter, setFilter] = useState<"ALL" | "EMPLOYER" | "INSTITUTION">("ALL");
  const [orgs, setOrgs] = useState<OrganizationItem[]>(() => jcmsService.getOrganizations(filter));
  const [selectedOrg, setSelectedOrg] = useState<OrganizationItem | null>(null);
  const [comment, setComment] = useState("");

  const handleAction = (status: OrganizationItem["verification_status"]) => {
    if (!selectedOrg) return;
    jcmsService.verifyOrganization(selectedOrg.id, status, comment);
    setOrgs(jcmsService.getOrganizations(filter));
    setSelectedOrg(null);
    setComment("");
    notify.success(`Organisation marked as "${status}"!`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <PageHeader
        title="Organisation Verification & Audit"
        description="Verify corporate registrations, compliance certificates, and authorize institutional hiring access."
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total Organisations"
          value={orgs.length}
          subtitle="Registered entities"
          accent="indigo"
        />
        <KpiCard
          label="Verified"
          value={orgs.filter((o) => o.verification_status === "VERIFIED").length}
          subtitle="Authorized to recruit"
          accent="success"
        />
        <KpiCard
          label="Pending Review"
          value={orgs.filter((o) => o.verification_status === "UNDER_REVIEW").length}
          subtitle="Audit required"
          accent="warning"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
        {(["ALL", "EMPLOYER", "INSTITUTION"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setFilter(tab);
              setOrgs(jcmsService.getOrganizations(tab));
            }}
            className={`pb-3 cursor-pointer transition-colors ${
              filter === tab
                ? "border-b-2 border-brand-600 text-brand-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab === "ALL" ? "All Entities" : tab === "EMPLOYER" ? "Corporate Employers" : "Academic Institutions"}
          </button>
        ))}
      </div>

      {/* Orgs List */}
      <div className="space-y-4">
        {orgs.map((org) => (
          <div
            key={org.id}
            className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                  {org.org_type}
                </span>
                <h3 className="text-lg font-bold text-navy-950">{org.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registration: {org.registration_number || "CIN Not Provided"} • Scale:{" "}
                  {org.size_band}
                </p>
              </div>
              <StatusBadge status={org.verification_status} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <span className="text-slate-400 font-medium block">Contact Officer</span>
                <span className="font-semibold text-slate-800">
                  {org.contact_name} ({org.contact_email})
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <span className="text-slate-400 font-medium block">Website</span>
                <a
                  href={org.website}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand-600 hover:underline"
                >
                  {org.website} ↗
                </a>
              </div>
            </div>

            {org.verification_comment && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <strong className="text-slate-700 block mb-0.5">Audit Note:</strong>
                <span className="text-slate-600">{org.verification_comment}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedOrg(org)}
              >
                Perform Audit Decision
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Decision Modal */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-navy-950">Audit Decision: {selectedOrg.name}</h3>
            <p className="text-xs text-slate-500">
              Verify legal credentials, CIN authenticity, and official domain records.
            </p>

            <div className="text-xs">
              <label className="block font-medium text-slate-600 mb-1">Audit Comments / Notes</label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g. Verified Ministry of Corporate Affairs filing and official corporate domain."
                className="w-full rounded-xl border border-slate-200 p-2.5"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedOrg(null)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAction("CHANGES_REQUIRED")}
              >
                Request Docs
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="check"
                onClick={() => handleAction("VERIFIED")}
              >
                Authorize & Verify
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
