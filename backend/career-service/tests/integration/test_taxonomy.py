import pytest

from app.taxonomy.service import seed

API = "/api/v1"


@pytest.fixture(autouse=True)
async def catalogue(sessionmaker):
    async with sessionmaker() as db:
        await seed(db)


async def test_the_catalogue_covers_many_fields_not_only_it(client, who):
    who.student()
    industries = (await client.get(f"{API}/taxonomy/industries")).json()["items"]
    names = {i["key"] for i in industries}
    assert {"it", "hr", "finance", "healthcare", "education", "legal", "creative", "government", "construction", "other"} <= names
    departments = (await client.get(f"{API}/taxonomy/industries/healthcare/departments")).json()["items"]
    assert departments and all("key" in d for d in departments)


async def test_role_search_finds_by_name_and_alias_in_any_field(client, who):
    who.student()
    for query, expected in [("accountant", "Accountant"), ("registered nurse", "Registered Nurse"), ("front-end", "Frontend Developer"), ("teacher", "Primary School Teacher"), ("hr manager", "HR Manager")]:
        found = (await client.get(f"{API}/taxonomy/roles", params={"q": query})).json()["items"]
        assert expected in {r["name"] for r in found}, query


@pytest.mark.parametrize(
    ("role", "must_have_skill", "must_not_have"),
    [
        ("accountant", "GST", "React"),
        ("registered-nurse", "Patient Assessment", "Docker"),
        ("hr-manager", "Recruitment", "AutoCAD"),
        ("mechanical-engineer", "SolidWorks", "Payroll"),
        ("primary-school-teacher", "Lesson Planning", "Kubernetes"),
        ("frontend-developer", "TypeScript", "Taxation"),
    ],
)
async def test_each_role_gets_its_own_skills_and_terminology(client, who, role, must_have_skill, must_not_have):
    who.student()
    profile = (await client.get(f"{API}/taxonomy/role-profile", params={"role": role})).json()["profile"]
    skills = {s["name"] for s in profile["skills"]}
    assert must_have_skill in skills and must_not_have not in skills
    assert profile["keywords"] and profile["template_keys"] and profile["sections"]["labels"]["experience"]
    assert all(s["why"] for s in profile["skills"])  # every suggestion says why it is suggested


async def test_a_role_without_its_own_settings_inherits_its_departments(client, who):
    who.student()
    profile = (await client.get(f"{API}/taxonomy/role-profile", params={"role": "paralegal"})).json()["profile"]
    assert "Legal research" in {s["name"] for s in profile["skills"]}
    assert profile["sections"]["labels"]["experience"] == "Legal Experience"


async def test_a_custom_role_still_gets_a_sensible_workflow(client, who):
    who.student()
    profile = (await client.get(f"{API}/taxonomy/role-profile", params={"custom_role": "Beekeeper", "department": "other-self"})).json()["profile"]
    assert profile["custom"] is True and profile["role_name"] == "Beekeeper"
    nothing = (await client.get(f"{API}/taxonomy/role-profile", params={"custom_role": "Underwater Basket Weaver"})).json()["profile"]
    assert nothing["skills"] and nothing["template_keys"] and "custom role" in nothing["why"]


async def test_career_level_sets_the_experience_level_and_role_picks_a_template(client, who):
    who.student()
    created = await client.post(f"{API}/resumes", json={"title": "Finance resume", "target_role": "Finance Manager", "role_key": "finance-manager", "career_level": "director", "purpose": "promotion", "locale": {"country": "IN", "date_format": "DD/MM/YYYY"}})
    assert created.status_code == 201, created.text
    resume = created.json()["resume"]
    assert resume["experience_level"] == "senior" and resume["career_level"] == "director" and resume["purpose"] == "promotion"
    assert resume["template_key"] in {"professional", "modern"} and resume["locale"]["country"] == "IN"


async def test_the_ats_score_uses_the_roles_own_keywords_without_a_job_description(client, who):
    who.student()
    nurse = (await client.post(f"{API}/resumes", json={"title": "Nurse", "target_role": "Registered Nurse", "role_key": "registered-nurse"})).json()["resume"]["resume_id"]
    detail = (await client.get(f"{API}/resumes/{nurse}")).json()
    keyword = next(c for c in detail["ats"]["components"] if c["key"] == "keywords")
    assert "Registered Nurse" in keyword["label"]
    assert any(k["term"] == "patient care" for k in detail["ats"]["keywords"])


