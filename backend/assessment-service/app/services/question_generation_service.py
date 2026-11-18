"""Asks the AI to write draft questions for one chapter. The drafts enter the normal question bank as version 1 in
``draft``; nothing reaches a student until an author submits and a reviewer approves them (the existing lifecycle)."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.question_mapper import map_questions
from app.clients.gateway import GatewayClient, GatewayUnavailable
from app.core.config import Settings
from app.core.exceptions import AppError, BadRequestError, PermissionDeniedError
from app.core.security import AccessTokenClaims
from app.models.question import Question
from app.permissions.policy import author_organization
from app.schemas.generation import QuestionGenerationIn
from app.services.question_service import QuestionService

_KIND_WORDS = {
    "mcq": "mcq (also code output and scenario questions)",
    "multi": "multi",
    "true_false": "true_false",
    "fill_blank": "fill_blank",
    "coding": "coding",
    "debugging": "debugging",
}


class AiUnavailableError(AppError):
    status_code = 503
    code = "AI_UNAVAILABLE"


class QuestionGenerationService:
    def __init__(self, db: AsyncSession, settings: Settings, gateway: GatewayClient | None = None) -> None:
        self.db = db
        self.settings = settings
        self.gateway = gateway or GatewayClient(settings)

    async def generate(self, data: QuestionGenerationIn, auth: AccessTokenClaims) -> tuple[list[Question], int]:
        if not author_organization(auth)[0]:
            raise PermissionDeniedError()
        organization_id = auth.organization_id or self.settings.AI_PLATFORM_ORGANIZATION_ID
        if not organization_id:
            raise BadRequestError("Choose an organization to use AI with.", code="AI_ORGANIZATION_REQUIRED")
        if not (data.chapter_description.strip() or data.material.strip() or data.objectives):
            raise BadRequestError("Add a chapter description, objectives or study material first.", code="NOTHING_TO_READ")

        variables = {
            "chapter_title": data.chapter_title,
            "chapter_description": data.chapter_description or "(none)",
            "objectives": "; ".join(data.objectives) or "(none)",
            "material": data.material[:1_800] or "(none)",  # the gateway caps one variable at 2,000 characters
            "count": str(data.count),
            "types": ", ".join(_KIND_WORDS[kind] for kind in data.kinds),
            "difficulty": data.difficulty,
        }
        try:
            completion = await self.gateway.complete(
                organization_id=int(organization_id),
                user_id=auth.user_id,
                prompt_key=self.settings.QUESTION_GENERATION_PROMPT_KEY,
                variables=variables,
                max_tokens=self.settings.QUESTION_GENERATION_MAX_TOKENS,
            )
        except GatewayUnavailable as exc:
            raise AiUnavailableError("AI is not available right now. Try again later or write the questions yourself.") from exc
        if completion.status != "ok":
            raise AiUnavailableError("The AI could not write questions from this content.")

        batch = map_questions(completion.content, data.topic_tag, data.count)
        if not batch.questions:
            raise AiUnavailableError("The AI did not return usable questions. Try again.")
        outcome = await QuestionService(self.db, self.settings).bulk_create(batch.questions, auth, None)
        created = [question for _, question, _ in outcome if question is not None]
        return created, batch.skipped + (len(outcome) - len(created))
