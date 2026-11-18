import json

import pytest

from app.clients.gateway import Completion, GatewayClient, GatewayUnavailable

PAYLOAD = {
    "topic_tag": "chapter-77",
    "chapter_title": "Props and State",
    "chapter_description": "How data flows into a component.",
    "objectives": ["Explain props"],
    "count": 3,
}

REPLY = json.dumps(
    [
        {"kind": "mcq", "text": "What are props?", "options": ["Inputs", "Outputs", "Styles"], "correct": 0, "explanation": "Props are inputs."},
        {"kind": "true_false", "text": "Props can be changed by the child", "correct": False},
        {"kind": "mcq", "text": "Broken", "options": ["only one"], "correct": 0},
    ]
)


@pytest.fixture
def ai(monkeypatch):
    state = {"reply": REPLY, "error": None, "calls": []}

    async def complete(self, **kwargs):
        state["calls"].append(kwargs)
        if state["error"]:
            raise state["error"]
        return Completion(status="ok", content=state["reply"])

    monkeypatch.setattr(GatewayClient, "complete", complete)
    return state


async def test_generated_questions_are_drafts_tagged_with_the_chapter(client, who, ai, settings):
    settings.AI_PLATFORM_ORGANIZATION_ID = 1755000000007003
    who.author()
    response = await client.post("/api/v1/questions/generate", json=PAYLOAD)
    assert response.status_code == 201, response.text
    body = response.json()
    assert len(body["created"]) == 2 and body["skipped"] == 1  # the malformed third one was left out
    assert all(q["working"]["status"] == "draft" and q["current"] is None for q in body["created"])
    assert body["created"][0]["working"]["topics"] == ["chapter-77"]
    assert ai["calls"][0]["prompt_key"] == "assessment.question_generation"

    listed = await client.get("/api/v1/questions", params={"topic": "chapter-77", "version_status": "draft"})
    assert listed.status_code == 200 and len(listed.json()["questions"]) == 2


async def test_only_authors_may_generate(client, who, ai, settings):
    settings.AI_PLATFORM_ORGANIZATION_ID = 1755000000007003
    who.reviewer()
    response = await client.post("/api/v1/questions/generate", json=PAYLOAD)
    assert response.status_code == 403
    assert ai["calls"] == []


async def test_an_unavailable_ai_is_a_clear_503_and_creates_nothing(client, who, ai, settings):
    settings.AI_PLATFORM_ORGANIZATION_ID = 1755000000007003
    who.author()
    ai["error"] = GatewayUnavailable("quota", code="QUOTA_EXCEEDED")
    response = await client.post("/api/v1/questions/generate", json=PAYLOAD)
    assert response.status_code == 503 and response.json()["code"] == "AI_UNAVAILABLE"
    assert (await client.get("/api/v1/questions", params={"topic": "chapter-77"})).json()["questions"] == []


async def test_an_unreadable_reply_creates_nothing(client, who, ai, settings):
    settings.AI_PLATFORM_ORGANIZATION_ID = 1755000000007003
    who.author()
    ai["reply"] = "Sorry, I cannot help with that."
    response = await client.post("/api/v1/questions/generate", json=PAYLOAD)
    assert response.status_code == 503


async def test_a_chapter_with_nothing_to_read_is_refused(client, who, ai, settings):
    settings.AI_PLATFORM_ORGANIZATION_ID = 1755000000007003
    who.author()
    response = await client.post("/api/v1/questions/generate", json={"topic_tag": "chapter-1", "chapter_title": "Empty"})
    assert response.status_code == 400 and response.json()["code"] == "NOTHING_TO_READ"
    assert ai["calls"] == []


async def test_batch_approve_publishes_a_generated_set_for_a_super_admin(client, who, ai, settings):
    settings.AI_PLATFORM_ORGANIZATION_ID = 1755000000007003
    who.author()
    created = (await client.post("/api/v1/questions/generate", json=PAYLOAD)).json()["created"]
    ids = [q["question_id"] for q in created]

    who.super_admin()
    response = await client.post("/api/v1/questions/batch-approve", json={"question_ids": ids + ids[:1]})  # a repeat is handled once
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["approved"] == 2 and body["failed"] == 0
    for question_id in ids:
        question = (await client.get(f"/api/v1/questions/{question_id}")).json()["question"]
        assert question["current"]["status"] == "published"


async def test_batch_approve_by_the_author_alone_is_refused_per_question(client, who, ai, settings):
    settings.AI_PLATFORM_ORGANIZATION_ID = 1755000000007003
    who.author()
    ids = [q["question_id"] for q in (await client.post("/api/v1/questions/generate", json=PAYLOAD)).json()["created"]]
    response = await client.post("/api/v1/questions/batch-approve", json={"question_ids": ids})
    assert response.status_code == 200
    assert response.json()["approved"] == 0 and response.json()["failed"] == 2  # no review rights: nothing goes live
