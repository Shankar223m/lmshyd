import { useId, useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";

import { toOptions } from "@/core/lib/options";
import { useNotify } from "@/core/hooks/useNotify";
import { INSTITUTION_TYPE_LABELS } from "@/modules/user-management/common/labels";
import { usePermissions } from "@/modules/user-management/common/permissions/usePermissions";
import { useCreateInstitutionMutation, useGetInstitutionQuery, useUpdateInstitutionMutation } from "@/modules/user-management/institutions/api/institutionsApi";
import { AdminField } from "@/modules/user-management/institutions/components/form/AdminField";
import { emptyInstitutionForm, institutionToForm, toInstitutionCreateBody, toInstitutionUpdateBody } from "@/modules/user-management/institutions/form/institutionFormMappers";
import type { InstitutionFormValues } from "@/modules/user-management/institutions/form/institutionFormValues";
import { validateUrl } from "@/modules/user-management/institutions/form/validateUrl";
import { useFormErrorHandler } from "@/modules/user-management/institutions/hooks/useInstitutionFormErrors";
import { FormGrid } from "@/modules/user-management/manage/common/components/FormGrid";
import { PasswordChoice } from "@/modules/user-management/users/components/form/PasswordChoice";
import { SelectField, TextField } from "@/shared/form";
import { Alert, Button, EmptyState, Modal, Spinner } from "@/shared/ui";

/** Add or edit an institution in a pop-up: the same form for both (`organizationId` set means edit). */
export function InstitutionFormModal({ organizationId, onClose }: { organizationId: string | null; onClose: () => void }) {
  const editing = organizationId !== null;
  const query = useGetInstitutionQuery(organizationId ?? "", { skip: !editing });
  const initial = useMemo(() => (editing ? (query.data ? institutionToForm(query.data) : null) : emptyInstitutionForm()), [editing, query.data]);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? "Edit institution" : "Add institution"}
      description={editing ? "Change the details and save." : "Add the institution first, then its head."}
    >
      {query.isError ? (
        <EmptyState icon="alert" title="Could not open the form" description="Close it and try again." />
      ) : !initial ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <InstitutionForm organizationId={organizationId} initial={initial} onDone={onClose} />
      )}
    </Modal>
  );
}

function InstitutionForm({ organizationId, initial, onDone }: { organizationId: string | null; initial: InstitutionFormValues; onDone: () => void }) {
  const formId = useId();
  const notify = useNotify();
  const { permissions } = usePermissions();
  // The server checks the fields; a field's error stays until the person edits that field.
  const form = useForm<InstitutionFormValues>({ defaultValues: initial, mode: "onSubmit", reValidateMode: "onChange" });
  const [create, { isLoading: creating }] = useCreateInstitutionMutation();
  const [update, { isLoading: saving }] = useUpdateInstitutionMutation();
  const { formError, setFormError, handle } = useFormErrorHandler();

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (organizationId === null) {
        const created = await create(toInstitutionCreateBody(values)).unwrap();
        notify.success(`${created.name} added`, "Next, add its institution head.");
        onDone();
        return;
      }
      const body = toInstitutionUpdateBody(initial, values);
      if (Object.keys(body).length === 0) {
        notify.info("Nothing changed");
        onDone();
        return;
      }
      await update({ organizationId, body }).unwrap();
      notify.success("Changes saved");
      onDone();
    } catch (error) {
      handle(error, form.setError);
    }
  });

  return (
    <FormProvider {...form}>
      <form id={formId} onSubmit={submit} noValidate className="space-y-6">
        {formError && <Alert tone="error">{formError}</Alert>}
        <FormGrid title="Institution">
          <TextField<InstitutionFormValues> name="name" label="Institution name" placeholder="e.g. GenZ Test College" required className="sm:col-span-2" />
          <TextField<InstitutionFormValues> name="code" label="Short code" placeholder="e.g. GZTC" maxLength={20} required />
          <SelectField<InstitutionFormValues> name="type" label="Type" options={toOptions(INSTITUTION_TYPE_LABELS)} placeholder="Choose…" required />
          {/* only the super admin picks the owner; an admin always owns what they add */}
          {permissions.institutions.reassign_admin && (
            <div className="sm:col-span-2">
              <AdminField />
            </div>
          )}
        </FormGrid>
        <FormGrid title="Contact">
          <TextField<InstitutionFormValues> name="contact.email" label="Contact email" type="email" required />
          <TextField<InstitutionFormValues> name="contact.phone" label="Contact phone" type="tel" placeholder="+914023456789" required />
        </FormGrid>
        <FormGrid title="Address">
          <TextField<InstitutionFormValues> name="address.line1" label="Address" required className="sm:col-span-2" />
          <TextField<InstitutionFormValues> name="address.city" label="City" required />
          <TextField<InstitutionFormValues> name="address.state" label="State" required />
          <TextField<InstitutionFormValues> name="address.postal_code" label="PIN code" inputMode="numeric" required />
        </FormGrid>
        {organizationId === null && (
          <FormGrid title="Sign-in">
            <TextField<InstitutionFormValues>
              name="login.username"
              label="Username"
              placeholder="e.g. gztc"
              maxLength={30}
              autoComplete="off"
              required
              rules={{ validate: (value) => (typeof value === "string" && value.trim().length >= 3) || "At least 3 characters" }}
            />
            <PasswordChoice name="login.password" minLength={8} />
          </FormGrid>
        )}
        <FormGrid title="Online Presence">
          <TextField<InstitutionFormValues>
            name="website"
            label="Official Website URL (Optional)"
            placeholder="https://www.genztestcollege.edu.in"
            type="url"
            icon="globe"
            rules={{ validate: validateUrl }}
          />
          <TextField<InstitutionFormValues>
            name="linkedin_url"
            label="LinkedIn Profile URL (Optional)"
            placeholder="https://www.linkedin.com/school/example-college/"
            type="url"
            icon="linkedin"
            rules={{ validate: validateUrl }}
          />
          <TextField<InstitutionFormValues>
            name="instagram_url"
            label="Instagram Profile URL (Optional)"
            placeholder="https://www.instagram.com/examplecollege/"
            type="url"
            icon="instagram"
            rules={{ validate: validateUrl }}
          />
          <TextField<InstitutionFormValues>
            name="facebook_url"
            label="Facebook Page URL (Optional)"
            placeholder="https://www.facebook.com/examplecollege"
            type="url"
            icon="facebook"
            rules={{ validate: validateUrl }}
          />
          <TextField<InstitutionFormValues>
            name="youtube_url"
            label="YouTube Channel URL (Optional)"
            placeholder="https://www.youtube.com/@examplecollege"
            type="url"
            icon="youtube"
            rules={{ validate: validateUrl }}
          />
          <TextField<InstitutionFormValues>
            name="twitter_url"
            label="X (Twitter) Profile URL (Optional)"
            placeholder="https://x.com/examplecollege"
            type="url"
            icon="twitter"
            rules={{ validate: validateUrl }}
          />
        </FormGrid>
        {/* pinned to the bottom of the pop-up while the fields scroll */}
        <div className="sticky bottom-0 -mx-6 -mb-5 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onDone} disabled={creating || saving}>
            Cancel
          </Button>
          <Button type="submit" loading={creating || saving}>
            {organizationId === null ? "Add institution" : "Save changes"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
