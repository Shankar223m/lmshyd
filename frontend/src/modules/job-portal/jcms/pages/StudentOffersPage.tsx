import { Link } from "react-router-dom";

import { formatDate, formatDateTime } from "@/core/lib/format";
import { useRespondToOfferMutation } from "@/modules/job-portal/applications/api/myApplicationsApi";
import { JobTabs } from "@/modules/job-portal/common/components/JobTabs";
import { useListMyOffersQuery } from "@/modules/job-portal/jcms/api/jcmsApi";
import { Badge, Button, EmptyState, PageHeader, Spinner } from "@/shared/ui";

function formatCtc(ctc: number, currency: string) {
  return `${currency} ${(ctc / 100000).toFixed(2)} LPA`;
}

export function StudentOffersPage() {
  const { data = [], isFetching } = useListMyOffersQuery();
  const [respond, respondState] = useRespondToOfferMutation();

  return (
    <>
      <PageHeader title="My offers" description="Review compensation and respond before the offer expires." />
      <JobTabs />
      {isFetching && data.length === 0 ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState icon="briefcase" title="No offers yet" description="Accepted applications that receive an offer will show up here." action={<Link to="/jobs/applications" className="text-sm font-semibold text-brand-700">View applications</Link>} />
      ) : (
        <div className="space-y-3">
          {data.map((offer) => {
            const open = offer.status === "issued" || offer.status === "extended";
            return (
              <article key={offer.offer_id} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/60 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-navy-950">{offer.role_title}</h2>
                    <p className="text-[13px] text-slate-500">
                      {formatCtc(offer.ctc, offer.currency)}
                      {offer.joining_date ? ` · joins ${formatDate(offer.joining_date)}` : ""}
                      {` · expires ${formatDateTime(offer.expires_at)}`}
                    </p>
                  </div>
                  <Badge tone={open ? "green" : "gray"}>{offer.status}</Badge>
                </div>
                {open ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" disabled={respondState.isLoading} onClick={() => respond({ id: offer.application_id, accept: true })}>
                      Accept
                    </Button>
                    <Button size="sm" variant="secondary" disabled={respondState.isLoading} onClick={() => respond({ id: offer.application_id, accept: false })}>
                      Decline
                    </Button>
                    <Link to={`/jobs/applications/${offer.application_id}`} className="inline-flex h-9 items-center text-sm font-semibold text-brand-700">
                      Application details
                    </Link>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
