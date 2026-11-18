/**
 * CI helper: every navigation `to` (except http) should exist as a route path in router.tsx.
 * Run: node scripts/check-nav-routes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const routeSources = [
  path.join(root, "src/app/router.tsx"),
  path.join(root, "src/modules/jobs/routes.tsx"),
  path.join(root, "src/modules/dashboard/routes.tsx"),
  path.join(root, "src/modules/user-management/academics/routes.tsx"),
];
const navTs = fs.readFileSync(path.join(root, "src/app/navigation.ts"), "utf8");
const jobsNavTs = fs.readFileSync(path.join(root, "src/modules/jobs/jobsNavChildren.ts"), "utf8");

const TO_RE = /\bto:\s*["'`]([^"'`]+)["'`]/g;

function collectToPaths(source) {
  return [...source.matchAll(TO_RE)].map((m) => m[1]);
}

const routePaths = new Set(
  routeSources.flatMap((file) => [...fs.readFileSync(file, "utf8").matchAll(/path:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1])),
);
const navPaths = [...new Set([...collectToPaths(navTs), ...collectToPaths(jobsNavTs)])];

const allowRedirects = new Set(["/my-learning", "/courses/my"]);

function routeMatchesNav(navPath, routes) {
  for (const r of routes) {
    if (r === navPath) return true;
    if (navPath.startsWith(`${r}/`)) return true;
  }
  return false;
}

const missing = navPaths.filter(
  (p) =>
    !p.startsWith("http") &&
    !p.includes(":") &&
    !allowRedirects.has(p) &&
    !routeMatchesNav(p, routePaths),
);

if (missing.length) {
  console.error("Nav paths without an obvious router match:\n", missing.join("\n "));
  process.exit(1);
}
console.log("nav/route check passed");
