from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import EligibilityEvaluation, EligibilityRule, Job, StudentProfile, User
from app.modules.audit.service import record_audit
from app.shared.enums import EligibilityResult, JobStatus, UserRole


def evaluate_eligibility(db: Session, job: Job, student: User) -> EligibilityEvaluation:
    profile = student.student_profile
    rules = list(db.scalars(select(EligibilityRule).where(EligibilityRule.job_id == job.id)).all())
    if not rules:
        rules = _default_rules(job)

    details: list[dict] = []
    required_failed = False
    met = 0
    total = 0

    for rule in rules:
        total += 1
        ok, message = _eval_rule(rule.rule_type, rule.config, profile, job)
        details.append({"rule": rule.rule_type, "passed": ok, "message": message, "required": rule.is_required})
        if ok:
            met += 1
        elif rule.is_required:
            required_failed = True

    if not profile:
        result = EligibilityResult.NEEDS_REVIEW.value
    elif required_failed:
        result = EligibilityResult.NOT_ELIGIBLE.value
    elif met < total:
        result = EligibilityResult.NEEDS_REVIEW.value
    else:
        result = EligibilityResult.ELIGIBLE.value

    match_percent = int((met / total) * 100) if total else 0
    ev = EligibilityEvaluation(
        job_id=job.id,
        student_id=student.id,
        result=result,
        details=details,
        match_percent=match_percent,
    )
    db.add(ev)
    db.flush()
    return ev


def get_rules_for_job(db: Session, job: Job) -> list[EligibilityRule]:
    rules = list(db.scalars(select(EligibilityRule).where(EligibilityRule.job_id == job.id)).all())
    return rules


def rules_as_dict(rules: list[EligibilityRule]) -> dict:
    """Flatten stored rules into employer-editable form fields."""
    out = {
        "programs": ["B.Tech CSE", "B.Tech Computer Science"],
        "graduation_year_min": 2025,
        "graduation_year_max": 2027,
        "min_cgpa": 7.0,
        "required_skills": [],
        "max_backlogs": None,
    }
    for rule in rules:
        cfg = rule.config or {}
        if rule.rule_type == "PROGRAM":
            out["programs"] = list(cfg.get("programs") or out["programs"])
        elif rule.rule_type == "GRADUATION_YEAR":
            out["graduation_year_min"] = int(cfg.get("min", out["graduation_year_min"]))
            out["graduation_year_max"] = int(cfg.get("max", out["graduation_year_max"]))
        elif rule.rule_type == "CGPA":
            out["min_cgpa"] = float(cfg.get("min", out["min_cgpa"]))
        elif rule.rule_type == "SKILLS":
            out["required_skills"] = list(cfg.get("required") or [])
        elif rule.rule_type == "BACKLOGS":
            out["max_backlogs"] = cfg.get("max")
    return out


def validate_eligibility_payload(data: dict) -> dict:
    programs = [p.strip() for p in (data.get("programs") or []) if str(p).strip()]
    if not programs:
        raise ValueError("ELIGIBILITY_PROGRAMS_REQUIRED")
    ymin = int(data.get("graduation_year_min", 2025))
    ymax = int(data.get("graduation_year_max", 2027))
    if ymin > ymax:
        raise ValueError("INVALID_GRADUATION_YEAR_RANGE")
    min_cgpa = float(data.get("min_cgpa", 0))
    if min_cgpa < 0 or min_cgpa > 10:
        raise ValueError("INVALID_MIN_CGPA")
    max_backlogs = data.get("max_backlogs")
    if max_backlogs is not None:
        max_backlogs = int(max_backlogs)
        if max_backlogs < 0:
            raise ValueError("INVALID_MAX_BACKLOGS")
    skills = [s.strip() for s in (data.get("required_skills") or []) if str(s).strip()]
    return {
        "programs": programs,
        "graduation_year_min": ymin,
        "graduation_year_max": ymax,
        "min_cgpa": min_cgpa,
        "required_skills": skills,
        "max_backlogs": max_backlogs,
    }