async def test_only_careers_managers_can_change_the_catalogue(client, who):
    who.student()
    denied = await client.post(f"{API}/admin/taxonomy/roles", json={"department_key": "other-self", "name": "Drone Pilot"})
    assert denied.status_code in (401, 403)
    who.manager()
    added = await client.post(f"{API}/admin/taxonomy/roles", json={"department_key": "other-self", "name": "Drone Pilot", "skills": ["Aerial photography", "Flight planning"], "keywords": ["drone", "aerial"]})
    assert added.status_code == 201, added.text
    who.student()
    profile = (await client.get(f"{API}/taxonomy/role-profile", params={"role": "drone-pilot"})).json()["profile"]
    assert {s["name"] for s in profile["skills"]} == {"Aerial photography", "Flight planning"} and profile["custom"] is False


PROFILES = [
    ("Frontend Developer", "frontend-developer", "fresher"),
    ("Backend Developer", "backend-developer", "mid"),
    ("Project Manager", "project-manager", "senior"),
    ("Accountant", "accountant", "fresher"),
    ("HR Manager", "hr-manager", "mid"),
    ("Mechanical Engineer", "mechanical-engineer", "senior"),
    ("Primary School Teacher", "primary-school-teacher", "fresher"),
    ("Registered Nurse", "registered-nurse", "mid"),
    ("Digital Marketing Manager", "digital-marketing-manager", "manager"),
    ("Finance Manager", "finance-manager", "director"),
    ("Graphic Designer", "graphic-designer", "freelancer"),
    ("Business Analyst", "business-analyst", "switcher"),
    ("Research Scientist", "research-scientist", "senior"),
    ("Sales Executive", "sales-executive", "entry"),
    ("Government Administrative Officer", "government-administrative-officer", "mid"),
    ("Beekeeper", "", "mid"),  # a role that is in no catalogue
]


@pytest.mark.parametrize(("name", "role_key", "level"), PROFILES)
async def test_every_profession_gets_a_working_resume_end_to_end(client, who, name, role_key, level):
    who.student()
    created = await client.post(f"{API}/resumes", json={"title": name, "target_role": name, "role_key": role_key or None, "career_level": level, "purpose": "job"})
    assert created.status_code == 201, created.text
    resume_id = created.json()["resume"]["resume_id"]
    detail = (await client.get(f"{API}/resumes/{resume_id}")).json()
    assert 0 <= detail["ats"]["score"] <= 100 and detail["resume"]["career_level"] == level
    for fmt in ("pdf", "docx"):
        exported = await client.get(f"{API}/resumes/{resume_id}/export/{fmt}")
        assert exported.status_code == 200 and len(exported.content) > 500, (name, fmt)


async def test_changing_the_role_later_keeps_the_content_and_other_resumes(client, who):
    who.student()
    first = (await client.post(f"{API}/resumes", json={"title": "Dev", "target_role": "Backend Developer", "role_key": "backend-developer"})).json()["resume"]
    second = (await client.post(f"{API}/resumes", json={"title": "Other", "target_role": "Accountant", "role_key": "accountant"})).json()["resume"]
    before = (await client.get(f"{API}/resumes/{first['resume_id']}")).json()
    changed = await client.patch(f"{API}/resumes/{first['resume_id']}", json={"expected_revision": before["resume"]["draft_revision"], "target_role": "Python Developer", "role_key": "python-developer", "career_level": "senior"})
    assert changed.status_code == 200, changed.text
    after = (await client.get(f"{API}/resumes/{first['resume_id']}")).json()
    assert after["resume"]["role_key"] == "python-developer" and after["resume"]["experience_level"] == "senior"
    assert after["draft"]["summary"] == before["draft"]["summary"]
    untouched = (await client.get(f"{API}/resumes/{second['resume_id']}")).json()
    assert untouched["resume"]["role_key"] == "accountant"
