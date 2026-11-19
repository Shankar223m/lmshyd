"""Resolve in-app navigation paths for notification resources by role."""


def notification_link_path(*, role: str, resource_type: str | None, resource_id: str | None) -> str | None:
    if not resource_type:
        return None
    r = role.upper()
    rt = resource_type.lower()

    if rt == "application":
        if r == "STUDENT":
            return "/student/applications"
        if r in ("RECRUITER", "EMPLOYER"):
            return "/jobs/employer/pipeline"
    if rt == "interview":
        if r == "STUDENT":
            return "/student/interviews"
        if r in ("RECRUITER", "EMPLOYER"):
            return "/jobs/employer/interviews"
    if rt == "offer":
        if r == "STUDENT":
            return "/student/offers"
        if r == "EMPLOYER":
            return "/employer/offers/new"
    if rt == "placement":
        if r == "STUDENT":
            return "/student/placement"
        if r == "INSTITUTION":
            return "/institution/placements"
    if rt == "job":
        if r == "EMPLOYER":
            return "/employer/jobs"
        if r == "PLATFORM_ADMINISTRATOR":
            return "/admin/job-moderation"
    if rt == "organization":
        if r == "EMPLOYER" or r == "INSTITUTION":
            return f"/{r.lower()}/profile"
        if r == "PLATFORM_ADMINISTRATOR":
            return "/admin/verification"
    _ = resource_id
    return None
