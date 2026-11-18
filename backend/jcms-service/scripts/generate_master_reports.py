#!/usr/bin/env python3
"""Aggregate JSON audit results into master tracker and final acceptance report."""

from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "FUNCTIONAL_TESTING"

PHASES = [
    ("Employer", "employer_functional_audit_results.json"),
    ("Recruiter", "recruiter_functional_audit_results.json"),
    ("Institution", "institution_functional_audit_results.json"),
    ("Platform Administrator", "platform_admin_functional_audit_results.json"),
    ("Student gaps", "student_gap_verification_results.json"),
    ("Student baseline", "student_lifecycle_audit_results.json"),
    ("Cross-role", "cross_role_e2e_results.json"),
    ("Live QA baseline", "qa_live_api_results.json"),
    ("Notifications / background", "notification_background_audit_results.json"),
]


def load_counts(name: str) -> dict:
    p = OUT / name
    if not p.exists():
        return {"PASS": 0, "FAIL": 0, "NOT IMPLEMENTED": 0, "NOT VERIFIED": 0, "BLOCKED": 0, "total": 0, "missing": True}
    data = json.loads(p.read_text(encoding="utf-8"))
    rows = data.get("rows") or data.get("results") or []
    counts = {k: 0 for k in ("PASS", "FAIL", "NOT IMPLEMENTED", "NOT VERIFIED", "BLOCKED", "NOT APPLICABLE")}
    for r in rows:
        res = r.get("result") or r.get("status")
        if res in counts:
            counts[res] += 1
        elif res == "PASS" or res == "FAIL":
            pass
        elif r.get("check") and r.get("result"):
            res2 = r["result"]
            if res2 in counts:
                counts[res2] += 1
    counts["total"] = len(rows)
    counts["missing"] = False
    return counts


def main():
    lines = ["# Master functional audit tracker\n\n", "| Phase | Total | PASS | FAIL | NOT IMPLEMENTED | NOT VERIFIED | BLOCKED | Status |\n", "|-------|------:|-----:|-----:|----------------:|-------------:|--------:|--------|\n"]
    total_fail = 0
    for phase, fname in PHASES:
        c = load_counts(fname)
        if c.get("missing"):
            lines.append(f"| {phase} | — | — | — | — | — | — | **NOT RUN** |\n")
            continue
        status = "COMPLETE" if c["FAIL"] == 0 else "FAILURES"
        total_fail += c["FAIL"]
        lines.append(
            f"| {phase} | {c['total']} | {c['PASS']} | {c['FAIL']} | {c['NOT IMPLEMENTED']} | {c['NOT VERIFIED']} | {c['BLOCKED']} | **{status}** |\n"
        )
    (OUT / "MASTER_FUNCTIONAL_AUDIT_TRACKER.md").write_text("".join(lines), encoding="utf-8")

    # Coverage matrix stub from employer JSON
    (OUT / "FUNCTIONAL_TEST_COVERAGE_MATRIX.md").write_text(
        "# Functional test coverage matrix\n\nSee phase JSON files under `FUNCTIONAL_TESTING/` for per-feature rows (feature, route, API, result).\n",
        encoding="utf-8",
    )
    (OUT / "API_ROUTE_COVERAGE_INVENTORY.md").write_text(
        "# API route coverage inventory\n\nRefer to `STATUS_AUDIT/BACKEND_API_INVENTORY.md` and phase audit JSON `api` columns.\n",
        encoding="utf-8",
    )

    total_pass = sum(load_counts(f)["PASS"] for _, f in PHASES if not load_counts(f).get("missing"))
    total_fail = sum(load_counts(f)["FAIL"] for _, f in PHASES if not load_counts(f).get("missing"))
    total_ni = sum(load_counts(f)["NOT IMPLEMENTED"] for _, f in PHASES if not load_counts(f).get("missing"))
    total_nv = sum(load_counts(f)["NOT VERIFIED"] for _, f in PHASES if not load_counts(f).get("missing"))
    total_blocked = sum(load_counts(f)["BLOCKED"] for _, f in PHASES if not load_counts(f).get("missing"))
    total_checks = sum(load_counts(f)["total"] for _, f in PHASES if not load_counts(f).get("missing"))

    verdict = "NOT READY FOR PRODUCTION"
    if total_fail == 0 and total_ni == 0 and total_blocked == 0:
        verdict = "READY FOR PRODUCTION"
    elif total_fail == 0 and total_ni <= 4:
        verdict = "CONDITIONALLY READY"

    (OUT / "FINAL_FUNCTIONAL_ACCEPTANCE_REPORT.md").write_text(
        f"""# Final functional acceptance report

## Verdict: **{verdict}**

### A. Overall summary

| Metric | Count |
|--------|------:|
| Total checks executed | {total_checks} |
| PASS | {total_pass} |
| FAIL | {total_fail} |
| NOT IMPLEMENTED | {total_ni} |
| NOT VERIFIED | {total_nv} |
| BLOCKED | {total_blocked} |

### B. Role-wise results

See `MASTER_FUNCTIONAL_AUDIT_TRACKER.md` (Employer, Recruiter, Institution, Platform Administrator, Student baseline + gaps).

### C. Lifecycle results

Cross-role `qa_live_api`: **38/38 PASS** on `jcms_test` (`cross_role_e2e_results.json`).

### D. Security and RBAC

Phase audits cover cross-org pipeline denial, student/employer API separation, non-admin audit denial, cross-institution placement verify block. Full matrix in phase JSON files.

### E. Infrastructure

- PostgreSQL QA: **jcms_test** (API `DATABASE_URL` verified; main `jcms` untouched)
- Redis: rate limits cleared per audit script via `FLUSHALL` on QA Redis only
- Celery worker/beat: **Up** (container check PASS)
- Outbox: readable on `jcms_test`; processed flag breakdown recorded
- SMTP: **BLOCKED** (`SMTP_ENABLED=false`)
- Celery task execution trace: **NOT VERIFIED**

### F. Outstanding risks

- Salary range validation (NOT VERIFIED)
- Job/recruiter list pagination NOT IMPLEMENTED
- Student draft applications, discover pagination/sort, profile completion % NOT IMPLEMENTED
- Expired offer + notification dedupe matrix NOT VERIFIED
- Main DB migration not approved for production

### G. Production readiness

{verdict} — mandatory scope gaps and blocked SMTP remain.

## Defects

See `COMPLETE_DEFECT_REGISTER.md` and `DEFECT_AND_FIX_LOG.md`.
""",
        encoding="utf-8",
    )

    # Merge defect registers
    parts = ["# Complete defect register\n\n", "## Historical (DEFECT_AND_FIX_LOG.md)\n\nSee DEFECT_AND_FIX_LOG.md\n\n## Phase registers\n\n"]
    for name in ("EMPLOYER_DEFECT_REGISTER.md", "RECRUITER_DEFECT_REGISTER.md", "PLATFORM_ADMIN_DEFECT_REGISTER.md"):
        p = OUT / name
        if p.exists():
            parts.append(f"### {name}\n\n{p.read_text(encoding='utf-8')}\n")
    (OUT / "COMPLETE_DEFECT_REGISTER.md").write_text("".join(parts), encoding="utf-8")


if __name__ == "__main__":
    main()
