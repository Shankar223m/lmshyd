# Assign colleges to courses

Institution students only see courses their university holds an **active subscription** for (`lms_subscription.subscriptions`).

## UI (recommended)

1. Sign in as **super admin** or an admin with `accounts.manage`.
2. Open **Courses** → open a published course → **College access** tab (course hub).
3. Search your college (e.g. **GenZ Test College** or **AI Smart Labs** / code **GZTC**), set seats/term, click **Assign college**.

> Local dev seed may use **AI Smart Labs Solutions (GZTC)** instead of the literal name “GenZ Test College”.

API: `POST /api/v1/subscriptions` with `{ organization_id, course_id, seats, term_days }`.

## Bulk: all published courses → GenZ Test College

Ensure Docker DBs are up, then from repo root:

```bash
# Prefer the API with a platform token, or use the subscription service grant flow in your environment.
python backend/subscription-service/scripts/grant_all_published_courses_to_institution.py --institution-name "GenZ Test College"
```

Requires `USER_MANAGEMENT_DATABASE_URL`, `SUBSCRIPTION_DATABASE_URL`, and catalog `DATABASE_URL` (or defaults to local `lms:*@127.0.0.1`).

After grants, institution students refresh **Browse courses** — only licensed courses appear.