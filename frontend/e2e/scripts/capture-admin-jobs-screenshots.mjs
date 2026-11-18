import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../../assets/admin-jobs-redesign");
mkdirSync(outDir, { recursive: true });

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const accounts = JSON.parse(readFileSync(join(__dirname, "../accounts.json"), "utf8"));
const who = accounts.superAdmin;

const pages = [
  { name: "01-overview", path: "/jobs/admin/dashboard", width: 390 },
  { name: "01-overview-desktop", path: "/jobs/admin/dashboard", width: 1440 },
  { name: "02-review-inbox", path: "/jobs/admin/review", width: 1440 },
  { name: "03-create-job", path: "/jobs/admin/jobs/new", width: 1440 },
  { name: "04-activity-log", path: "/jobs/admin/audit", width: 1440 },
];

async function signIn(page) {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email or username").fill(who.username);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext();
const authPage = await context.newPage();
await signIn(authPage);
await authPage.close();

for (const spec of pages) {
  const page = await context.newPage();
  await page.setViewportSize({ width: spec.width, height: spec.width === 390 ? 844 : 900 });
  await page.goto(`${baseURL}${spec.path}`);
  await page.locator("#main").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  const file = join(outDir, `${spec.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("Wrote", file);
  await page.close();
}

await browser.close();