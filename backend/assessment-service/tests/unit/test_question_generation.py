import json

from app.ai.question_mapper import map_questions, parse_json
from app.domain.enums import QuestionType

TOPIC = "chapter-1"


def _batch(items):
    return map_questions(json.dumps(items), TOPIC, 10)


def test_fenced_and_wrapped_replies_are_read():
    assert parse_json('```json\n[{"kind": "mcq"}]\n```') == [{"kind": "mcq"}]
    assert parse_json('Here you go: [{"kind": "mcq"}] enjoy') == [{"kind": "mcq"}]
    assert parse_json('{"questions": [{"kind": "mcq"}]}') == [{"kind": "mcq"}]
    assert parse_json("not json at all") == []


def test_an_mcq_becomes_a_single_answer_question_with_lettered_options():
    batch = _batch([{"kind": "mcq", "text": "What is React?", "options": ["A library", "A database", "A language"], "correct": 0, "marks": 2, "difficulty": 2}])
    question = batch.questions[0]
    assert question.question_type == QuestionType.MCQ_SINGLE
    assert question.body["options"][0] == {"id": "a", "text": "A library"}
    assert question.answer_key == {"correct": "a"}
    assert question.default_marks == 2 and question.difficulty == 2
    assert question.topics == [TOPIC] and "ai-generated" in question.tags


def test_multi_true_false_and_fill_blank_are_mapped():
    batch = _batch(
        [
            {"kind": "multi", "text": "Pick the hooks", "options": ["useState", "useFoo", "useEffect"], "correct": [0, 2]},
            {"kind": "true_false", "text": "Props are read-only", "correct": True},
            {"kind": "fill_blank", "text": "State is set with ____", "correct": ["setState", "useState"]},
        ]
    )
    kinds = [q.question_type for q in batch.questions]
    assert kinds == [QuestionType.MCQ_MULTI, QuestionType.TRUE_FALSE, QuestionType.FILL_IN]
    assert batch.questions[0].answer_key["correct"] == ["a", "c"]
    assert batch.questions[2].body == {"blanks": 1}


def test_coding_questions_carry_their_test_cases_as_a_rubric():
    batch = _batch(
        [{"kind": "coding", "text": "Add two numbers", "test_cases": [{"input": "1 2", "expected": "3"}, {"input": "5 5", "expected": "10"}], "model_answer": "print(a+b)", "marks": 4}]
    )
    question = batch.questions[0]
    assert question.question_type == QuestionType.SUBJECTIVE
    assert [r["criterion"] for r in question.body["rubric"]] == ["Input 1 2 gives 3", "Input 5 5 gives 10"]
    assert question.default_marks == 4


def test_malformed_questions_are_skipped_and_counted():
    batch = _batch(
        [
            {"kind": "mcq", "text": "No options", "correct": 0},
            {"kind": "mcq", "text": "Bad index", "options": ["a", "b"], "correct": 5},
            {"kind": "essay", "text": "Unknown kind"},
            {"kind": "coding", "text": "No cases", "model_answer": "x"},
            "not an object",
            {"kind": "true_false", "text": "Fine", "correct": False},
        ]
    )
    assert len(batch.questions) == 1 and batch.skipped == 5


def test_marks_and_difficulty_are_clamped_and_the_count_is_capped():
    batch = map_questions(
        json.dumps([{"kind": "true_false", "text": f"Q{i}", "correct": True, "marks": 500, "difficulty": 9} for i in range(6)]), TOPIC, 3
    )
    assert len(batch.questions) == 3
    assert batch.questions[0].default_marks == 10 and batch.questions[0].difficulty == 5
