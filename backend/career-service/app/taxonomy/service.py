"""Reads and manages the role catalogue (industries, departments, roles, career levels, purposes).

What a resume should suggest for a role is worked out here, once, for the forms, the AI and the ATS score alike:
the role's own settings win, an empty one inherits the department's, and a role nobody has configured (a custom one the
person typed) gets its department's guidance or, failing that, a generic professional layout.
"""

import re
from typing import Any

from sqlalchemy import String, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.taxonomy import CareerLevel, Department, Industry, JobRole, ResumePurpose
from app.taxonomy.data import CAREER_LEVELS, INDUSTRIES, PURPOSES, _sec, soft_skills

GENERIC_TEMPLATES = ["professional", "modern"]


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80] or "role"


async def seed(db: AsyncSession) -> None:
    """Adds what is missing; never overwrites what a careers manager has changed."""
    if (await db.execute(select(func.count()).select_from(Industry))).scalar_one() == 0:
        for i_pos, industry in enumerate(INDUSTRIES):
            row = Industry(key=industry["key"], name=industry["name"], icon=industry["icon"], position=i_pos, active=True)
            db.add(row)
            await db.flush()
            for d_pos, dept in enumerate(industry["departments"]):
                department = Department(
                    industry_id=row.id, key=dept["key"], name=dept["name"], position=d_pos, active=True, skills=dept["skills"], keywords=dept["keywords"],
                    sections=dept["sections"], template_keys=dept["templates"], ai_hint=dept["hint"],
                )
                db.add(department)
                await db.flush()
                for entry in dept["roles"]:
                    spec = entry if isinstance(entry, dict) else {"name": entry}
                    db.add(JobRole(
                        department_id=department.id, key=slugify(spec["name"]), name=spec["name"], aliases=spec.get("aliases", []), specializations=spec.get("specializations", []),
                        skills=spec.get("skills", []), keywords=spec.get("keywords", []), sections=spec.get("sections", {}), template_keys=spec.get("templates", []), ai_hint=spec.get("hint"), active=True,
                    ))
    if (await db.execute(select(func.count()).select_from(CareerLevel))).scalar_one() == 0:
        db.add_all(CareerLevel(key=k, name=n, experience_level=e, note=note, position=i) for i, (k, n, e, note) in enumerate(CAREER_LEVELS))
    if (await db.execute(select(func.count()).select_from(ResumePurpose))).scalar_one() == 0:
        db.add_all(ResumePurpose(key=k, name=n, note=note, emphasis=emphasis, position=i) for i, (k, n, note, emphasis) in enumerate(PURPOSES))
    await db.commit()


