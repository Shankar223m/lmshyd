from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Organization, User
from app.modules.audit.service import record_audit
from app.modules.notifications.service import notify_user
from app.shared.enums import UserRole, VerificationStatus


def verify_organization(
    db: Session, org: Organization, admin: User, action: str, comment: str | None
) -> Organization:
    if admin.role != UserRole.PLATFORM_ADMINISTRATOR.value:
        raise ValueError("FORBIDDEN")
    if action == "verify":
        org.verification_status = VerificationStatus.VERIFIED.value
    elif action == "reject":
        org.verification_status = VerificationStatus.REJECTED.value
    elif action == "request_changes":
        org.verification_status = VerificationStatus.CHANGES_REQUIRED.value
    else:
        raise ValueError("INVALID_ACTION")
    org.verification_comment = comment
    admin_user = db.scalar(
        select(User).where(
            User.organization_id == org.id,
            User.role.in_([UserRole.EMPLOYER.value, UserRole.INSTITUTION.value]),
        )
    )
    if admin_user:
        notify_user(
            db,
            user_id=admin_user.id,
            title="Verification update",
            body=f"Organization status: {org.verification_status}",
            resource_type="organization",
            resource_id=org.id,
        )
    record_audit(
        db,
        actor_id=admin.id,
        action=f"organization.verify.{action}",
        resource_type="organization",
        resource_id=org.id,
        metadata={"comment": comment},
    )
    return org
