"""Turns the model's JSON answer into ordinary ``QuestionCreate`` drafts. Pure: no network, no database.

The model is never trusted: anything malformed is skipped (and counted), and every question that survives still goes
through the normal authoring validators when it is created. Coding and debugging questions are stored as
``subjective`` questions that carry their test cases in the rubric and a model answer: they are marked by a person
(or the AI grader) against those cases. Linking one to a code-execution problem for automatic judging is a separate,
deliberate step an author does in the question bank.
"""

import json
import re
from dataclasses import dataclass, field
from typing import Any

from app.domain.enums import QuestionType
from app.schemas.question import QuestionCreate

KINDS = ("mcq", "multi", "true_false", "fill_blank", "coding", "debugging")
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)
_LETTERS = "abcdefgh"


@dataclass(slots=True)
class MappedBatch:
    questions: list[QuestionCreate] = field(default_factory=list)
    skipped: int = 0


def parse_json(content: str) -> list[Any]:
    """The array of questions, from a reply that may be wrapped in a code fence or an object."""
    text = _FENCE.sub("", content.strip())
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("["), text.rfind("]")
        if start == -1 or end <= start:
            return []
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return []
    if isinstance(data, dict):
        data = data.get("questions", [])
    return data if isinstance(data, list) else []


def _clamp(value: Any, low: float, high: float, default: float) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return default
    return min(high, max(low, float(value)))


def _options(raw: Any) -> list[dict[str, str]] | None:
    if not isinstance(raw, list) or not 2 <= len(raw) <= len(_LETTERS):
        return None
    texts = [str(option).strip() for option in raw]
    if not all(texts):
        return None
    return [{"id": _LETTERS[i], "text": text} for i, text in enumerate(texts)]


def _index(value: Any, size: int) -> str | None:
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value < size:
        return None
    return _LETTERS[value]


def _cases(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    cases = []
    for entry in raw[:6]:
        if isinstance(entry, dict) and "expected" in entry:
            cases.append({"input": str(entry.get("input", "")), "expected": str(entry["expected"])})
    return cases


def _one(item: Any, topic_tag: str) -> QuestionCreate | None:
    if not isinstance(item, dict):
        return None
    kind = item.get("kind")
    text = str(item.get("text", "")).strip()
    if kind not in KINDS or not text:
        return None
    common: dict[str, Any] = {
        "text": text,
        "explanation": (str(item["explanation"]).strip() or None) if item.get("explanation") else None,
        "default_marks": _clamp(item.get("marks"), 1, 10, 1),
        "difficulty": int(_clamp(item.get("difficulty"), 1, 5, 3)),
        "topics": [topic_tag] if topic_tag else [],
        "tags": ["ai-generated", kind],
    }

    if kind in ("mcq", "multi"):
        options = _options(item.get("options"))
        if options is None:
            return None
        size = len(options)
        if kind == "mcq":
            correct = _index(item.get("correct"), size)
            if correct is None:
                return None
            return QuestionCreate(question_type=QuestionType.MCQ_SINGLE, body={"options": options}, answer_key={"correct": correct}, **common)
        raw = item.get("correct")
        picked = [_index(i, size) for i in raw] if isinstance(raw, list) else []
        if not picked or None in picked:
            return None
        return QuestionCreate(
            question_type=QuestionType.MCQ_MULTI,
            body={"options": options},
            answer_key={"correct": sorted(set(picked)), "scoring": "partial"},  # type: ignore[type-var]
            **common,
        )

    if kind == "true_false":
        if not isinstance(item.get("correct"), bool):
            return None
        return QuestionCreate(question_type=QuestionType.TRUE_FALSE, body={}, answer_key={"correct": item["correct"]}, **common)

    if kind == "fill_blank":
        answers = item.get("correct")
        if isinstance(answers, str):
            answers = [answers]
        if not isinstance(answers, list) or not answers or not all(isinstance(a, str) and a.strip() for a in answers):
            return None
        return QuestionCreate(
            question_type=QuestionType.FILL_IN,
            body={"blanks": 1},
            answer_key={"blanks": [{"answers": [a.strip() for a in answers][:20], "case_sensitive": False}]},
            **common,
        )

    cases = _cases(item.get("test_cases"))
    model_answer = str(item.get("model_answer", "")).strip()
    if not cases or not model_answer:
        return None
    marks = common["default_marks"]
    each = round(marks / len(cases), 2)
    rubric = [
        {"id": f"t{i + 1}", "criterion": f"Input {case['input'] or '(none)'} gives {case['expected']}", "max_marks": each or 0.5}
        for i, case in enumerate(cases)
    ]
    common["default_marks"] = round(sum(r["max_marks"] for r in rubric), 2)
    return QuestionCreate(question_type=QuestionType.SUBJECTIVE, body={"rubric": rubric}, answer_key={"model_answer": model_answer}, **common)


def map_questions(content: str, topic_tag: str, limit: int) -> MappedBatch:
    batch = MappedBatch()
    for item in parse_json(content)[:limit]:
        try:
            question = _one(item, topic_tag)
        except (ValueError, TypeError):
            question = None
        if question is None:
            batch.skipped += 1
        else:
            batch.questions.append(question)
    return batch
