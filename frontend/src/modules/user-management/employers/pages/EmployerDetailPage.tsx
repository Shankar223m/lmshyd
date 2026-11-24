import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { formatDateTime } from "@/core/lib/format";
import { useNotify } from "@/core/hooks/useNotify";
import { applyServerErrors, toApiError } from "@/core/lib/apiError";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";
import { StatusBadge } from "@/modules/user-management/common/components/UserBadges";
import { useGetEmployerQuery, useUpdateEmployerMutation } from "@/modules/user-management/employers/api/employersApi";
import { EmployerForm } from "@/modules/user-management/employers/components/form/EmployerForm";
import { employerToForm, isEmployerField, toEmployerUpdateBody } from "@/modules/user-management/employers/form/employerForm";
import { useOrganizationActions } from "@/modules/user-management/institutions/hooks/useOrganizationActions";
import type { Institution } from "@/modules/user-management/institutions/types";
import { EmployerStatusBadge } from "@/modules/job-portal/common/components/JobBadges";
import { COMPANY_SIZES } from "@/modules/job-portal/common/labels";
import { useGetCompanyHiringProfileQuery, useKeepCompanyProfileMutation } from "@/modules/job-portal/admin/api/companyProfileApi";
import { useJobsAccess } from "@/modules/jobs/hooks/useJobsAccess";
import { Alert, Button, ConfirmDialog, DescriptionList, Drawer, EmptyState, Field, Input, Menu, PageHeader, PageLoader, Select, Textarea } from "@/shared/ui";

const EMPTY_HIRING_FORM = { about: "", website: "", industry: "", company_size: "", headquarters: "" };

