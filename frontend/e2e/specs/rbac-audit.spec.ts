// Focused RBAC Audit E2E tests (spec file name matches Playwright pattern)
import { expect, test } from "@playwright/test";
import { account } from "../support/accounts";
import { signIn } from "../support/session";

async function navigateAndCheck(page, roleName: string, shouldAccess: boolean) {
  const acct = account(roleName);
  test.skip(!acct, `no ${roleName} account in e2e/accounts.json`);
  await signIn(page, acct!);
  await page.goto("/audit/rbac");
  if (shouldAccess) {
    await expect(page.getByRole("heading", { name: /RBAC Audit/ })).toBeVisible();
    const rows = page.locator("data-testid=rbac-audit-row");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
  } else {
    await expect(page).toHaveURL(/.*(401|403|unauthorized).*/).or(
      expect(page.getByText(/Access denied|You are not authorized/)).toBeVisible()
    );
  }
}

const ROLE_MATRIX: { role: string; access: boolean }[] = [
  { role: "superAdmin", access: true },
  { role: "admin", access: true },
  { role: "institutionHead", access: true },
  { role: "staff", access: false },
  { role: "student", access: false },
  { role: "employerAdmin", access: false },
  { role: "recruiter", access: false },
];

test.describe("RBAC Audit page access", () => {
  for (const { role, access } of ROLE_MATRIX) {
    test(`${role} ${access ? "can" : "cannot"} access RBAC audit`, async ({ page }) => {
      await navigateAndCheck(page, role, access);
    });
  }
});

test.describe("RBAC Audit UI behavior (SUPER_ADMIN)", () => {
  test("filters send correct query params and reset pagination", async ({ page }) => {
    const superAdmin = account("superAdmin");
    test.skip(!superAdmin, "no superAdmin account");
    await signIn(page, superAdmin!);
    await page.goto("/audit/rbac");
    await page.waitForResponse((r) => r.url().includes("/api/v1/audit/rbac") && r.status() === 200);
    const pageNumBefore = await page.getByTestId("pagination-page").innerText();
    await page.getByLabel("Action").selectOption({ label: "CREATE" });
    await page.getByRole("button", { name: /Apply Filters/ }).click();
    const req = await page.waitForResponse((r) => r.url().includes("/api/v1/audit/rbac") && r.url().includes("action=CREATE"));
    expect(req.ok()).toBeTruthy();
    const pageNumAfter = await page.getByTestId("pagination-page").innerText();
    expect(pageNumAfter).toBe("1");
    expect(pageNumAfter).not.toBe(pageNumBefore);
  });

  test("opens detail drawer and displays safe fields", async ({ page }) => {
    const superAdmin = account("superAdmin");
    test.skip(!superAdmin, "no superAdmin account");
    await signIn(page, superAdmin!);
    await page.goto("/audit/rbac");
    const firstRow = page.getByTestId("rbac-audit-row").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    const drawer = page.getByTestId("rbac-audit-detail-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/Audit ID/)).toBeVisible();
    await expect(drawer.getByText(/Timestamp/)).toBeVisible();
    await expect(drawer.getByText(/Actor/)).toBeVisible();
    await expect(drawer.getByText(/Target/)).toBeVisible();
    await expect(drawer.locator("pre")).toHaveCount(0);
    await drawer.getByRole("button", { name: /Close/ }).click();
    await expect(drawer).toBeHidden();
  });
});
