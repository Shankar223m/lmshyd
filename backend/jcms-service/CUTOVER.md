# JCMS cutover (CursorJobs → LMS)

## What changed

- **Backend:** CursorJobs FastAPI lives at `jcms-service/` and is the source of truth for Jobs workflows (jobs, applications, screening, offers, placements, resume upload/download).
- **Auth:** LMS access tokens only. `LMS_AUTH_ENABLED=true` disables JCMS login/register. Tokens are verified via user-management JWKS; identity is upserted using LMS `sub` as JCMS `users.id`. Email/name come from `GET /api/v1/users/me`.
- **Gateway:** `/api/v1/jcms` → `jcms-service` (see `api-gateway/config/routes.json` + `UPSTREAM_URLS`).
- **Frontend:** `/jobs/...` is the CursorJobs/PDF UI under `frontend/src/modules/jcms-portal`. LMS career resume routes and the old job-portal UI are no longer mounted.
- **Resumes:** `POST /api/v1/jcms/files/upload?category=resume` and `GET /api/v1/jcms/files/{id}/download` (recruiter access via JCMS file ACL).

## Run (compose)

```bash
docker compose --profile tools up jcms-service-migrate
docker compose up jcms-service jcms-service-worker api-gateway
```

Host port default: `JCMS_PORT=8019`. Database: `lms_jcms`.

## Role map

| LMS role           | JCMS role                 |
|--------------------|---------------------------|
| student            | STUDENT                   |
| employer_admin     | EMPLOYER                  |
| recruiter          | RECRUITER                 |
| institution_head / staff | INSTITUTION         |
| super_admin / admin| PLATFORM_ADMINISTRATOR    |

## Still present but unused for Jobs

- `job-portal-service` and legacy `/api/v1/job-board` routes remain for gradual retirement.
- `career-service` resume APIs remain in the gateway but the LMS `/career` UI is unmounted.