export function EmployerDetailPage({ organizationIdOverride }: { organizationIdOverride?: string }) {
  const params = useParams();
  const organizationId = organizationIdOverride ?? params.organizationId ?? "";
  const navigate = useNavigate();
  const notify = useNotify();
  const { user } = useAuth();
  const { isModerator, isInstitution } = useJobsAccess();
  const { data: employer, isLoading, isError } = useGetEmployerQuery(organizationId, { skip: !organizationId });
  const [updateEmployer, { isLoading: isUpdating }] = useUpdateEmployerMutation();
  const actions = useOrganizationActions("employer");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const initialFormValues = useMemo(() => (employer ? employerToForm(employer) : null), [employer]);

  if (isLoading) return <PageLoader />;
  if (isError || !employer) {
    return (
      <EmptyState
        icon="alert"
        title="Employer not found"
        description="It may have been deleted or is outside your access."
        action={<Button onClick={() => navigate("/")}>Go to dashboard</Button>}
      />
    );
  }

  const items = actions.itemsFor(employer);
  const editAction = items.find((item) => item.label === "Edit" && !item.hidden);
  const canEdit =
    user?.role === "super_admin" ||
    user?.role === "admin" ||
    Boolean(employer.allowed_actions && employer.allowed_actions.includes("update")) ||
    Boolean(editAction);

  const handleViewJobs = () => {
    if (isModerator) {
      navigate(`/jobs/admin/postings?q=${encodeURIComponent(employer.name)}`);
    } else if (isInstitution) {
      navigate(`/jobs/institution/placements?employer=${employer.organization_id}`);
    } else {
      navigate(`/jobs/employer/jobs?employer_org_id=${employer.organization_id}`);
    }
  };

  const handleCreateJob = () => {
    if (isModerator) {
      navigate(`/jobs/admin/jobs/new?employer_org_id=${employer.organization_id}&company_name=${encodeURIComponent(employer.name)}`);
    } else if (isInstitution) {
      navigate(`/jobs/institution/jobs/new?employer_org_id=${employer.organization_id}&company_name=${encodeURIComponent(employer.name)}`);
    } else {
      navigate(`/jobs/employer/jobs/new?employer_org_id=${employer.organization_id}&company_name=${encodeURIComponent(employer.name)}`);
    }
  };

  const { contact, address } = employer;
  const fullAddress = `${address.line1}${address.line2 ? `, ${address.line2}` : ""}, ${address.city}, ${address.state} ${address.postal_code}, ${address.country}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-12">
      {/* Top back navigation breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link
          to={organizationIdOverride ? "/" : "/employers"}
          className="inline-flex items-center gap-1.5 font-medium transition hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
          Back to Companies
        </Link>
      </div>

      {employer.status === "suspended" && (
        <Alert tone="warning" title="Suspended" className="mb-2">
          {employer.status_reason ?? "Members cannot sign in."}
        </Alert>
      )}

      {/* SINGLE UNIFIED BACKGROUND CARD */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
        {/* Top Header Row with Company Name, Status Badge, and Toolbar Options */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{employer.name}</h1>
            <StatusBadge status={employer.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={handleViewJobs}>
              View Jobs
            </Button>
            <Button variant="primary" onClick={handleCreateJob}>
              + Create Job
            </Button>
            {canEdit && (
              <Button variant="secondary" icon="edit" onClick={() => setIsEditOpen(true)}>
                Edit
              </Button>
            )}
            <Menu
              trigger={<Button variant="secondary" icon="more">Actions</Button>}
              items={items.filter((item) => item.label !== "Edit")}
            />
          </div>
        </div>

        {/* 2-Column Content Layout inside the same card */}
        <div className="pt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column (8 cols): Details & Hiring Profile */}
          <div className="space-y-8 lg:col-span-8">
            {/* Details Section */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900">Details</h2>
              <DescriptionList
                items={[
                  { label: "Industry", value: employer.industry },
                  { label: "Email", value: contact.email },
                  { label: "Phone", value: contact.phone },
                  { label: "Alternate phone", value: contact.alternate_phone },
                  {
                    label: "Website",
                    value: contact.website && (
                      <a className="text-brand-700 hover:underline" href={contact.website} target="_blank" rel="noreferrer noopener">
                        {contact.website}
                      </a>
                    ),
                  },
                  { label: "Registration number", value: employer.registration_number },
                  { label: "Established", value: employer.established_year },
                  { label: "Time zone", value: employer.timezone },
                  { label: "Address", span: 2, value: fullAddress },
                ]}
              />
            </div>

            {/* Hiring Profile Section with internal divider */}
            <div className="border-t border-slate-100 pt-8">
              <CompanyHiringProfileSection organizationId={employer.organization_id} industry={employer.industry} />
            </div>
          </div>

          {/* Right Column (4 cols): Ownership with vertical divider */}
          <div className="space-y-6 lg:col-span-4 lg:border-l lg:border-slate-100 lg:pl-8">
            <OwnershipSection institution={employer} />
          </div>
        </div>
      </div>

      <ConfirmDialog {...actions.confirmDialogProps} />

      {/* Edit Company Drawer */}
      {isEditOpen && initialFormValues && (
        <Drawer size="lg" onClose={() => setIsEditOpen(false)}>
          <div className="flex-1 px-5 py-6 sm:px-8">
            <PageHeader title={`Edit ${employer.name}`} />
            <EmployerForm
              mode="edit"
              defaultValues={initialFormValues}
              submitting={isUpdating}
              formError={formError}
              onCancel={() => setIsEditOpen(false)}
              onSubmit={async (values, form) => {
                setFormError(null);
                const body = toEmployerUpdateBody(initialFormValues, values);
                if (!Object.keys(body).length) {
                  notify.info("No changes to save");
                  return;
                }
                try {
                  await updateEmployer({ organizationId, body }).unwrap();
                  notify.success("Changes saved");
                  setIsEditOpen(false);
                } catch (error) {
                  const apiError = toApiError(error);
                  const unmatched = applyServerErrors(apiError, form.setError, isEmployerField);
                  if (!apiError.details.length || unmatched.length) setFormError(apiError.message);
                  else notify.error(apiError.message, "Check the highlighted fields.");
                }
              }}
            />
          </div>
        </Drawer>
      )}
    </div>
  );
}

function CompanyHiringProfileSection({ organizationId, industry }: { organizationId: string; industry?: string | null }) {
  const notify = useNotify();
  const { data: company, isFetching } = useGetCompanyHiringProfileQuery(organizationId);
  const [keep, { isLoading: saving }] = useKeepCompanyProfileMutation();
  const [form, setForm] = useState(EMPTY_HIRING_FORM);

  useEffect(() => {
    setForm(
      company
        ? {
            about: company.about ?? "",
            website: company.website ?? "",
            industry: company.industry ?? "",
            company_size: company.company_size ?? "",
            headquarters: company.headquarters ?? "",
          }
        : { ...EMPTY_HIRING_FORM, industry: industry ?? "" },
    );
  }, [company, industry]);

  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = () =>
    keep({
      organizationId,
      body: {
        about: form.about || null,
        website: form.website || null,
        industry: form.industry || null,
        company_size: form.company_size || null,
        headquarters: form.headquarters || null,
      },
    })
      .unwrap()
      .then(() => notify.success("Hiring profile saved", "The company is verified: its jobs can go live."), notify.apiError);

  const verified = company?.status === "verified";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">Hiring profile</h2>
        {company && <EmployerStatusBadge status={company.status} />}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="About" required className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={4} maxLength={2000} value={form.about} onChange={(e) => set("about")(e.target.value)} />}
        </Field>
        <Field label="Website" required>
          {(p) => <Input {...p} value={form.website} placeholder="https://" onChange={(e) => set("website")(e.target.value)} />}
        </Field>
        <Field label="Industry" required>
          {(p) => <Input {...p} maxLength={100} value={form.industry} onChange={(e) => set("industry")(e.target.value)} />}
        </Field>
        <Field label="Company size">
          {(p) => (
            <Select
              {...p}
              value={form.company_size}
              placeholder="Choose"
              options={COMPANY_SIZES.map((s) => ({ value: s, label: `${s} people` }))}
              onChange={(e) => set("company_size")(e.target.value)}
            />
          )}
        </Field>
        <Field label="Headquarters">
          {(p) => <Input {...p} maxLength={120} value={form.headquarters} onChange={(e) => set("headquarters")(e.target.value)} />}
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {verified && (
          <Link
            to={`/jobs/admin/postings?q=${encodeURIComponent(company.about || "")}`}
            className="mr-auto text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            {company.open_jobs} open job{company.open_jobs === 1 ? "" : "s"} · see its jobs
          </Link>
        )}
        <Button loading={saving} disabled={isFetching} onClick={() => void save()}>
          {verified ? "Save" : "Save and verify"}
        </Button>
      </div>
    </div>
  );
}

function OwnershipSection({
  institution,
}: {
  institution: { admin: Institution["admin"]; created_by: Institution["created_by"]; created_time: string; modified_time: string };
}) {
  const { permissions } = usePermissions();
  const admin = institution.admin;
  const linkToAdmin = permissions.admins.view;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-slate-900">Ownership</h2>
      <DescriptionList
        columns={1}
        items={[
          {
            label: "Admin",
            value: linkToAdmin ? (
              <Link className="text-brand-700 hover:underline" to={`/admins/${admin.user_id}`}>
                {admin.full_name}
              </Link>
            ) : (
              admin.full_name
            ),
          },
          { label: "Admin email", value: admin.email },
          { label: "Created by", value: institution.created_by?.full_name },
          { label: "Created", value: formatDateTime(institution.created_time) },
          { label: "Last updated", value: formatDateTime(institution.modified_time) },
        ]}
      />
    </div>
  );
}
