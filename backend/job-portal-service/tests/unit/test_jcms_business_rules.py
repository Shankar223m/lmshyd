"""JCMS business-rule unit coverage ported into LMS job-portal."""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.domain.enums import OFFER_BLOCKS_WITHDRAW, OfferStatus
from app.domain.enums import ApplicationStatus as S
from app.pipeline.progress import next_action
from app.schemas.job import EligibilityIn, GraduationYears, JobFields


def test_cgpa_above_10_is_rejected():
    with pytest.raises(ValidationError):
        EligibilityIn(min_cgpa=10.01)


def test_invalid_graduation_year_is_rejected():
    with pytest.raises(ValidationError):
        GraduationYears(min=1800, max=2026)


def test_required_skills_round_trip_on_job_fields():
    job = JobFields(
        title="Backend Engineer",
        description="Build APIs for campus hiring workflows with durable storage.",
        location_type="remote",
        required_skills=["Python", "SQL", "FastAPI"],
        eligibility=EligibilityIn(min_cgpa=7.5, degrees=["B.Tech"], graduation_years=GraduationYears(min=2025, max=2026)),
    )
    assert job.required_skills == ["Python", "SQL", "FastAPI"]
    assert job.eligibility.min_cgpa == 7.5
    assert job.eligibility.degrees == ["B.Tech"]


def test_offer_statuses_that_block_withdraw():
    assert OfferStatus.PENDING_APPROVAL in OFFER_BLOCKS_WITHDRAW
    assert OfferStatus.ISSUED in OFFER_BLOCKS_WITHDRAW
    assert OfferStatus.EXTENDED in OFFER_BLOCKS_WITHDRAW
    assert OfferStatus.ACCEPTED in OFFER_BLOCKS_WITHDRAW
    assert OfferStatus.DECLINED not in OFFER_BLOCKS_WITHDRAW
    assert OfferStatus.DRAFT not in OFFER_BLOCKS_WITHDRAW


def test_next_action_for_issued_and_extended_offers():
    due = datetime(2026, 12, 1, tzinfo=timezone.utc)
    assert next_action(S.OFFERED, assessment_invite_state=None, offer_status="extended", offer_expires_at=due).kind == "offer"
    assert next_action(S.OFFERED, assessment_invite_state=None, offer_status="issued", offer_expires_at=due).kind == "offer"
    assert next_action(S.OFFERED, assessment_invite_state=None, offer_status="pending_approval", offer_expires_at=due) is None
