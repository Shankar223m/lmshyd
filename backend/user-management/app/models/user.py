
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, ForeignKey, Index, String, false, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.ids import new_public_id
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.permissions.roles import UserStatus

if TYPE_CHECKING:
    from app.models.institution import Institution
    from app.models.profiles import EmploymentProfile, StudentCertification, StudentGuardian, StudentProfile, UserProfile
    from app.models.user_permission_override import UserPermissionOverride
    from app.models.admin_delegation import AdminDelegation


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Account and identity. Personal, employment and student details live in 1:1 tables.

    ``id`` is the internal key used only for joins; ``public_id`` is the ``user_id`` the API exposes.
    Relationships use ``lazy="raise"``: every query must say what it loads (no hidden N+1 queries).
    """

    __tablename__ = "users"

    public_id: Mapped[int] = mapped_column(
        BigInteger,
        unique=True,
        default=new_public_id,
    )
    email: Mapped[str | None] = mapped_column(String(254))
    username: Mapped[str] = mapped_column(String(50))
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(50))
    middle_name: Mapped[str | None] = mapped_column(String(50))
    last_name: Mapped[str] = mapped_column(String(50))
    phone: Mapped[str | None] = mapped_column(String(20))  # E.164
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    role: Mapped[str] = mapped_column(String(32))
    scopes: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(
        String(32),
        default=UserStatus.ACTIVE,
        server_default=UserStatus.ACTIVE.value,
    )
    status_reason: Mapped[str | None] = mapped_column(String(500))

    institution_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("institutions.id", ondelete="RESTRICT", use_alter=True)
    )
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    token_version: Mapped[int] = mapped_column(default=0, server_default="0")
    # Bumped whenever the profile photo changes (0 = none): the browser uses it to refresh its cached copy.
    image_version: Mapped[int] = mapped_column(default=0, server_default="0")
    must_change_password: Mapped[bool] = mapped_column(default=False, server_default=false())
    failed_login_attempts: Mapped[int] = mapped_column(default=0, server_default="0")
    locked_until: Mapped[datetime | None]
    last_login_at: Mapped[datetime | None]
    password_changed_at: Mapped[datetime | None]
    email_verified_at: Mapped[datetime | None]
    deleted_at: Mapped[datetime | None]

    # Core relationships
    institution: Mapped["Institution | None"] = relationship(
        foreign_keys=[institution_id],
        lazy="raise",
    )

    manager: Mapped["User | None"] = relationship(
        foreign_keys=[manager_id],
        remote_side="User.id",
        lazy="raise",
    )

    created_by: Mapped["User | None"] = relationship(
        foreign_keys=[created_by_id],
        remote_side="User.id",
        lazy="raise",
    )

    # Profile relationships
    profile: Mapped["UserProfile | None"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="raise",
        uselist=False,
    )

    employment: Mapped["EmploymentProfile | None"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="raise",
        uselist=False,
    )

    student: Mapped["StudentProfile | None"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="raise",
        uselist=False,
    )

    guardians: Mapped[list["StudentGuardian"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
        lazy="raise",
        order_by="StudentGuardian.position",
    )

    # User permission override relationships
    permission_overrides: Mapped[list["UserPermissionOverride"]] = relationship(
        "UserPermissionOverride",
        back_populates="user",
        foreign_keys="UserPermissionOverride.user_id",
        lazy="raise",
    )

    created_overrides: Mapped[list["UserPermissionOverride"]] = relationship(
        "UserPermissionOverride",
        back_populates="created_by",
        foreign_keys="UserPermissionOverride.created_by_id",
        lazy="raise",
    )

    updated_overrides: Mapped[list["UserPermissionOverride"]] = relationship(
        "UserPermissionOverride",
        back_populates="updated_by",
        foreign_keys="UserPermissionOverride.updated_by_id",
        lazy="raise",
    )

    # Admin delegation relationships
    delegations: Mapped[list["AdminDelegation"]] = relationship(
        "AdminDelegation",
        foreign_keys="AdminDelegation.admin_user_id",
        back_populates="admin_user",
        lazy="raise",
    )

    created_delegations: Mapped[list["AdminDelegation"]] = relationship(
        "AdminDelegation",
        foreign_keys="AdminDelegation.created_by_id",
        back_populates="created_by",
        lazy="raise",
    )

    updated_delegations: Mapped[list["AdminDelegation"]] = relationship(
        "AdminDelegation",
        foreign_keys="AdminDelegation.updated_by_id",
        back_populates="updated_by",
        lazy="raise",
    )
    certifications: Mapped[list["StudentCertification"]] = relationship(
        back_populates="student", cascade="all, delete-orphan", lazy="raise", order_by="StudentCertification.position"
    )

    __table_args__ = (
        Index(
            "uq_users_email_active",
            "email",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index(
            "uq_users_username_active",
            "username",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_users_institution_role_created",
            "institution_id",
            "role",
            "created_at",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_users_created_active",
            "created_at",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_users_role_created",
            "role",
            "created_at",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_users_manager_id",
            "manager_id",
            postgresql_where=text("manager_id IS NOT NULL"),
        ),
        Index(
            "ix_users_created_by_id",
            "created_by_id",
            postgresql_where=text("created_by_id IS NOT NULL"),
        ),
        *(
            Index(
                f"ix_users_{column}_trgm",
                column,
                postgresql_using="gin",
                postgresql_ops={column: "gin_trgm_ops"},
            )
            for column in ("email", "username", "first_name", "last_name", "phone")
        ),
    )

    @property
    def scope_list(self) -> tuple[str, ...]:
        return tuple(scope for scope in (self.scopes or "").split(",") if scope)

    def set_scopes(self, scopes: list[str] | tuple[str, ...] | None) -> None:
        unique = sorted(set(scopes or ()))
        self.scopes = f",{','.join(unique)}," if unique else None

    @property
    def granted(self) -> frozenset[str]:
        """Return effective permissions.

        Until explicitly loaded, the user's role catalog defaults are used.
        """
        loaded = self.__dict__.get("_granted")

        if loaded is None:
            from app.permissions.effective import effective
            from app.permissions.roles import Role, organization_type_for

            kind = organization_type_for(self.role)

            loaded = frozenset(
                effective(
                    Role(self.role),
                    kind.value if kind else None,
                    admin_scopes=self.scope_list,
                    role_overrides={},
                    user_overrides={},
                )
            )

        return loaded

    def grant(self, permissions: list[str] | frozenset[str]) -> None:
        self.__dict__["_granted"] = frozenset(permissions)

    @property
    def full_name(self) -> str:
        return " ".join(
            part
            for part in (self.first_name, self.middle_name, self.last_name)
            if part
        )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None
