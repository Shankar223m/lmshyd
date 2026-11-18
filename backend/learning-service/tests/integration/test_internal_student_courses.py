"""catalog-service asks which courses a student may open: exactly those they are actively enrolled in.

An institution student is enrolled by their institution; a self-registered learner when they pay (and withdrawn when
the access expires). Anything else, or a missing/wrong service token, gets nothing.
"""

from tests.conftest import TEST_COURSE_ID, TEST_INTERNAL_TOKEN
from tests.integration.test_enrollment_and_progress import BATCH_PAYLOAD
from tests.integration.test_learner_access import LEARNER, OTHER, _access, _apply

INSTITUTION_STUDENT = 1755000000005999
TOKEN = {"X-Internal-Service-Token": TEST_INTERNAL_TOKEN}


async def _courses(client, user_id: int, headers=TOKEN):
    return await client.get(f"/api/v1/internal/students/{user_id}/courses", headers=headers)


async def test_an_institution_student_may_open_the_courses_their_institution_enrolled_them_in(
    client, as_institution_head, seed_institution, seed_course, seed_entitlement, mock_seats
) -> None:
    await seed_institution()
    await seed_course()
    await seed_entitlement()
    as_institution_head()
    batch = (await client.post("/api/v1/batches", json=BATCH_PAYLOAD)).json()["batch"]
    assert (await _courses(client, INSTITUTION_STUDENT)).json()["course_ids"] == []  # not enrolled yet: nothing

    as_institution_head()
    await client.post(f"/api/v1/batches/{batch['batch_id']}/enrollments", json={"student_user_id": str(INSTITUTION_STUDENT)})
    assert (await _courses(client, INSTITUTION_STUDENT)).json()["course_ids"] == [TEST_COURSE_ID]
    assert (await _courses(client, INSTITUTION_STUDENT + 1)).json()["course_ids"] == []  # another student: nothing


async def test_a_learner_may_open_only_what_they_paid_for_and_only_while_it_lasts(
    app, client, seed_institution, seed_course
) -> None:
    await seed_institution()
    await seed_course()
    await _apply(app, _access("granted"))  # LEARNER pays
    assert (await _courses(client, LEARNER)).json()["course_ids"] == [TEST_COURSE_ID]
    assert (await _courses(client, OTHER)).json()["course_ids"] == []  # did not pay

    await _apply(app, _access("expired"))
    assert (await _courses(client, LEARNER)).json()["course_ids"] == []  # access ended: closed again


async def test_only_other_services_may_ask(client) -> None:
    assert (await _courses(client, LEARNER, headers={})).status_code == 403
    assert (await _courses(client, LEARNER, headers={"X-Internal-Service-Token": "wrong"})).status_code == 403
