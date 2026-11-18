import { useState } from "react";

import { formatDate } from "@/core/lib/format";
import { JobTabs } from "@/modules/job-portal/common/components/JobTabs";
import { useListMyPlacementsQuery, useSubmitPlacementEvidenceMutation } from "@/modules/job-portal/jcms/api/jcmsApi";
import { Badge, Button, EmptyState, Field, PageHeader, Spinner } from "@/shared/ui";

export function StudentPlacementPage() {
  const { data = [], isFetching } = useListMyPlacementsQuery();
  const [submitEvidence, submitState] = useSubmitPlacementEvidenceMutation();
  const [mediaId, setMediaId] = useState("");
  const [category, setCategory] = useState("offer_letter");

  return (
    <>
      <PageHeader title="Placement evidence" description="Submit joining details and proof documents for institution verification." />
      <JobTabs />
      {isFetching && data.length === 0 ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState icon="check" title="No placements yet" description="Accepting an offer creates a placement record for evidence submission." />
      ) : (
        <div className="space-y-4">
          {data.map((placement) => (
            <article key={placement.placement_id} className="space-y-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/60 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-navy-950">{placement.designation || "Placement"}</h2>
                  <p className="text-[13px] text-slate-500">
                    {placement.annual_package != null ? `${placement.currency} ${placement.annual_package}` : "Package pending"}
                    {placement.joining_date ? ` · ${formatDate(placement.joining_date)}` : ""}
                    {placement.work_location ? ` · ${placement.work_location}` : ""}
                  </p>
                </div>
                <Badge tone={placement.status === "verified" ? "green" : "blue"}>{placement.status}</Badge>
              </div>
              {placement.verifier_comment ? <p className="text-sm text-slate-600">Verifier: {placement.verifier_comment}</p> : null}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-navy-950">Evidence</h3>
                {placement.evidence.length === 0 ? <p className="text-sm text-slate-500">No documents uploaded yet.</p> : null}
                <ul className="space-y-1 text-sm text-slate-600">
                  {placement.evidence.map((e) => (
                    <li key={e.evidence_id}>{e.category} · media #{e.media_asset_id} · {e.status}</li>
                  ))}
                </ul>
              </div>
              {placement.status !== "verified" && placement.status !== "withdrawn" ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label="Media asset id">
                    {(props) => (
                      <input {...props} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={mediaId} onChange={(e) => setMediaId(e.target.value)} placeholder="Uploaded media public id" />
                    )}
                  </Field>
                  <Field label="Category">
                    {(props) => (
                      <input {...props} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="offer_letter" />
                    )}
                  </Field>
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      disabled={!mediaId || submitState.isLoading}
                      onClick={() => submitEvidence({ placementId: placement.placement_id, media_asset_id: Number(mediaId), category })}
                    >
                      Submit evidence
                    </Button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
