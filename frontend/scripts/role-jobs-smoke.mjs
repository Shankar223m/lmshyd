/**
 * Smoke-test job portal reachability per demo role (API login + key routes).
 * Run: node scripts/role-jobs-smoke.mjs
 */
const BASE = process.env.API_BASE ?? "http://127.0.0.1:8000/api/v1";

const ROLES = [
  {
    name: "Student",
    email: "demo.student1@example.com",
    password: "Stud3nt!Lms#Demo1",
    routes: [
      "/jobs/student/dashboard",
      "/jobs/student/jobs",
      "/jobs/student/applications",
      "/jobs/student/offers",
    ],
    purpose: "Discover jobs, apply, track interviews & offers",
  },
  {
    name: "Institution head",
    email: "demo.head1@example.com",
    password: "H3ad!Inst#Demo1",
    routes: ["/jobs/institution/placements", "/jobs/institution/jobs/new", "/jobs/institution/analytics"],
    purpose: "Campus jobs, placement verification, stats",
  },
  {
    name: "Staff",
    email: "demo.staff1@example.com",
    password: "St4ff!Prof#Demo1",
    routes: ["/jobs/institution/placements", "/jobs"],
    purpose: "Usually academics only; institution jobs if permission grants",
  },
  {
    name: "Employer admin",
    email: "demo.employer1@example.com",
    password: "H1re!Demo#Emp1",
    routes: ["/jobs/employer/jobs", "/jobs/employer/pipeline", "/jobs/employer/interviews"],
    purpose: "Post OPEN jobs, pipeline, interviews, offers",
  },
  {
    name: "Recruiter",
    email: "demo.recruiter1@example.com",
    password: "H1re!Demo#Rec1",
    routes: ["/jobs/employer/jobs", "/jobs/employer/pipeline"],
    purpose: "Same hiring UI as employer (merged persona)",
  },
  {
    name: "Super admin",
    email: "demo.superadmin1@example.com",
    password: "Sup3r!Admin#Demo1",
    routes: ["/jobs/admin/dashboard", "/jobs/admin/review", "/jobs/admin/postings"],
    purpose: "Moderate jobs & verify employers",
  },
  {
    name: "Scoped admin",
    email: "demo.admin1@example.com",
    password: "Adm1n!Demo#Acct1",
    routes: ["/jobs", "/"],
    purpose: "No careers.manage → /jobs should bounce home",
  },
];

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, message: json.message ?? res.statusText, role: null, menu: [] };
  const token = json.token?.access_token;
  const user = json.user;
  let menu = [];
  let perms = [];
  if (token) {
    const me = await fetch(`${BASE}/users/me/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (me.ok) {
      const p = await me.json();
      const body = p.permissions ?? p;
      menu = body.menu ?? [];
      perms = body.permissions ?? [];
    }
  }
  return {
    ok: true,
    role: user?.role,
    menu,
    hasJobsMenu: menu.includes("jobs"),
    jobsPerms: perms.filter((k) => k.startsWith("jobs.")),
  };
}

async function jcmsPing(token, path) {
  const res = await fetch(`${BASE}/jcms${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let preview = text.slice(0, 80);
  try {
    const j = JSON.parse(text);
    preview = j.code ?? j.status ?? (Array.isArray(j.data) ? `data[${j.data.length}]` : "ok");
  } catch {
    /* raw */
  }
  return { status: res.status, preview };
}

async function main() {
  console.log("Job portal role smoke — API at", BASE, "\n");
  for (const r of ROLES) {
    const loginResult = await login(r.email, r.password);
    console.log("═".repeat(60));
    console.log(`${r.name} (${r.email})`);
    console.log(`Purpose: ${r.purpose}`);
    if (!loginResult.ok) {
      console.log("  LOGIN FAILED:", loginResult.status, loginResult.message);
      console.log("  → Run seed-demo-accounts if employer/recruiter missing.\n");
      continue;
    }
    console.log(`  LMS role: ${loginResult.role} | jobs menu: ${loginResult.hasJobsMenu ? "yes" : "no"}`);
    if (loginResult.jobsPerms.length) console.log(`  jobs.* perms: ${loginResult.jobsPerms.join(", ")}`);

    const token = (
      await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: r.email, password: r.password }),
      }).then((x) => x.json())
    ).token?.access_token;

    const jcmsChecks =
      r.name === "Student"
        ? [
            ["/jobs/discover?page=1&page_size=5", "discover"],
            ["/students/me/dashboard", "dashboard"],
            ["/applications/me", "applications"],
            ["/offers/me", "offers"],
          ]
        : r.name === "Employer admin" || r.name === "Recruiter"
          ? [["/employers/me/jobs", "employer jobs"]]
          : r.name === "Institution head"
            ? [["/institutions/me/placements", "placements"]]
            : r.name === "Super admin"
              ? [["/admin/stats", "admin stats"]]
              : [];

    for (const [path, label] of jcmsChecks) {
      const ping = await jcmsPing(token, path);
      console.log(`  JCMS ${label}: HTTP ${ping.status} (${ping.preview})`);
    }
    console.log(`  UI routes to try: ${r.routes.join(", ")}`);
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});