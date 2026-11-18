# Production readiness

## Frontend

| Setting | Production | Development / demo |
|--------|------------|-------------------|
| `VITE_SHOW_DEMO_LOGIN` | **`false`** | `true` to show the login account picker |
| Payments | Keep `PAYMENTS_ENABLED = false` in `frontend/src/core/config/features.ts` until Stripe/Razorpay is live | — |
| Build | `npm run build` then serve `dist/` (or the `web` Docker image) | `npm run dev` |

Never ship a bundle with demo credentials UI enabled on a public production URL.

## Backend

Follow `backend/user-management/README.md`:

- `ENVIRONMENT=production`
- Strong `SECRET_KEY`, explicit `TRUSTED_HOSTS` and `CORS_ORIGINS`
- Real SMTP (`EMAIL_BACKEND=smtp`), `DEBUG=false`
- Services refuse to start with development-only secrets in production-like environments

## Demo data

- **Do not** run `seed-demo-accounts` on a production database with real users unless you use `--force` intentionally.
- For sales/staging environments, seed once and distribute credentials from [DEMO_CREDENTIALS.md](./DEMO_CREDENTIALS.md).

## Jobs & placements (JCMS)

The live product path is **`jcms-service`** via the gateway (`/api/v1/jcms`). The frontend Jobs UI does not call `job-portal-service`.

| Requirement | Notes |
|-------------|--------|
| `jcms-service` healthy | Compose service + worker; JWKS URL reaches user-management |
| Migrations | Run `jcms-service-migrate` (or your deploy migrate job) before traffic |
| Secrets | Set `APP_ENV=production` (or `staging`) and a strong non-default `SECRET_KEY` (32+ chars); JCMS refuses to start with `debug=true` or `dev-secret-change-me` in those envs |
| Auth boundary | Only LMS **`super_admin`** maps to JCMS platform admin. Scoped LMS `admin` is not a Jobs moderator |
| Moderation | New employer posts typically enter review; a super admin clears the moderation queue |
| Content | Run `PYTHONPATH=. python scripts/reseed_realistic_campus_jobs.py` in `jcms-service` (against `lms_jcms` on port **5433**) to close junk postings and publish five campus demo jobs with real career-style descriptions. LMS `seed-demo-accounts` does not seed JCMS openings by itself. |
| Demo login | Keep `VITE_SHOW_DEMO_LOGIN=false` in production builds |

Legacy `job-portal-service` may still appear in compose/gateway for compatibility; it is **not** the UI product path. Frontend `modules/job-portal` is retired (see `frontend/src/modules/job-portal/RETIRED.md`).

## Pre-release checklist

1. `VITE_SHOW_DEMO_LOGIN=false` in the production frontend environment.
2. `npm run build` and `node scripts/check-nav-routes.mjs` pass.
3. Docker stack health checks green; migrations applied (including **jcms-service**).
4. Remove or rotate any default MinIO/Postgres passwords from compose defaults.
5. Confirm API gateway route inventory matches deployed services.
6. Confirm Jobs role smoke: `e2e/specs/12-jcms-jobs.spec.ts`.
7. Confirm hire chain: `e2e/specs/13-jobs-hire-chain.spec.ts` (create → moderate → discover).

## Local full stack (typical)

```bash
# Backend
cd backend && docker compose up -d

# Seed demos (once)
docker compose exec user-management python -m app.cli seed-demo-accounts

# Frontend
cd frontend && npm install && npm run dev
```

Open `http://localhost:3000` (or `5173` if `DEV_SERVER_PORT` differs). API via proxy at `/api/v1`.
