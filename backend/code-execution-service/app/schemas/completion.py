from lms_common.envelopes import RequestSchema, SuccessResponse
from pydantic import Field


class CodeCompletionRequest(RequestSchema):
    language: str = Field(description="Language code e.g. python3, javascript, java, c, cpp17, sqlite")
    prefix: str = Field(default="", max_length=100_000, description="Code before cursor")
    suffix: str = Field(default="", max_length=100_000, description="Code after cursor")
    cursor_line: int | None = Field(default=None, description="Current line number (1-indexed)")
    cursor_column: int | None = Field(default=None, description="Current column number (1-indexed)")

class CodeCompletionResponse(SuccessResponse):
    completion: str = Field(description="Generated code completion to insert at cursor")
    source: str = Field(description="'gemini', 'openai', 'anthropic', or 'fallback'")
