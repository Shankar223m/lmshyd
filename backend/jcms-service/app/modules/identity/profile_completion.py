from app.models.entities import StudentProfile


def compute_profile_completion_percent(profile: StudentProfile | None) -> int:
    """Percent of core student profile fields populated (aligned with eligibility inputs)."""
    if not profile:
        return 0
    fields = [
        bool((profile.program or "").strip()),
        profile.graduation_year is not None,
        profile.cgpa is not None,
        bool((profile.location or "").strip()),
        bool(profile.skills),
        bool(profile.resume_file_id),
        bool((profile.phone or "").strip()),
    ]
    return int(round(100 * sum(fields) / len(fields)))
