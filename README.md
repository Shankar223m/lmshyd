# LMS (GenZ Technologies)

Institution learning, assessments, certificates, AI tutor, and integrated **Jobs & placements** — one platform from classroom to career.

**Product pillars (vs typical LMS-only tools):**

- **Campus → career** — students see learn → certify → hire on the home screen, not three siloed products.
- **Role-first UX** — sidebar and home “Start here” shortcuts match each persona (student, staff, head, employer, admin).
- **Scoped operations** — institution admins work inside their scope; super admins keep governance (permissions, moderation, audit).
- **Assessments + outcomes** — grading queue and academic outcomes are first-class, not spreadsheet exports.

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/DEMO_CREDENTIALS.md](./docs/DEMO_CREDENTIALS.md) | **Demo logins** (all roles) and how to seed them |
| [docs/PRODUCTION.md](./docs/PRODUCTION.md) | Production checklist (`VITE_SHOW_DEMO_LOGIN`, build, security) |
| [backend/README.md](./backend/README.md) | Docker stack, services, migrations |
| [frontend/README.md](./frontend/README.md) | UI dev server and build |

## Quick start (local)

```bash
# 1. Backend
cd backend
cp .env.example .env   # if needed
docker compose up -d

# 2. Migrations (required after pulling new code)
docker compose --profile tools run --rm user-management-migrate

# 3. Demo users (once per database)
docker compose run --rm -v ./user-management/scripts:/app/scripts user-management python -m app.cli seed-demo-accounts

# 4. Frontend
cd ../frontend
cp .env.example .env
# Enable demo picker locally:
#   VITE_SHOW_DEMO_LOGIN=true
npm install
npm run dev
```

Sign in with any account from [docs/DEMO_CREDENTIALS.md](./docs/DEMO_CREDENTIALS.md).

## Production

- Set **`VITE_SHOW_DEMO_LOGIN=false`** for the frontend.
- Do **not** run `seed-demo-accounts` on production data unless intentional.
- See [docs/PRODUCTION.md](./docs/PRODUCTION.md).
"# lmshyd" 
