import { describe, expect, it } from "vitest";
import {
  emptyInstitutionForm,
  institutionToForm,
  toInstitutionCreateBody,
  toInstitutionUpdateBody,
} from "./institutionFormMappers";
import type { Institution } from "../types";

describe("institutionFormMappers with Online Presence", () => {
  it("initializes empty form with empty online presence fields", () => {
    const form = emptyInstitutionForm();
    expect(form.website).toBe("");
    expect(form.linkedin_url).toBe("");
    expect(form.instagram_url).toBe("");
    expect(form.facebook_url).toBe("");
    expect(form.youtube_url).toBe("");
    expect(form.twitter_url).toBe("");
  });

  it("maps an institution with online presence to form values", () => {
    const mockInstitution: Institution = {
      organization_id: "123",
      name: "Test College",
      code: "TC",
      type: "college",
      status: "active",
      status_reason: null,
      contact: {
        email: "test@example.com",
        phone: "+919876543210",
        alternate_phone: null,
        website: "https://www.testcollege.edu",
      },
      address: {
        line1: "123 St",
        line2: null,
        city: "City",
        state: "State",
        postal_code: "500001",
        country: "IN",
      },
      timezone: "Asia/Kolkata",
      registration_number: null,
      affiliation: null,
      established_year: 2020,
      website: "https://www.testcollege.edu",
      linkedin_url: "https://www.linkedin.com/school/testcollege",
      instagram_url: "https://www.instagram.com/testcollege",
      facebook_url: "https://www.facebook.com/testcollege",
      youtube_url: "https://www.youtube.com/@testcollege",
      twitter_url: "https://x.com/testcollege",
      admin: { user_id: "admin1", full_name: "Admin One", role: "admin", email: "admin@example.com" },
      member_counts: { institution_heads: 1, staff: 2, students: 10, total: 13 },
      created_by: null,
      created_time: "2026-01-01T00:00:00Z",
      modified_time: "2026-01-01T00:00:00Z",
      deleted_time: null,
      allowed_actions: ["update"],
    };

    const form = institutionToForm(mockInstitution);
    expect(form.website).toBe("https://www.testcollege.edu");
    expect(form.linkedin_url).toBe("https://www.linkedin.com/school/testcollege");
    expect(form.instagram_url).toBe("https://www.instagram.com/testcollege");
    expect(form.facebook_url).toBe("https://www.facebook.com/testcollege");
    expect(form.youtube_url).toBe("https://www.youtube.com/@testcollege");
    expect(form.twitter_url).toBe("https://x.com/testcollege");
  });

  it("produces clean create body with online presence included", () => {
    const values = emptyInstitutionForm();
    values.name = "New College";
    values.code = "NC";
    values.type = "college";
    values.contact.email = "nc@example.com";
    values.contact.phone = "+919876543210";
    values.address.line1 = "123 Main";
    values.address.city = "Hyd";
    values.address.state = "TG";
    values.address.postal_code = "500001";
    values.website = "https://www.newcollege.edu";
    values.linkedin_url = "https://linkedin.com/school/newcollege";

    const body = toInstitutionCreateBody(values);
    expect(body.website).toBe("https://www.newcollege.edu");
    expect(body.linkedin_url).toBe("https://linkedin.com/school/newcollege");
    expect(body.instagram_url).toBeUndefined();
  });

  it("produces partial update body for changed online presence links", () => {
    const initial = emptyInstitutionForm();
    initial.website = "https://old.edu";

    const current = { ...initial, website: "https://new.edu", twitter_url: "https://x.com/new" };
    const body = toInstitutionUpdateBody(initial, current);

    expect(body.website).toBe("https://new.edu");
    expect(body.twitter_url).toBe("https://x.com/new");
    expect(body.linkedin_url).toBeUndefined();
  });
});
