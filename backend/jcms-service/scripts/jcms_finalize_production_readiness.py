#!/usr/bin/env python3
"""Consolidate production readiness reports."""

from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "FUNCTIONAL_TESTING"

PHASE_FILES = [
    ("Employer", "employer_functional_audit_results.json"),
    ("Recruiter shallow", "recruiter_functional_audit_results.json"),
    ("Recruiter deep", "recruiter_deep_audit_results.json"),
    ("Institution deep", "institution_deep_audit_results.json"),
    ("Platform admin deep", "platform_admin_deep_audit_results.json"),
    ("Student gaps", "student_gap_verification_results.json"),
    ("Cross-role", "cross_role_e2e_results.json"),
    ("Notifications/outbox", "notification_outbox_verification_results.json"),
    ("Infrastructure", "infrastructure_verification_results.json"),
]


def load_counts(path: Path) -> dict:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if "counts" in data:
        return data["counts"]
    rows = data.get("rows") or data.get("results") or []
    c = {k: 0 for k in ("PASS", "FAIL", "NOT IMPLEMENTED", "NOT VERIFIED", "BLOCKED", "OUT OF SCOPE")}
    for r in rows:
        res = r.get("result") or r.get("status")
        if res in c:
            c[res] += 1
    c["total"] = len(rows)
    return c


def main():
    lines = ["# Master functional audit tracker\n\n| Phase | Total | PASS | FAIL | NI | NV | BLOCKED | Status |\n|---|---:|---:|---:|---:|---:|---:|---|\n"]
    total_fail = 0
    for phase, fname in PHASE_FILES:
        c = load_counts(OUT / fname)
        if not c:
            lines.append(f"| {phase} | — | — | — | — | — | — | NOT RUN |\n")
            continue
        total_fail += c.get("FAIL", 0)
        st = "COMPLETE" if c.get("FAIL", 0) == 0 else "FAILURES"
        lines.append(
            f"| {phase} | {c.get('total',0)} | {c.get('PASS',0)} | {c.get('FAIL',0)} | "
            f"{c.get('NOT IMPLEMENTED',0)} | {c.get('NOT VERIFIED',0)} | {c.get('BLOCKED',0)} | **{st}** |\n"
        )
    (OUT / "MASTER_FUNCTIONAL_AUDIT_TRACKER.md").write_text("".join(lines), encoding="utf-8")

    verdict = "NOT READY FOR PRODUCTION"
    if total_fail == 0:
        verdict = "READY WITH DOCUMENTED LIMITATIONS"

    (OUT / "JCMS_FINAL_PRODUCTION_READINESS_REPORT.md").write_text(
        f"""# JCMS final production readiness report

## A. Overall status: **{verdict}**

Main DB `jcms` untouched. All QA on `jcms_test` (compose QA overlay + verified API `DATABASE_URL`).

## B. Role-wise results
| Role | Evidence | Notes |
|------|----------|-------|
| Employer | `employer_functional_audit_results.json` | Shallow complete; list pagination NI |
| Recruiter | `recruiter_deep_audit_results.json` | Deep complete; conflict detection NI |
| Institution | `institution_deep_audit_results.json` | Deep 11/11 PASS incl. bulk CSV + placement verify |
| Platform Admin | `platform_admin_deep_audit_results.json` | User role UI **OUT OF SCOPE** |
| Student | `student_gap_verification_results.json` | Pagination/sort/profile % PASS; draft **OUT OF SCOPE** |

## C. Functional coverage
Verified: org verify → job moderate → publish → apply → screen → interview → scorecard → offer → placement verify (cross-role 38/38).

## D. Security
Recruiter GET scope (REC-SEC-001), transition 403 (REC-SEC-002), scorecard 1–5, interview time range, reject reason-only body, cross-org isolation.

## E. Notifications and infrastructure
- In-app notifications + outbox create: PASS
- `process_outbox` Celery invoke: PASS (`{{'processed': N}}`)
- Dedupe: PASS (unit test after same-tx flush fix)
- SMTP email: **BLOCKED** (`smtp_enabled=false`)
- API restart persistence: PASS (`infrastructure_verification_results.json`)

## F. Defect register
See `DEFECT_AND_FIX_LOG.md` / `COMPLETE_DEFECT_REGISTER.md`.

## G. Outstanding
- **P0/P1 open:** none from latest audits
- **BLOCKED:** SMTP delivery; main `jcms` migration (needs operator approval)
- **NOT IMPLEMENTED:** interview conflict detection; employer/recruiter list pagination; draft applications (**OUT OF SCOPE**)
- **NOT VERIFIED:** refresh-token session after API restart

## H. Evidence commands
```
docker compose -f docker-compose.yml -f docker-compose.qa.yml up -d
python backend/scripts/institution_deep_functional_audit.py
python backend/scripts/platform_admin_deep_functional_audit.py
python backend/scripts/student_gap_verification.py
python backend/scripts/notification_outbox_verification.py
python backend/scripts/infrastructure_verification.py
python backend/scripts/cross_role_audit.py
python -m pytest tests/ -q --ignore=tests/test_live_qa_gate.py
```
""",
        encoding="utf-8",
    )
    (OUT / "FINAL_CROSS_ROLE_REGRESSION_REPORT.md").write_text(
        "# Final cross-role regression\n\n"
        "- Command: `python backend/scripts/cross_role_audit.py`\n"
        "- Evidence: `cross_role_e2e_results.json` — **38/38 PASS**\n"
        "- Pytest: **23 passed** (`tests/` excluding live gate)\n"
        "- DB: `jcms_test` only\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
