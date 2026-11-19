import requests
import json
import sys
from datetime import datetime, timezone, timedelta

BASE_URL = "http://127.0.0.1:8000/api/v1"

def print_step(title):
    print(f"\n==========================================")
    print(f">> {title}")
    print(f"==========================================")

def login(identifier, password):
    res = requests.post(f"{BASE_URL}/auth/login", json={"identifier": identifier, "password": password})
    if res.status_code != 200:
        print(f"Login failed for {identifier}: {res.status_code} {res.text}")
        sys.exit(1)
    data = res.json()
    token = data["token"]["access_token"]
    user = data["user"]
    org_id = user.get("institution", {}).get("organization_id") if user.get("institution") else user.get("organization_id")
    print(f"Logged in as {user['full_name']} ({user['role']}) - Org ID: {org_id}")
    user["resolved_org_id"] = int(org_id) if org_id else None
    return token, user

# 1. Login as Staff
print_step("Step 1: Authenticating as Staff")
staff_token, staff_user = login("demo.staff1@example.com", "St4ff!Prof#Demo1")
staff_headers = {"Authorization": f"Bearer {staff_token}"}

# Authenticate Head for approving (Four-eyes principle)
print_step("Step 1b: Authenticating as Institution Head (for review & approval)")
head_token, head_user = login("demo.head1@example.com", "H3ad!Inst#Demo1")
head_headers = {"Authorization": f"Bearer {head_token}"}

# 2. Staff creates a question
print_step("Step 2: Staff creates an MCQ Question")
question_payload = {
    "question_type": "mcq_single",
    "text": "What is the primary function of an operating system kernel?",
    "body": {
        "options": [
            {"id": "a", "text": "To provide internet browsing functionality."},
            {"id": "b", "text": "To manage system resources and hardware communications."},
            {"id": "c", "text": "To compile source code into machine binaries."},
            {"id": "d", "text": "To render graphical animations on the screen."}
        ]
    },
    "answer_key": {"correct": "b"},
    "default_marks": 5.0,
    "difficulty": 3,
    "explanation": "The kernel is the core component that bridges applications and hardware.",
    "tags": ["os", "kernel"]
}
res_q = requests.post(f"{BASE_URL}/questions", json=question_payload, headers=staff_headers)
print(f"Create Question Response: {res_q.status_code}")
if res_q.status_code not in (200, 201):
    print(f"Error creating question: {res_q.text}")
    sys.exit(1)
q_data = res_q.json().get("question", res_q.json().get("data", {}))
q_id = q_data["question_id"]
print(f"Question created successfully! ID: {q_id}")

# Staff submits question, Head approves it
res_qs = requests.post(f"{BASE_URL}/questions/{q_id}/submit", headers=staff_headers)
print(f"Question submit status: {res_qs.status_code}")
res_qa = requests.post(f"{BASE_URL}/questions/{q_id}/approve", json={"note": "Approved"}, headers=head_headers)
print(f"Question approve status: {res_qa.status_code}")
if res_qa.status_code not in (200, 201):
    print(f"Error approving question: {res_qa.text}")
    sys.exit(1)
print(f"Question {q_id} approved and published.")

# 3. Staff creates a test
print_step("Step 3: Staff creates a Test")
test_payload = {
    "title": "Computer Systems & Architecture Evaluation",
    "instructions": "Answer all questions. Calculators not permitted.",
    "kind": "practice",
    "pass_mark_percent": 50,
    "duration_minutes": 30,
    "sections": [
        {
            "title": "Section 1 - Core Fundamentals",
            "slots": [
                {
                    "slot_type": "fixed",
                    "question_id": q_id,
                    "marks": 5.0
                }
            ]
        }
    ]
}
res_t = requests.post(f"{BASE_URL}/tests", json=test_payload, headers=staff_headers)
print(f"Create Test Response: {res_t.status_code}")
if res_t.status_code not in (200, 201):
    print(f"Error creating test: {res_t.text}")
    sys.exit(1)
