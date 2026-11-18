# Retired: legacy `job-portal` UI

The LMS **Jobs & placements** module (`src/modules/jobs/`) is the supported UI.

- Routes: `jobsModuleRoutes` in `src/modules/jobs/routes.tsx` (mounted from `app/router.tsx`)
- Navigation: `jobsNavigation` in `src/modules/jobs/navigation.ts`
- API: gateway `/api/v1/jcms` → `jcms-service` only

**Do not** mount `job-portal/routes.tsx` or mock `job-portal/jcms/*` pages.  
Backend `job-portal-service` may still appear in Docker/gateway for compatibility; it is **not** the product path for the Jobs UI.

Shared helpers under this folder may still be imported by user-management (e.g. employer CRM) until those call sites move fully under `modules/jobs`.
