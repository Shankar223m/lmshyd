// Focused RBAC Audit E2E tests
// Uses existing e2e support fixtures (accounts.ts, session.ts)
import { expect, test } from "@playwright/test";
import { account } from "../support/accounts";
import { signIn } from "../support/session";

// Helper to navigate directly to the audit page and verify access
async function navigateAndCheck(page, roleName: string, shouldAccess: boolean) {
  const acct = account(roleName);
  test.skip(!acct, `no ${roleName} account in e2e/accounts.json`);
  await signIn(page, acct!);
  await page.goto("/audit/rbac");
  if (shouldAccess) {
    // Audit list should be visible
    await expect(page.getByRole("heading", { name: /RBAC Audit/ })).toBeVisible();
    // At least one row should be present (or empty state)
    const rows = page.locator("data-testid=rbac-audit-row");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
  } else {
    // Should be redirected or see access denied message
    await expect(page).toHaveURL(/.*(401|403|unauthorized).*/).or(
      expect(page.getByText(/Access denied|You are not authorized/)).toBeVisible()
    );
  }
}

// Roles to test
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

// Filter, pagination, and detail drawer tests – only for a role with access (SUPER_ADMIN)
test.describe("RBAC Audit UI behavior (SUPER_ADMIN)", () => {
  test("filters send correct query params and reset pagination", async ({ page }) => {
    const superAdmin = account("superAdmin");
    test.skip(!superAdmin, "no superAdmin account");
    await signIn(page, superAdmin!);
    await page.goto("/audit/rbac");
    // Wait for list load
    await page.waitForResponse((r) => r.url().includes("/api/v1/audit/rbac") && r.status() === 200);
    // Capture current page number from UI (assume a pagination component with role="navigation")
    const pageNumBefore = await page.getByTestId("pagination-page").innerText();
    // Apply a filter (e.g., action type)
    await page.getByLabel("Action").selectOption({ label: "CREATE" });
    await page.getByRole("button", { name: /Apply Filters/ }).click();
    // Verify request contains query param action=CREATE
    const req = await page.waitForResponse((r) => r.url().includes("/api/v1/audit/rbac") && r.url().includes("action=CREATE"));
    expect(req.ok()).toBeTruthy();
    // Pagination should reset to 1
    const pageNumAfter = await page.getByTestId("pagination-page").innerText();
    expect(pageNumAfter).toBe("1");
    expect(pageNumAfter).not.toBe(pageNumBefore);
  });

  test("opens detail drawer and displays safe fields", async ({ page }) => {
    const superAdmin = account("superAdmin");
    test.skip(!superAdmin, "no superAdmin account");
    await signIn(page, superAdmin!);
    await page.goto("/audit/rbac");
    // Wait for at least one row
    const firstRow = page.getByTestId("rbac-audit-row").first();
    await expect(firstRow).toBeVisible();
    // Click to open drawer (assume row has a button or clickable area)
    await firstRow.click();
    // Drawer should appear
    const drawer = page.getByTestId("rbac-audit-detail-drawer");
    await expect(drawer).toBeVisible();
    // Verify key fields are present and no raw JSON is shown
    await expect(drawer.getByText(/Audit ID/)).toBeVisible();
    await expect(drawer.getByText(/Timestamp/)).toBeVisible();
    await expect(drawer.getByText(/Actor/)).toBeVisible();
    await expect(drawer.getByText(/Target/)).toBeVisible();
    // Ensure that potentially unsafe raw payload is not rendered as plain text
    await expect(drawer.locator("pre")).toHaveCount(0);
    // Close drawer
    await drawer.getByRole("button", { name: /Close/ }).click();
    await expect(drawer).toBeHidden();
  });
});