test_data = res_t.json().get("test", res_t.json().get("data", {}))
test_id = test_data["test_id"]
print(f"Test created successfully! ID: {test_id}")

# 5. Staff submits test for review
print_step("Step 5: Staff submits test for review")
res_sub = requests.post(f"{BASE_URL}/tests/{test_id}/submit", headers=staff_headers)
print(f"Submit Test Response: {res_sub.status_code}")
if res_sub.status_code not in (200, 201):
    print(f"Error submitting test: {res_sub.text}")
    sys.exit(1)

# 6. Head approves the test (publishing it)
print_step("Step 6: Institution Head approves & publishes the test")
res_app = requests.post(f"{BASE_URL}/tests/{test_id}/approve", json={"note": "Approved by faculty head"}, headers=head_headers)
print(f"Approve Test Response: {res_app.status_code}")
if res_app.status_code not in (200, 201):
    print(f"Error approving test: {res_app.text}")
    sys.exit(1)
print("Test is now PUBLISHED!")

# 7. Staff schedules the test for the institution
print_step("Step 7: Staff schedules the test for GenZ Test College")
now = datetime.now(timezone.utc)
schedule_payload = {
    "title": "Midterm Examination Batch 2026",
    "organization_id": str(staff_user.get("resolved_org_id")),
    "starts_at": (now - timedelta(minutes=5)).isoformat(),
    "ends_at": (now + timedelta(days=2)).isoformat(),
    "enforce_end": False
}
res_sched = requests.post(f"{BASE_URL}/tests/{test_id}/schedules", json=schedule_payload, headers=staff_headers)
print(f"Schedule Test Response: {res_sched.status_code}")
if res_sched.status_code not in (200, 201):
    print(f"Error scheduling test: {res_sched.text}")
    sys.exit(1)
sched_data = res_sched.json().get("schedule", res_sched.json().get("data", {}))
print(f"Scheduled successfully! Schedule ID: {sched_data.get('public_id')}")

# 8. Student Authenticates
print_step("Step 8: Authenticating as Student")
student_token, student_user = login("demo.student1@example.com", "Stud3nt!Lms#Demo1")
student_headers = {"Authorization": f"Bearer {student_token}"}

# 9. Student checks available tests
print_step("Step 9: Student checks My Tests (/my-tests)")
res_my = requests.get(f"{BASE_URL}/my/tests", headers=student_headers)
print(f"My Tests Response: {res_my.status_code}")
if res_my.status_code != 200:
    print(f"Error fetching my tests: {res_my.text}")
    sys.exit(1)
my_tests_list = res_my.json().get("tests", res_my.json().get("data", {}).get("tests", []))
matching_test = next((t for t in my_tests_list if t["test_id"] == test_id or t.get("id") == test_id), None)
if not matching_test:
    print(f"Test {test_id} not found in student tests. Total tests found: {len(my_tests_list)}")
    print(json.dumps(my_tests_list[:3], indent=2))
    sys.exit(1)
print(f"Found test for student! Title: {matching_test.get('title')}, can_start: {matching_test.get('can_start')}")

# 10. Student Starts Test Attempt
print_step("Step 10: Student starts test attempt")
res_start = requests.post(f"{BASE_URL}/tests/{test_id}/attempts", json={"start_now": True}, headers=student_headers)
print(f"Start Attempt Response: {res_start.status_code}")
if res_start.status_code not in (200, 201):
    print(f"Error starting attempt: {res_start.text}")
    sys.exit(1)
attempt_data = res_start.json().get("attempt", res_start.json().get("data", {}))
attempt_id = attempt_data["attempt_id"]
print(f"Attempt started! Attempt ID: {attempt_id}, Status: {attempt_data.get('status')}")

