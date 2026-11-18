import { compact, diffForUpdate } from "@/core/lib/query";
import type { UserFormOptions } from "@/modules/user-management/common/permissions/types";
import type { UserFormValues } from "@/modules/user-management/users/form/userFormValues";
import type { UserCreateBody, UserUpdateBody } from "@/modules/user-management/users/types";

const NUMERIC_STUDENT_FIELDS = ["year_of_study", "graduation_year"] as const;

/**
 * Request shape shared by create and update. Only the sections the server showed are sent, so the rules
 * about which sections apply stay in the backend (`form_options.sections`).
 */
function toRequestShape(values: UserFormValues, options: UserFormOptions) {
  const rawCerts = values.student.certifications || [];
  const certifications = rawCerts
    .filter(
      (c) =>
        (c.name || "").trim() ||
        (c.issuing_organization || "").trim() ||
        (c.credential_id || "").trim() ||
        (c.credential_url || "").trim() ||
        (c.document_url || "").trim() ||
        c.issue_date ||
        c.expiration_date,
    )
    .map((c) => ({
      name: c.name.trim() || "Certification",
      issuing_organization: c.issuing_organization.trim() || undefined,
      issue_date: c.issue_date || undefined,
      expiration_date: c.expiration_date || undefined,
      credential_id: c.credential_id.trim() || undefined,
      credential_url: c.credential_url.trim() || undefined,
      document_url: c.document_url.trim() || undefined,
    }));

  const student = {
    ...values.student,
    ...Object.fromEntries(
      NUMERIC_STUDENT_FIELDS.map((field) => [field, values.student[field] === "" ? "" : Number(values.student[field])]),
    ),
    linkedin_url: (values.student.linkedin_url || "").trim() || undefined,
    github_url: (values.student.github_url || "").trim() || undefined,
    hackerrank_url: (values.student.hackerrank_url || "").trim() || undefined,
    leetcode_url: (values.student.leetcode_url || "").trim() || undefined,
    guardians: values.student.guardians.map((guardian, _index, all) => ({
      ...guardian,
      is_primary: all.length === 1 ? true : guardian.is_primary,
    })),
    certifications: certifications.length ? certifications : undefined,
  };
  return {
    role: values.role,
    organization_id: options.organization.shown ? values.organization_id : "",
    manager_user_id: options.manager.shown ? values.manager_user_id : "",
    scopes: options.scopes.shown ? values.scopes : undefined,
    account: { email: values.account.email, username: values.account.username },
    personal_info: values.personal_info,
    address: values.include_address ? { ...values.address, country: values.address.country.toUpperCase() } : null,
    employment: options.sections.employment ? values.employment : null,
    student: options.sections.student ? student : null,
  };
}

export function toCreateBody(values: UserFormValues, options: UserFormOptions): UserCreateBody {
  const shape = toRequestShape(values, options);
  const body = compact({
    ...shape,
    account: {
      ...shape.account,
      password: values.account.set_password ? values.account.password : undefined,
      generate_password: values.account.generate_password ? true : undefined,
    },
    address: shape.address ?? undefined,
    employment: shape.employment ?? undefined,
    student: shape.student ?? undefined,
  });
  // Always send these two, even empty: a student without email or username is valid (the server makes the username),
  // and an empty name must come back as errors on the name fields, not as one "personal_info is required".
  return { ...body, account: body.account ?? {}, personal_info: body.personal_info ?? {} } as UserCreateBody;
}

/** Only changed fields; whole address and guardian list when they change (the API replaces them). */
export function toUpdateBody(initial: UserFormValues, values: UserFormValues, options: UserFormOptions): UserUpdateBody {
  const before = toRequestShape(initial, options);
  const after = toRequestShape(values, options);
  const body: Record<string, unknown> = {};

  const simple = diffForUpdate(
    {
      role: before.role,
      organization_id: before.organization_id,
      manager_user_id: before.manager_user_id,
      account: before.account,
      personal_info: before.personal_info,
      employment: before.employment,
    },
    {
      role: after.role,
      organization_id: after.organization_id,
      manager_user_id: after.manager_user_id,
      account: after.account,
      personal_info: after.personal_info,
      employment: after.employment,
    },
  ) as Record<string, unknown> | undefined;
  Object.assign(body, simple ?? {});

  if (options.scopes.shown && JSON.stringify([...initial.scopes].sort()) !== JSON.stringify([...values.scopes].sort())) {
    body.scopes = values.scopes;
  }
  if (JSON.stringify(before.address) !== JSON.stringify(after.address)) body.address = after.address ? compact(after.address) : null;
  if (after.student) {
    const studentChanges = (diffForUpdate(
      { ...before.student, guardians: undefined, certifications: undefined },
      { ...after.student, guardians: undefined, certifications: undefined },
    ) ?? {}) as Record<string, unknown>;
    if (JSON.stringify(compact(before.student?.guardians ?? [])) !== JSON.stringify(compact(after.student.guardians))) {
      studentChanges.guardians = compact(after.student.guardians);
    }
    if (JSON.stringify(before.student?.certifications ?? []) !== JSON.stringify(after.student.certifications)) {
      studentChanges.certifications = after.student.certifications;
    }
    if (Object.keys(studentChanges).length) body.student = studentChanges;
  }
  return body;
}
