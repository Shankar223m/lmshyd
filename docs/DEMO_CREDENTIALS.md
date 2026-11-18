# Demo credentials

Use these accounts only in **development, staging, or controlled demos** — not in production with real user data.

## Troubleshooting login

If sign-in shows **“Something went wrong on our side”** with HTTP 500, the user-management database is usually **behind the app code** (pending Alembic migrations). Apply migrations first:

```bash
cd backend
docker compose --profile tools run --rm user-management-migrate
```

Then try again. Wrong password returns a normal invalid-credentials message, not this generic 500.

## Seed the database

From the backend stack (with Postgres and user-management running):

```bash
cd backend/user-management
python -m app.cli seed-demo-accounts
```

Or inside Docker:

```bash
docker compose -f backend/docker-compose.yml exec user-management python -m app.cli seed-demo-accounts
```

Credentials are also written to `backend/user-management/var/demo_credentials.json` after a successful seed.

## Quick login (development)

Set `VITE_SHOW_DEMO_LOGIN=true` in `frontend/.env` to show the account picker on `/login`.  
**Production builds must use `VITE_SHOW_DEMO_LOGIN=false`** (default in `.env.example`).

## Primary accounts (one per role)

| Role | Email | Password | After login |
|------|-------|----------|-------------|
| Super admin | `demo.superadmin1@example.com` | `Sup3r!Admin#Demo1` | Home `/` |
| Admin (scoped) | `demo.admin1@example.com` | `Adm1n!Demo#Acct1` | Home `/` |
| Institution head | `demo.head1@example.com` | `H3ad!Inst#Demo1` | Home `/` |
| Staff | `demo.staff1@example.com` | `St4ff!Prof#Demo1` | Home `/` |
| Student | `demo.student1@example.com` | `Stud3nt!Lms#Demo1` | Home `/` |
| Employer admin | `demo.employer1@example.com` | `H1re!Demo#Emp1` | `/jobs/employer/jobs` |
| Recruiter | `demo.recruiter1@example.com` | `H1re!Demo#Rec1` | `/jobs/recruiter/screening` |

Usernames match the local part (e.g. `demo.student1`). All accounts use **example.com** emails so they are obvious fakes.

### Scoped admin (`demo.admin1`)

Default scopes: `accounts.manage`, `support.manage`, `analytics.view` (batches, course requests, subscriptions, support, analytics — not full content/exams unless granted).

### Institutions

| # | Institution | Head | Staff | Student |
|---|-------------|------|-------|---------|
| 1 | AI Smart Labs Solutions | head1 | staff1 | student1 |
| 2 | Charanteja Institute of Technology | head2 | staff2 | student2 |
| 3 | Demo Academy of Technology | head3 | staff3 | student3 |

### Employer org

| Company | Employer admin | Recruiter |
|---------|----------------|-----------|
| Demo Tech Hiring Co. | employer1 | recruiter1 |

## Full account list

Canonical JSON: [demo-credentials.json](./demo-credentials.json) (kept in sync with `frontend/src/config/demo-accounts.json` and the seed script).

## E2E tests

Copy `frontend/e2e/accounts.json.example` to `frontend/e2e/accounts.json` and adjust if your passwords differ after re-seeding.