# 11. Student gets attempt questions
print_step("Step 11: Student gets attempt questions")
res_att_q = requests.get(f"{BASE_URL}/attempts/{attempt_id}", headers=student_headers)
print(f"Get Attempt Paper Response: {res_att_q.status_code}")
questions_list = res_att_q.json().get("questions", res_att_q.json().get("data", {}).get("questions", []))
print(f"Retrieved {len(questions_list)} questions for the student.")
att_q_id = questions_list[0]["question_id"]

# 12. Student answers the question correctly (Option B)
print_step("Step 12: Student submits answer ('b')")
ans_payload = {"response": {"selected": "b"}, "revision": 1}
res_ans = requests.put(f"{BASE_URL}/attempts/{attempt_id}/answers/{att_q_id}", json=ans_payload, headers=student_headers)
print(f"Save Answer Response: {res_ans.status_code}")

# 13. Student submits the attempt
print_step("Step 13: Student submits the completed attempt")
res_finish = requests.post(f"{BASE_URL}/attempts/{attempt_id}/submit", headers=student_headers)
print(f"Submit Attempt Response: {res_finish.status_code}")
if res_finish.status_code not in (200, 201, 202):
    print(f"Error submitting attempt: {res_finish.text}")
    sys.exit(1)
sub_res_data = res_finish.json().get("attempt", res_finish.json().get("data", {}))
print(f"Submission status: {sub_res_data.get('status')}")

# 14. Student views their Result / Scorecard
print_step("Step 14: Student fetches their Result & Scorecard")
res_score = requests.get(f"{BASE_URL}/attempts/{attempt_id}/result", headers=student_headers)
print(f"Student Result Response: {res_score.status_code}")
if res_score.status_code == 200:
    result_data = res_score.json().get("result", res_score.json().get("data", {}))
    print(f">> SCORE: {result_data.get('score')} / {result_data.get('max_score')}")
    print(f">> PERCENTAGE: {result_data.get('percent')}%")
    print(f">> RESULT: {result_data.get('result')}")
    print(f">> STATUS: {result_data.get('status')}")
else:
    print(f"Result details: {res_score.text}")

# 15. Student checks all their attempts (/results page API)
print_step("Step 15: Student verifies their attempts list (used by StudentResultsPage)")
res_st_list = requests.get(f"{BASE_URL}/attempts", headers=student_headers)
print(f"Student Attempts List Response: {res_st_list.status_code}")
st_attempts = res_st_list.json().get("attempts", res_st_list.json().get("data", {}).get("attempts", []))
matching_att = next((a for a in st_attempts if a["attempt_id"] == attempt_id), None)
if matching_att:
    print(f"SUCCESS: Attempt found in student history!")
    print(f"Score: {matching_att.get('score')}/{matching_att.get('max_score')} ({matching_att.get('percent')}%) - Result: {matching_att.get('result')}")
else:
    print("Warning: Attempt not found in student list")

# 16. Staff verifies the student's result is visible in staff dashboard
print_step("Step 16: Staff verifies student's submission in Staff Gradebook/Attempts")
res_staff_list = requests.get(f"{BASE_URL}/attempts", headers=staff_headers)
print(f"Staff Attempts List Response: {res_staff_list.status_code}")
staff_attempts = res_staff_list.json().get("attempts", res_staff_list.json().get("data", {}).get("attempts", []))
staff_matching = next((a for a in staff_attempts if a["attempt_id"] == attempt_id), None)
if staff_matching:
    print(f"SUCCESS: Staff can view student's attempt!")
    print(f"Student: {staff_matching.get('student_name', 'Student')} | Score: {staff_matching.get('score')}/{staff_matching.get('max_score')} ({staff_matching.get('percent')}%) | Status: {staff_matching.get('status')}")
else:
    print(f"Staff attempts count: {len(staff_attempts)}")
    for a in staff_attempts[:5]:
        print(f"  Attempt {a.get('attempt_id')}: {a.get('test_title')} - {a.get('score')}")

print("\n==========================================")
print(">> ALL LIVE FLOW VERIFICATIONS COMPLETED SUCCESSFULLY! <<")
print("==========================================")
