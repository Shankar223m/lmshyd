from typing import Literal

from lms_common.envelopes import RequestSchema, ResponseSchema, SuccessResponse
from pydantic import Field

from app.schemas.question import QuestionOut
from app.schemas.types import PublicIdOut, id_field, multiline_text, text

GenerationKind = Literal["mcq", "multi", "true_false", "fill_blank", "coding", "debugging"]
Mix = Literal["easy", "mixed", "hard"]


class QuestionGenerationIn(RequestSchema):
    """What the AI reads: one chapter's own content. ``topic_tag`` ties the drafts to the chapter so the review screen
    can list them again later."""

    topic_tag: text(60) = Field(description="Identifies the chapter, e.g. `chapter-1755000000001234`")  # type: ignore[valid-type]
    chapter_title: text(200)  # type: ignore[valid-type]
    chapter_description: multiline_text(5_000) = ""  # type: ignore[valid-type]
    objectives: list[text(300)] = Field(default_factory=list, max_length=20)  # type: ignore[valid-type]
    material: multiline_text(60_000) = Field(default="", description="Text taken from the chapter's PDF and notes")  # type: ignore[valid-type]
    count: int = Field(default=8, ge=1, le=10)
    kinds: list[GenerationKind] = Field(default_factory=lambda: ["mcq", "multi", "true_false", "fill_blank"], min_length=1)
    difficulty: Mix = "mixed"


class QuestionGenerationResponse(SuccessResponse):
    created: list[QuestionOut]
    skipped: int = Field(description="Questions the AI wrote that were malformed and were left out")


class BatchApproveIn(RequestSchema):
    question_ids: list[id_field("Question", "1755000000004001")] = Field(min_length=1, max_length=50)  # type: ignore[valid-type]
    note: text(500) | None = None  # type: ignore[valid-type]


class BatchOutcomeOut(ResponseSchema):
    question_id: PublicIdOut
    ok: bool
    error: str | None = None


class BatchApproveResponse(SuccessResponse):
    approved: int
    failed: int
    results: list[BatchOutcomeOut]
