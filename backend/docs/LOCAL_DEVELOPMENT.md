# Local development (Docker)

## Start the stack

```bash
cd backend
docker compose up -d
```

Proctoring is **off** by default (`proctoring-service` uses Compose profile `legacy-proctoring`). Do not enable it unless you are maintaining the legacy module.

## Database migrations

Each `*-service-migrate` container runs Alembic once on `docker compose up`. To re-run a single service after pulling new migrations:

```bash
docker compose run --rm catalog-service-migrate
```

## Assessment: clear proctoring on existing tests

After removing proctoring from the product, run once against the assessment DB:

```bash
docker compose exec postgres psql -U lms -d lms_assessment -f - < assessment-service/scripts/reset_proctoring_levels.sql
```

(PowerShell: pipe the file with `Get-Content`.)

## API gateway routes

When the stack is running, sync inventory from live OpenAPI (no local per-service venvs required):

```powershell
cd backend
$env:PYTHONPATH="api-gateway"
python api-gateway/scripts/patch_route_inventory.py --from-docker
```

Full regen (all services, needs each `service/.venv`):

```bash
python api-gateway/scripts/generate_routes.py
```

CI: `python api-gateway/scripts/generate_routes.py --check`

## Cross-database lookups (Docker)

Optional env vars (defaults use hostname `postgres`):

- `catalog-service`: `SUBSCRIPTION_DATABASE_URL`, `LEARNING_DATABASE_URL`
- `subscription-service`: `CATALOG_DATABASE_URL`, `USER_MANAGEMENT_DATABASE_URL`
- `certificate-service`: `CATALOG_DATABASE_URL`, `USER_MANAGEMENT_DATABASE_URL`

## Media uploads

Bind mount: `backend/docker/media-storage` → `media-service` (see `docker-compose.yml`).

## Code execution (Judge0)

Judge0 is not in the default compose profile; coding submissions may return stubbed results locally — use an optional Judge0 profile when you need live grading.

## Payments

Checkout and billing are intentionally **out of scope** for this deployment. The frontend sets `PAYMENTS_ENABLED = false` in `frontend/src/core/config/features.ts`.