def replace_eligibility_rules(db: Session, job: Job, data: dict, actor: User) -> list[EligibilityRule]:
    """Replace job eligibility rules. Does not mutate historical EligibilityEvaluation rows."""
    if actor.role != UserRole.EMPLOYER.value or actor.organization_id != job.organization_id:
        raise ValueError("FORBIDDEN")
    if job.status in (JobStatus.CLOSED.value, JobStatus.CANCELLED.value, JobStatus.EXPIRED.value):
        raise ValueError("JOB_NOT_EDITABLE")
    validated = validate_eligibility_payload(data)
    for old in db.scalars(select(EligibilityRule).where(EligibilityRule.job_id == job.id)).all():
        db.delete(old)
    db.flush()
    rules = _rules_from_payload(job.id, validated, job)
    for r in rules:
        db.add(r)
    db.flush()
    # Keep job.skills aligned with skill requirements when provided
    job.skills = list(validated["required_skills"])
    record_audit(
        db,
        actor_id=actor.id,
        action="job.eligibility.update",
        resource_type="job",
        resource_id=job.id,
        metadata={"programs": validated["programs"], "min_cgpa": validated["min_cgpa"]},
    )
    return rules


def seed_eligibility_from_payload(db: Session, job: Job, data: dict | None) -> None:
    if data:
        validated = validate_eligibility_payload(data)
        for r in _rules_from_payload(job.id, validated, job):
            db.add(r)
        if validated.get("required_skills") is not None:
            job.skills = list(validated["required_skills"])
    else:
        for r in _default_rules(job):
            db.add(r)
    db.flush()


def _rules_from_payload(job_id: str, validated: dict, job: Job) -> list[EligibilityRule]:
    rules = [
        EligibilityRule(job_id=job_id, rule_type="PROGRAM", config={"programs": validated["programs"]}, is_required=True),
        EligibilityRule(
            job_id=job_id,
            rule_type="GRADUATION_YEAR",
            config={"min": validated["graduation_year_min"], "max": validated["graduation_year_max"]},
            is_required=True,
        ),
        EligibilityRule(job_id=job_id, rule_type="CGPA", config={"min": validated["min_cgpa"]}, is_required=True),
        EligibilityRule(
            job_id=job_id,
            rule_type="SKILLS",
            config={"required": validated["required_skills"]},
            is_required=False,
        ),
    ]
    if validated.get("max_backlogs") is not None:
        rules.append(
            EligibilityRule(
                job_id=job_id,
                rule_type="BACKLOGS",
                config={"max": validated["max_backlogs"]},
                is_required=True,
            )
        )
    return rules


def _default_rules(job: Job) -> list:
    return [
        EligibilityRule(job_id=job.id, rule_type="PROGRAM", config={"programs": ["B.Tech CSE", "B.Tech Computer Science"]}),
        EligibilityRule(job_id=job.id, rule_type="GRADUATION_YEAR", config={"min": 2025, "max": 2027}),
        EligibilityRule(job_id=job.id, rule_type="CGPA", config={"min": 7.0}),
        EligibilityRule(job_id=job.id, rule_type="SKILLS", config={"required": job.skills or []}, is_required=False),
    ]


def _eval_rule(rule_type: str, config: dict, profile: StudentProfile | None, job: Job) -> tuple[bool, str]:
    if not profile:
        return False, "Complete your profile first"
    if rule_type == "PROGRAM":
        allowed = config.get("programs", [])
        ok = profile.program in allowed if profile.program else False
        return ok, f"Program {profile.program or 'missing'} {'accepted' if ok else 'not accepted'}"
    if rule_type == "GRADUATION_YEAR":
        y = profile.graduation_year
        if y is None:
            return False, "Graduation year missing"
        ok = config.get("min", 0) <= y <= config.get("max", 9999)
        return ok, f"{y} within range" if ok else f"{y} outside allowed range"
    if rule_type == "CGPA":
        if profile.cgpa is None:
            return False, "CGPA missing"
        ok = float(profile.cgpa) >= float(config.get("min", 0))
        return ok, f"{profile.cgpa} CGPA · minimum {config.get('min')}"
    if rule_type == "SKILLS":
        required = config.get("required") or []
        have = set(profile.skills or [])
        missing = [s for s in required if s not in have]
        if not required:
            return True, "No skill requirements"
        ok = len(missing) == 0
        return ok, "All skills present" if ok else f"Missing: {', '.join(missing)}"
    if rule_type == "BACKLOGS":
        # Profile has no dedicated backlog field; treat missing as needs-review pass when max set.
        # Employers can still store the rule for display; evaluation passes if max is None.
        max_b = config.get("max")
        if max_b is None:
            return True, "No backlog limit"
        return True, f"Max backlogs allowed: {max_b} (profile field not collected)"
    return True, "Rule passed"
