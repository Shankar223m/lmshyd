"""Eligibility: the hard rules a job sets, applied before any scoring.

A student who fails a rule is not scored for that job and cannot apply to it.
Configured rules are enforced consistently. Optional fields left unconfigured do NOT
disqualify any student. Missing CGPA does not by itself disqualify (profile may still
be completing); missing graduation year / branch when those rules are set do.
"""

from app.matching.model import Candidate, Eligibility, JobSpec


def check(job: JobSpec, candidate: Candidate, *, course_titles: dict[int, str]) -> Eligibility:
    reasons: list[str] = []
    rules = job.eligibility or {}

    # 1. Graduation years
    years = rules.get("graduation_years")
    if years and (years.get("min") is not None or years.get("max") is not None):
        low, high = years.get("min"), years.get("max")
        year = candidate.graduation_year
        if year is None:
            reasons.append("Add your education details (graduation year) to your profile.")
        elif (low is not None and year < low) or (high is not None and year > high):
            span = (
                str(low)
                if low is not None and low == high
                else f"{low}–{high}"
                if low is not None and high is not None
                else f"{low} or later"
                if low is not None
                else f"{high} or earlier"
            )
            reasons.append(f"Open to graduation years {span} (yours: {year}).")

    # 2. Required Certificate Courses
    for raw in rules.get("certificate_course_ids") or []:
        course_id = int(raw)
        if course_id not in candidate.certificate_course_ids:
            reasons.append(f"Requires the certificate for {course_titles.get(course_id) or 'a required course'}.")

    # 3. Minimum Assessment Scores
    for rule in rules.get("min_scores") or []:
        course_id, minimum = int(rule["course_id"]), float(rule["min_percent"])
        title = course_titles.get(course_id) or "a course"
        have = candidate.scores.get(course_id)
        if have is None:
            reasons.append(f"Requires at least {minimum:g}% in {title} (you have no passed result yet).")
        elif have < minimum:
            reasons.append(f"Requires at least {minimum:g}% in {title} (yours: {have:g}%).")

    # 4. Minimum CGPA (optional). Missing CGPA does not disqualify — only a known low CGPA does.
    raw_min_cgpa = rules.get("min_cgpa")
    if raw_min_cgpa is not None:
        try:
            min_cgpa = float(raw_min_cgpa)
        except (ValueError, TypeError):
            min_cgpa = None
        if min_cgpa is not None and min_cgpa > 0 and candidate.cgpa is not None and candidate.cgpa < min_cgpa:
            reasons.append(f"Requires minimum CGPA of {min_cgpa:.2f} (yours: {candidate.cgpa:.2f}).")

    # 5. Eligible Degrees (optional)
    degrees = rules.get("degrees")
    if degrees and isinstance(degrees, list):
        allowed_degrees = [str(d).strip() for d in degrees if str(d).strip() and str(d).strip().lower() not in ("all", "all degrees")]
        if allowed_degrees:
            allowed_deg_lower = {d.lower() for d in allowed_degrees}
            cand_degrees = [d.lower() for d in candidate.degrees] if candidate.degrees else []
            # Fall back to education strings when structured degrees are absent
            if not cand_degrees and candidate.education:
                cand_degrees = [e.lower() for e in candidate.education]
            if cand_degrees:

                def _deg_matches(cd: str, ad_set: set[str]) -> bool:
                    return any(ad in cd or cd in ad for ad in ad_set)

                if not any(_deg_matches(cd, allowed_deg_lower) for cd in cand_degrees):
                    reasons.append(f"Open to degrees: {', '.join(allowed_degrees)}.")

    # 6. Eligible Branches / Departments (optional)
    branches = rules.get("branches")
    if branches and isinstance(branches, list):
        allowed_branches = [
            str(b).strip() for b in branches if str(b).strip() and str(b).strip().lower() not in ("all", "all branches")
        ]
        if allowed_branches:
            cand_branch = (candidate.branch or "").strip()
            if not cand_branch:
                reasons.append(f"Open to branches: {', '.join(allowed_branches)} (yours: None).")
            else:
                allowed_lower = {b.lower() for b in allowed_branches}

                def _branch_matches(cb: str, ab_set: set[str]) -> bool:
                    c_low = cb.lower()
                    if c_low in ab_set:
                        return True
                    synonyms = {
                        "cse": {"computer science", "computer science & engineering", "computer science and engineering", "cs"},
                        "computer science": {"cse", "computer science & engineering", "computer science and engineering", "cs"},
                        "it": {"information technology"},
                        "information technology": {"it"},
                        "ece": {"electronics", "electronics & communication", "electronics and communication engineering"},
                        "electronics": {"ece", "electronics & communication", "electronics and communication engineering"},
                    }
                    expanded = set(synonyms.get(c_low, set()))
                    return bool(expanded & ab_set) or any(ab in c_low or c_low in ab for ab in ab_set)

                if not _branch_matches(cand_branch, allowed_lower):
                    reasons.append(f"Open to branches: {', '.join(allowed_branches)} (yours: {candidate.branch}).")

    # 7. Maximum Active Backlogs (optional). Missing backlogs does not disqualify.
    max_backlogs = rules.get("max_backlogs")
    if max_backlogs is not None:
        try:
            max_b = int(max_backlogs)
        except (ValueError, TypeError):
            max_b = None
        if max_b is not None and candidate.backlogs is not None and candidate.backlogs > max_b:
            reasons.append(f"Requires maximum {max_b} active backlogs (yours: {candidate.backlogs}).")

    # 8. Minimum experience from eligibility rules only (not job.experience_min_months — that is soft scoring).
    min_exp = rules.get("min_experience_months")
    if min_exp:
        try:
            min_exp_i = int(min_exp)
        except (ValueError, TypeError):
            min_exp_i = 0
        if min_exp_i > 0 and candidate.experience_months < min_exp_i:
            min_y = min_exp_i / 12
            cand_y = candidate.experience_months / 12
            reasons.append(f"Requires minimum {min_y:g} years of experience (yours: {cand_y:g} years).")

    # 9. Required skills inside eligibility rules (optional)
    req_skills = rules.get("required_skills")
    if req_skills and isinstance(req_skills, list):
        cand_skills_lower = {s.lower() for s in candidate.skills} | {t.lower() for t in candidate.technologies}
        missing_skills = [s for s in req_skills if s.strip() and s.strip().lower() not in cand_skills_lower]
        if missing_skills:
            reasons.append(f"Requires skills: {', '.join(missing_skills)}.")

    # 10. Institution restriction
    if job.restricted and (candidate.organization_id is None or candidate.organization_id not in job.institution_ids):
        reasons.append("This job is open only to students of selected institutions.")

    return Eligibility(eligible=not reasons, reasons=reasons)
