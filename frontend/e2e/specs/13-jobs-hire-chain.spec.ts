import { expect, test, type APIRequestContext } from "@playwright/test";

import { account } from "../support/accounts";

/**
 * Live hire path against the running stack: employer creates + submits →
 * super admin approves → student discovers. Uses LMS JWT + JCMS APIs.
 */

const API = process.env.E2E_API_BASE ?? "http://127.0.0.1:8000/api/v1";

async function lmsAccessToken(request: APIRequestContext, username: string, password: string): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { identifier: username, password },
  });
  expect(res.ok(), `login ${username}`).toBeTruthy();
  const body = await res.json();
  const token = body?.token?.access_token as string | undefined;
  expect(token, `access token for ${username}`).toBeTruthy();
  return token!;
}

test.describe("Jobs hire chain", () => {
  test("employer submit → admin approve → student discover", async ({ request }) => {
    const employer = account("employer");
    const superAdmin = account("superAdmin");
    const student = account("student");
    test.skip(!employer || !superAdmin || !student, "missing accounts in e2e/accounts.json");

    const title = `E2E Hire Chain ${Date.now()}`;
    const employerToken = await lmsAccessToken(request, employer!.username, employer!.password);

    const create = await request.post(`${API}/jcms/jobs`, {
      headers: { Authorization: `Bearer ${employerToken}` },
      data: {
        title,
        description: "Automated hire-chain coverage for campus placements.",
        location: "Hyderabad",
        employment_type: "INTERNSHIP",
        work_mode: "HYBRID",
        salary_min: 10000,
        salary_max: 20000,
        openings: 1,
        skills: ["Python"],
        hiring_stages: ["Screening", "Interview", "Selected"],
        requires_moderation: true,
        eligibility: {
          programs: ["B.Tech CSE"],
          graduation_year_min: 2025,
          graduation_year_max: 2027,
          min_cgpa: 6.0,
          required_skills: ["Python"],
        },
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    const created = await create.json();
    const jobId = created?.data?.id as string;
    expect(jobId).toBeTruthy();

    const submit = await request.post(`${API}/jcms/jobs/${jobId}/submit`, {
      headers: { Authorization: `Bearer ${employerToken}` },
    });
    expect(submit.ok(), await submit.text()).toBeTruthy();

    const adminToken = await lmsAccessToken(request, superAdmin!.username, superAdmin!.password);
    const pending = await request.get(`${API}/jcms/admin/jobs/pending-moderation`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(pending.ok(), await pending.text()).toBeTruthy();
    const pendingBody = await pending.json();
    const pendingIds = (pendingBody?.data || []).map((j: { id: string }) => j.id);
    expect(pendingIds).toContain(jobId);

    const approve = await request.post(`${API}/jcms/admin/jobs/${jobId}/moderate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: "approve", note: "E2E approve" },
    });
    expect(approve.ok(), await approve.text()).toBeTruthy();

    const studentToken = await lmsAccessToken(request, student!.username, student!.password);
    const discover = await request.get(`${API}/jcms/jobs/discover?q=${encodeURIComponent(title)}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(discover.ok(), await discover.text()).toBeTruthy();
    const discoverBody = await discover.json();
    const titles = (discoverBody?.data || []).map((j: { title: string }) => j.title);
    expect(titles).toContain(title);

    const apply = await request.post(`${API}/jcms/jobs/${jobId}/applications`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { answers: { note: "E2E hire-chain apply" } },
    });
    expect(apply.ok(), await apply.text()).toBeTruthy();
    const applied = await apply.json();
    expect(applied?.data?.id || applied?.data?.application?.id || applied?.id).toBeTruthy();

    const myApps = await request.get(`${API}/jcms/applications/me`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(myApps.ok(), await myApps.text()).toBeTruthy();
    const appsBody = await myApps.json();
    const appJobIds = (appsBody?.data || []).map((a: { job_id?: string; job?: { id?: string } }) => a.job_id || a.job?.id);
    expect(appJobIds).toContain(jobId);

    const applicationId =
      (applied?.data?.id as string | undefined) ||
      (applied?.data?.application?.id as string | undefined) ||
      (applied?.id as string | undefined);
    expect(applicationId).toBeTruthy();

    const shortlist = await request.post(`${API}/jcms/applications/${applicationId}/shortlist`, {
      headers: { Authorization: `Bearer ${employerToken}` },
    });
    expect(shortlist.ok(), await shortlist.text()).toBeTruthy();
    const shortlisted = await shortlist.json();
    expect(shortlisted?.data?.pipeline_stage || shortlisted?.data?.status).toMatch(/shortlist/i);

    const pipeline = await request.get(`${API}/jcms/jobs/${jobId}/pipeline`, {
      headers: { Authorization: `Bearer ${employerToken}` },
    });
    expect(pipeline.ok(), await pipeline.text()).toBeTruthy();
    const columns = (await pipeline.json())?.data?.columns as Record<string, Array<{ id: string }>> | undefined;
    const inPipeline = columns
      ? Object.values(columns)
          .flat()
          .some((a) => a.id === applicationId)
      : false;
    expect(inPipeline).toBe(true);
  });

  test("admin create job → student discover + apply", async ({ request }) => {
    const superAdmin = account("superAdmin");
    const student = account("student");
    test.skip(!superAdmin || !student, "missing accounts in e2e/accounts.json");

    const adminToken = await lmsAccessToken(request, superAdmin!.username, superAdmin!.password);
    const orgs = await request.get(`${API}/jcms/admin/organizations?org_type=EMPLOYER&status=VERIFIED`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(orgs.ok(), await orgs.text()).toBeTruthy();
    const orgList = (await orgs.json())?.data || [];
    test.skip(!orgList.length, "no verified employer org for admin create");
    const organizationId = orgList[0].id as string;

    const title = `E2E Admin Job ${Date.now()}`;
    const create = await request.post(`${API}/jcms/jobs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title,
        description: "Admin-created job for campus placements coverage.",
        location: "Bengaluru",
        employment_type: "FULL_TIME",
        work_mode: "HYBRID",
        salary_min: 500000,
        salary_max: 800000,
        openings: 2,
        skills: ["React"],
        hiring_stages: ["Screening", "Interview", "Selected"],
        organization_id: organizationId,
        eligibility: {
          programs: ["B.Tech CSE"],
          graduation_year_min: 2025,
          graduation_year_max: 2028,
          min_cgpa: 6.0,
          required_skills: ["React"],
        },
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    const jobId = (await create.json())?.data?.id as string;
    expect(jobId).toBeTruthy();

    const submit = await request.post(`${API}/jcms/jobs/${jobId}/submit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(submit.ok(), await submit.text()).toBeTruthy();

    const studentToken = await lmsAccessToken(request, student!.username, student!.password);
    const discover = await request.get(`${API}/jcms/jobs/discover?q=${encodeURIComponent(title)}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(discover.ok(), await discover.text()).toBeTruthy();
    const titles = ((await discover.json())?.data || []).map((j: { title: string }) => j.title);
    expect(titles).toContain(title);

    const apply = await request.post(`${API}/jcms/jobs/${jobId}/applications`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { answers: {} },
    });
    expect(apply.ok(), await apply.text()).toBeTruthy();
  });
});