class TaxonomyService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def industries(self) -> list[dict[str, Any]]:
        rows = (await self.db.execute(select(Industry).where(Industry.active.is_(True)).order_by(Industry.position, Industry.name))).scalars().all()
        counts = dict((await self.db.execute(select(Department.industry_id, func.count()).where(Department.active.is_(True)).group_by(Department.industry_id))).all())
        return [{"key": r.key, "name": r.name, "icon": r.icon, "departments": counts.get(r.id, 0)} for r in rows]

    async def departments(self, industry_key: str) -> list[dict[str, Any]]:
        industry = (await self.db.execute(select(Industry).where(Industry.key == industry_key))).scalar_one_or_none()
        if industry is None:
            return []
        rows = (await self.db.execute(select(Department).where(Department.industry_id == industry.id, Department.active.is_(True)).order_by(Department.position))).scalars().all()
        return [{"key": r.key, "name": r.name} for r in rows]

    async def roles(self, *, q: str | None, industry: str | None, department: str | None, limit: int = 30) -> list[dict[str, Any]]:
        stmt = select(JobRole, Department, Industry).join(Department, JobRole.department_id == Department.id).join(Industry, Department.industry_id == Industry.id).where(JobRole.active.is_(True))
        if industry:
            stmt = stmt.where(Industry.key == industry)
        if department:
            stmt = stmt.where(Department.key == department)
        if q:
            like = f"%{q.strip().lower()}%"
            stmt = stmt.where(or_(func.lower(JobRole.name).like(like), func.lower(func.cast(JobRole.aliases, String)).like(like)))
        rows = (await self.db.execute(stmt.order_by(JobRole.name).limit(limit))).all()
        return [{"key": r.key, "name": r.name, "department": d.name, "department_key": d.key, "industry": i.name, "industry_key": i.key, "specializations": r.specializations or []} for r, d, i in rows]

    async def career_levels(self) -> list[dict[str, Any]]:
        rows = (await self.db.execute(select(CareerLevel).order_by(CareerLevel.position))).scalars().all()
        return [{"key": r.key, "name": r.name, "experience_level": r.experience_level, "note": r.note} for r in rows]

    async def purposes(self) -> list[dict[str, Any]]:
        rows = (await self.db.execute(select(ResumePurpose).order_by(ResumePurpose.position))).scalars().all()
        return [{"key": r.key, "name": r.name, "note": r.note, "emphasis": r.emphasis or []} for r in rows]

    async def level_to_experience(self, career_level: str | None) -> str | None:
        if not career_level:
            return None
        return (await self.db.execute(select(CareerLevel.experience_level).where(CareerLevel.key == career_level))).scalar_one_or_none()

    async def profile(self, *, role_key: str | None = None, department_key: str | None = None, custom_role: str | None = None) -> dict[str, Any]:
        """Everything a form, the AI and the ATS score need to know about one role. Works for a role that is not in the catalogue."""
        role: JobRole | None = None
        department: Department | None = None
        if role_key:
            role = (await self.db.execute(select(JobRole).where(JobRole.key == role_key))).scalar_one_or_none()
        if role is not None:
            department = await self.db.get(Department, role.department_id)
        elif department_key:
            department = (await self.db.execute(select(Department).where(Department.key == department_key))).scalar_one_or_none()
        industry = await self.db.get(Industry, department.industry_id) if department else None
        name = role.name if role else (custom_role or "").strip() or None

        own_skills = list(role.skills or []) if role else []
        dept_skills = list(department.skills or []) if department else []
        skills = [{"name": s, "why": f"Listed for {name}" if s in own_skills else f"Commonly asked for in {department.name if department else 'this field'}"} for s in (own_skills or dept_skills)]
        if not skills:
            skills = [{"name": s, "why": "A useful skill in almost any role"} for s in soft_skills()]
        sections = (role.sections if role and role.sections else None) or (department.sections if department else None) or _sec()
        return {
            "role_key": role.key if role else None,
            "role_name": name,
            "department": department.name if department else None,
            "department_key": department.key if department else None,
            "industry": industry.name if industry else None,
            "industry_key": industry.key if industry else None,
            "custom": role is None,
            "skills": skills,
            "keywords": (role.keywords if role and role.keywords else None) or (department.keywords if department else None) or [],
            "sections": sections,
            "template_keys": (role.template_keys if role and role.template_keys else None) or (department.template_keys if department else None) or GENERIC_TEMPLATES,
            "ai_hint": (role.ai_hint if role and role.ai_hint else None) or (department.ai_hint if department else None),
            "why": (
                f"These suggestions are for {name} in {department.name}." if department and name
                else "This is a custom role, so we are using a general professional layout. Add your own skills and sections."
            ),
        }

    async def ai_context(self, role_key: str | None, role_name: str | None) -> str | None:
        """One line for the AI: the role, the field it is in, and which words belong there (and which do not)."""
        if not role_key and not role_name:
            return None
        profile = await self.profile(role_key=role_key, custom_role=role_name)
        bits = [profile["role_name"] or role_name or ""]
        if profile["department"]:
            bits.append(f"{profile['department']}, {profile['industry']}")
        hint = profile["ai_hint"]
        return f"{' · '.join(b for b in bits if b)}. {hint}" if hint else (" · ".join(b for b in bits if b) or None)
