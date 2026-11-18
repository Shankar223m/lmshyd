import pytest
from app.db.types import uuid7
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.permission_service import PermissionService
from app.models.user import User
from app.models.institution import Institution
from app.models.permission import UserPermission
from app.core.exceptions import ValidationFailedError
from app.permissions.roles import Role
from app.core.security import hash_password

# Strength for test password hashing
STRONG_PASSWORD = "Str0ng!Passphrase#1"

@pytest.fixture
async def student_user(db: AsyncSession):
    admin = User(
        email="admin_inst@example.com",
        username="admin_inst",
        password_hash=await hash_password(STRONG_PASSWORD),
        first_name="Admin",
        last_name="Inst",
        role=Role.ADMIN.value,
    )
    db.add(admin)
    await db.flush()
    # Create an institution of type INDIVIDUAL for student logic
    institution = Institution(
        name="TestInst",
        code="TST",
        org_type="institution",
        institution_type="individual",
        admin_id=admin.id,
        email="test@example.com",
        phone="+1234567890",
        address_line1="123 Main St",
        city="Metropolis",
        state="State",
        postal_code="12345",
        country="US",
        timezone="UTC",
    )
    db.add(institution)
    await db.flush()
    user = User(
        email="student@example.com",
        username="student_user",
        password_hash=await hash_password(STRONG_PASSWORD),
        first_name="Student",
        last_name="User",
        role=Role.STUDENT.value,
        institution_id=institution.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@pytest.fixture
async def admin_user(db: AsyncSession):
    user = User(
        email="admin@example.com",
        username="admin_user",
        password_hash=await hash_password(STRONG_PASSWORD),
        first_name="Admin",
        last_name="User",
        role=Role.ADMIN.value,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@pytest.mark.asyncio
async def test_student_allow_override_rejected(db: AsyncSession, student_user: User, admin_user: User):
    svc = PermissionService(db)
    with pytest.raises(ValidationFailedError):
        await svc.set_user(actor=admin_user, target=student_user, changes={"some.permission": True}, reason="test")

@pytest.mark.asyncio
async def test_student_deny_override_rejected(db: AsyncSession, student_user: User, admin_user: User):
    svc = PermissionService(db)
    with pytest.raises(ValidationFailedError):
        await svc.set_user(actor=admin_user, target=student_user, changes={"some.permission": False}, reason="test")

@pytest.mark.asyncio
async def test_existing_student_overrides_ignored(db: AsyncSession, student_user: User):
    # Insert legacy rows directly
    db.add(UserPermission(user_id=student_user.id, permission="legacy.allow", allowed=True))
    db.add(UserPermission(user_id=student_user.id, permission="legacy.deny", allowed=False))
    await db.commit()
    svc = PermissionService(db)
    perms = await svc.effective_for(student_user)
    assert "legacy.allow" not in perms
    assert "legacy.deny" not in perms

@pytest.mark.asyncio
async def test_no_row_created_on_rejected_override(db: AsyncSession, student_user: User, admin_user: User):
    svc = PermissionService(db)
    pre = (await db.execute(select(UserPermission).where(UserPermission.user_id == student_user.id))).scalars().all()
    with pytest.raises(ValidationFailedError):
        await svc.set_user(actor=admin_user, target=student_user, changes={"test.permission": True}, reason="reject")
    post = (await db.execute(select(UserPermission).where(UserPermission.user_id == student_user.id))).scalars().all()
    assert len(pre) == len(post)

@pytest.mark.asyncio
async def test_student_role_defaults_preserved(db: AsyncSession, student_user: User):
    svc = PermissionService(db)
    perms = await svc.effective_for(student_user)
    from app.permissions.effective import role_defaults
    defaults = role_defaults(Role.STUDENT, {})
    # Permissions should be at least the defaults (STORE_BUY may be added for individual)
    assert set(defaults).issubset(set(perms))

@pytest.mark.asyncio
async def test_admin_override_allowed(db: AsyncSession, admin_user: User):
    svc = PermissionService(db)
    await svc.set_user(actor=admin_user, target=admin_user, changes={"support.manage": True}, reason="grant")
    # An admin's platform permissions are their scopes, not matrix rows.
    assert "support.manage" in admin_user.scope_list

@pytest.mark.asyncio
async def test_institution_head_override_allowed(db: AsyncSession, admin_user: User):
    # Change role to INSTITUTION_HEAD for test
    admin_user.role = Role.INSTITUTION_HEAD.value
    await db.commit()
    svc = PermissionService(db)
    await svc.set_user(actor=admin_user, target=admin_user, changes={"staff.view": False}, reason="grant")
    row = await db.scalar(select(UserPermission).where(UserPermission.user_id == admin_user.id, UserPermission.permission == "staff.view"))
    assert row is not None and row.allowed is False

@pytest.mark.asyncio
async def test_staff_override_allowed(db: AsyncSession, admin_user: User):
    admin_user.role = Role.STAFF.value
    await db.commit()
    svc = PermissionService(db)
    await svc.set_user(actor=admin_user, target=admin_user, changes={"students.delete": True}, reason="grant")
    row = await db.scalar(select(UserPermission).where(UserPermission.user_id == admin_user.id, UserPermission.permission == "students.delete"))
    assert row is not None and row.allowed is True
