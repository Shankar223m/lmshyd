"""The prompt this service registers in ai-gateway (``python -m app.cli register-prompts``)."""

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class PromptDefinition:
    key: str
    description: str
    template: str
    variables: tuple[str, ...]
    model_params: dict[str, object] = field(default_factory=dict)


QUESTION_GENERATION = PromptDefinition(
    key="assessment.question_generation",
    description="Writes a set of exam questions from one chapter's description, objectives and study material.",
    variables=("chapter_title", "chapter_description", "objectives", "material", "count", "types", "difficulty"),
    model_params={"temperature": 0.4},
    template="""You write exam questions for a learning platform. Use ONLY the chapter content below; never invent facts that it does not support.

Chapter: {{chapter_title}}
Description: {{chapter_description}}
Learning objectives: {{objectives}}
Study material (may be partly cut off):
{{material}}

Write exactly {{count}} questions. Use these question kinds, spread across them: {{types}}.
Difficulty: {{difficulty}}.

Kinds and the shape of each question:
- "mcq": one correct option. Also used for "code output" and "scenario" questions (put the code or the scenario in "text").
- "multi": several correct options (at least one option must be wrong).
- "true_false": a statement that is either true or false.
- "fill_blank": ONE blank written as ____ in "text", with the accepted answers.
- "coding": a programming task. Give "test_cases" (input and expected output) and a "model_answer".
- "debugging": broken code in "text" that the student must fix. Give "test_cases" and a "model_answer".

Return ONLY a JSON array, no prose and no code fences. Each element:
{
  "kind": "mcq" | "multi" | "true_false" | "fill_blank" | "coding" | "debugging",
  "text": "the question",
  "options": ["..."],
  "correct": 0,
  "test_cases": [{"input": "...", "expected": "..."}],
  "model_answer": "...",
  "explanation": "why the answer is right",
  "marks": 1,
  "difficulty": 3
}
Field rules: "options" only for mcq and multi (3 to 5 options). "correct": for mcq the 0-based index of the right option; for multi a list of indexes; for true_false true or false; for fill_blank a list of accepted answers. "test_cases" (2 to 4) and "model_answer" only for coding and debugging. "marks" is 1 to 10 and "difficulty" is 1 to 5.
""",
)

ALL = (QUESTION_GENERATION,)
