"""Reviews many questions in one request (the "Approve all" button on a freshly generated set).

Each question goes through the ordinary lifecycle, so every rule still applies per question: a draft is submitted by
its author first, and approval still needs a reviewer (or a super admin) who is not the author. One question failing
(already approved, not allowed, malformed) never blocks the rest; the response reports each outcome.
"""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import AppError
from app.core.security import AccessTokenClaims
from app.domain.enums import VersionStatus
from app.services.question_service import QuestionService


@dataclass(frozen=True, slots=True)
class BatchOutcome:
    question_id: int
    ok: bool
    error: str | None = None


class QuestionBatchService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.questions = QuestionService(db, settings)

    async def approve(self, question_ids: list[int], auth: AccessTokenClaims, note: str | None) -> list[BatchOutcome]:
        outcomes: list[BatchOutcome] = []
        for question_id in dict.fromkeys(question_ids):  # a repeated id is handled once
            try:
                question = await self.questions.get(question_id, auth)
                working = self.questions.working(question)
                if working is not None and working.status == VersionStatus.DRAFT:
                    question = await self.questions.submit(question, auth)
                await self.questions.approve(question, auth, note)
                outcomes.append(BatchOutcome(question_id, True))
            except AppError as exc:
                outcomes.append(BatchOutcome(question_id, False, exc.code))
        return outcomes
