import { compact, diffForUpdate } from "@/core/lib/query";
import type { InstitutionFormValues } from "@/modules/user-management/institutions/form/institutionFormValues";
import type { Institution, InstitutionBody } from "@/modules/user-management/institutions/types";

export function emptyInstitutionForm(): InstitutionFormValues {
  return {
    name: "",
    code: "",
    type: "",
    custom_type: "",
    admin_user_id: "",
    admin_label: "",
    contact: { email: "", phone: "", alternate_phone: "", website: "" },
    address: { line1: "", line2: "", city: "", state: "", postal_code: "", country: "IN" },
    timezone: "",
    registration_number: "",
    affiliation: "",
    established_year: "",
    website: "",
    linkedin_url: "",
    instagram_url: "",
    facebook_url: "",
    youtube_url: "",
    twitter_url: "",
  };
}

export function institutionToForm(institution: Institution): InstitutionFormValues {
  const s = (value: string | null | undefined) => value ?? "";
  const website = s(institution.website || institution.contact?.website);
  return {
    name: institution.name,
    code: institution.code,
    type: institution.type,
    custom_type: s(institution.custom_type),
    admin_user_id: institution.admin.user_id,
    admin_label: institution.admin.full_name,
    contact: {
      email: institution.contact.email,
      phone: institution.contact.phone,
      alternate_phone: s(institution.contact.alternate_phone),
      website: website,
    },
    address: { ...institution.address, line2: s(institution.address.line2) },
    timezone: institution.timezone,
    registration_number: s(institution.registration_number),
    affiliation: s(institution.affiliation),
    established_year: institution.established_year ? String(institution.established_year) : "",
    website: website,
    linkedin_url: s(institution.linkedin_url),
    instagram_url: s(institution.instagram_url),
    facebook_url: s(institution.facebook_url),
    youtube_url: s(institution.youtube_url),
    twitter_url: s(institution.twitter_url || institution.x_url),
  };
}

function shape(values: InstitutionFormValues) {
  const website = (values.website || values.contact?.website || "").trim();
  const linkedin_url = values.linkedin_url?.trim() || "";
  const instagram_url = values.instagram_url?.trim() || "";
  const facebook_url = values.facebook_url?.trim() || "";
  const youtube_url = values.youtube_url?.trim() || "";
  const twitter_url = values.twitter_url?.trim() || "";

  return {
    name: values.name,
    code: values.code.toUpperCase(),
    type: values.type,
    custom_type: values.custom_type?.trim() || undefined,
    admin_user_id: values.admin_user_id,
    contact: {
      ...values.contact,
      website: website || undefined,
    },
    address: { ...values.address, country: values.address.country.toUpperCase() },
    timezone: values.timezone,
    registration_number: values.registration_number,
    affiliation: values.affiliation,
    established_year: values.established_year ? Number(values.established_year) : "",
    website: website || undefined,
    linkedin_url: linkedin_url || undefined,
    instagram_url: instagram_url || undefined,
    facebook_url: facebook_url || undefined,
    youtube_url: youtube_url || undefined,
    twitter_url: twitter_url || undefined,
  };
}

export function toInstitutionCreateBody(values: InstitutionFormValues): InstitutionBody {
  return compact(shape(values)) as InstitutionBody;
}

export function toInstitutionUpdateBody(initial: InstitutionFormValues, values: InstitutionFormValues): InstitutionBody {
  const before = shape(initial);
  const after = shape(values);
  const body = (diffForUpdate({ ...before, address: undefined }, { ...after, address: undefined }) ?? {}) as Record<string, unknown>;
  // The API replaces the whole address, so send it whole when anything in it changed.
  if (JSON.stringify(before.address) !== JSON.stringify(after.address)) body.address = compact(after.address);
  return body;
}

export function isInstitutionField(field: string): boolean {
  return /^(name|code|type|custom_type|admin_user_id|timezone|brand_color|registration_number|affiliation|established_year|website|linkedin_url|instagram_url|facebook_url|youtube_url|twitter_url|x_url|contact\.(email|phone|alternate_phone|website)|address\.(line1|line2|city|state|postal_code|country))$/.test(field);
}
