# JCMS → LMS merge report

## Summary

Jobs & placements is integrated as a normal LMS module: **one shell** (`AppLayout`), **one auth** (user-management JWT), **one sidebar config** (`sidebarByRole.ts`), and **LMS role guards** (`RequireJobsPersona`) instead of JCMS `RoleGate` / `PLATFORM_ADMINISTRATOR` in the UI.

## What changed

### Backend (Phase 2)
- Added granular job permissions: `jobs.discover`, `jobs.pipeline`, `jobs.interviews`, `jobs.screening`, `jobs.moderate`, `jobs.activity`.
- Extended `jobs` menu mapping in `features.py`.
- `lms_auth._map_role` maps `super_admin` and `admin` + `careers.manage` → JCMS moderator role for API checks only.

### Frontend (Phase 3)
- Removed nested `JobsProviders`, `JobsSubnavLayout`, and JCMS `RoleGate` from `routes.tsx`.
- Added `sidebarByRole.ts`, `useJobsAccess`, `RequireJobsMenu` / `RequireJobsPersona`.
- Admin moderation uses in-page `AdminSectionTabs` (`TabbedPage`) inside `AppLayout`.
- Focus mode driven by `focusMode.ts`.
- `CreateJobPage` uses `useJobsAccess().isModerator` (no `PLATFORM_ADMINISTRATOR` in UI).

### Phase 4 (deferred)
- **Notifications:** JCMS events → notifications-service bell (not wired in this pass).
- **Analytics:** Placement KPIs in analytics-service dashboards (not wired).
- **Apply flow:** Certificate + résumé attachments on apply (not wired).
- **Student dashboard journey:** Unified next-lesson → test → jobs widgets (not wired).
- **Service merge:** `jcms-service` remains a separate service (per your default).

### Phase 5
- `docs/NAVIGATION.md` added.
- `job-portal` mock module still on disk but **not mounted** in `router.tsx` (see `modules/job-portal/RETIRED.md`).
- Legacy files retained but unused: `JobsSubnavLayout.tsx`, `jobsNavChildren.ts`, `features/auth/*` (safe to delete in a follow-up).

## Route redirect map (unchanged paths)

| Old path | New path |
|----------|----------|
| `/jobs/admin/verification` | `/jobs/admin/review?tab=orgs` |
| `/jobs/admin/job-moderation` | `/jobs/admin/review` |
| `/jobs` | Role-based home via `jobsHomePath()` |

## Tests

- `npm run typecheck` (frontend)
- `jcms-service/tests/test_lms_role_map.py` (admin + careers.manage)
- Run `verify_jobs_role_smoke.py` and Playwright `12-jcms-jobs` / `13-jobs-hire-chain` after rebuild.

## Follow-ups

1. Delete dead jobs auth/layout files.
2. Remove `modules/job-portal/jcms` mock tree.
3. Unit test `sidebarByRole` labels per role.
4. Wire notification deep links from JCMS.
5. Seed migration if new permissions need DB role rows (run UM permission sync / migrate).