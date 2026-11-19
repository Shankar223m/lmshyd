import { expect, test, type Page } from "@playwright/test";

import { account } from "../support/accounts";
import { signIn } from "../support/session";

/** LMS Jobs & placements screens (`/jobs/...`). Requires stack + e2e/accounts.json. */

const SCREENS: {
  role: "student" | "head" | "staff" | "admin" | "superAdmin" | "employer" | "recruiter";
  path: string;
  heading: RegExp;
}[] = [
  { role: "student", path: "/jobs/student/dashboard", heading: /hi,|dashboard|applications|find jobs/i },
  { role: "student", path: "/jobs/student/jobs", heading: /find your next opportunity|recommended opportunities|open roles/i },
  { role: "student", path: "/jobs/student/applications", heading: /application/i },
  { role: "student", path: "/jobs/student/interviews", heading: /interview/i },
  { role: "student", path: "/jobs/student/offers", heading: /offer|placement/i },
  { role: "student", path: "/jobs/student/placement", heading: /placement/i },
  { role: "student", path: "/jobs/student/profile", heading: /profile/i },
  { role: "employer", path: "/jobs/employer/jobs", heading: /^jobs$|create job/i },
  { role: "employer", path: "/jobs/employer/pipeline", heading: /pipeline|pipelines by role|hiring/i },
  { role: "employer", path: "/jobs/employer/profile", heading: /profile|company/i },
  { role: "recruiter", path: "/jobs/employer/jobs", heading: /^jobs$|create job/i },
  { role: "recruiter", path: "/jobs/employer/pipeline", heading: /pipeline|hiring|candidate/i },
  { role: "head", path: "/jobs/institution/placements", heading: /placement/i },
  { role: "head", path: "/jobs/institution/students", heading: /student/i },
  { role: "staff", path: "/jobs/institution/placements", heading: /placement/i },
  { role: "staff", path: "/jobs/institution/students", heading: /student/i },
  { role: "superAdmin", path: "/jobs/admin/dashboard", heading: /jobs & placements|recruitment operations|organisations to verify|jobs to review|active job|could not load overview/i },
  { role: "superAdmin", path: "/jobs/admin/postings", heading: /published postings|live postings|all postings/i },
  { role: "superAdmin", path: "/jobs/admin/review", heading: /review inbox|all caught up|jobs \(/i },
  { role: "superAdmin", path: "/jobs/admin/audit", heading: /activity log|audit/i },
];

async function expectJobsShell(page: Page) {
  await expect(page.getByRole("navigation", { name: /main navigation/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#main")).toBeVisible();
}

test.describe("LMS Jobs & placements — screens", () => {
  for (const screen of SCREENS) {
    test(`${screen.role} can open ${screen.path}`, async ({ page }) => {
      const creds = account(screen.role);
      test.skip(!creds, `no ${screen.role} account in e2e/accounts.json`);
      await signIn(page, creds!);
      await page.goto(screen.path);
      await expectJobsShell(page);
      await expect(page).toHaveURL(new RegExp(screen.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      await expect(page.getByText(/something went wrong on our side|access denied|forbidden/i)).toHaveCount(0);
      const main = page.locator("#main");
      await expect(main).toContainText(screen.heading, { timeout: 45_000 });
    });
  }

  test("platform admin can open jobs create workspace", async ({ page }) => {
    const admin = account("superAdmin");
    test.skip(!admin, "no superAdmin account in e2e/accounts.json");
    await signIn(page, admin!);
    await page.goto("/jobs/admin/jobs/new");
    await expect(page).toHaveURL(/\/jobs\/admin\/jobs\/new/);
    await expect(page.getByRole("heading", { name: /create job/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /who is hiring/i })).toBeVisible();
    await expect(page.getByRole("combobox")).toBeVisible();
  });

  test("Jobs nav lands on role home", async ({ page }) => {
    const student = account("student");
    test.skip(!student, "no student account in e2e/accounts.json");
    await signIn(page, student!);
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/jobs\/(student|employer|recruiter|institution|admin)/);
  });
});
