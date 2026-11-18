# Navigation configuration

The LMS uses a **single sidebar config** filtered by `permissions.menu` and `permissions.sections` from user-management.

## Source of truth

| File | Purpose |
|------|---------|
| `frontend/src/app/sidebarByRole.ts` | Role-specific sidebar trees (student, staff, head, admin, super_admin, employer, recruiter) |
| `frontend/src/app/useNavItems.ts` | Permission filter + `isNavItemEnabled` |
| `frontend/src/app/navPolicy.ts` / `roleNavPolicy.ts` | Hide deprecated menus and role-specific denylists |
| `frontend/src/app/focusMode.ts` | Student jobs route styling (sidebar is always full) |

Jobs & placements **no longer** uses `jobsNavChildren.ts` or a separate app shell. Platform JCMS moderation tabs live in the sidebar (`platformAdminJcmsNav` for **admin** + `careers.manage`, full **Jobs moderation** children for **super_admin**). Student jobs routes (`/jobs/student/*`) keep the **full role sidebar**; use **Jobs & career** children for in-section links.

Pass `{ jobsModerator: true }` from `useNavItems` when `role === "admin"` and `permissions.scopes` includes `careers.manage`.

## Adding a nav item

1. Add a permission in `backend/user-management/app/permissions/features.py` and wire it in `_MENU_ACCESS` if it belongs to a menu key.
2. Add a `NavItem` in the correct branch of `sidebarItemsForRole()` (or the module’s `navigation.ts` for platform-wide entries).
3. Mount a route in the module’s `routes.tsx` under `AppLayout`.
4. Guard with `RequireSection` or a module guard (jobs uses `RequireJobsPersona`).
5. Run `npm run check:nav` and update Playwright smoke if the path is role-critical.

## Jobs capabilities (permissions)

| Permission | Typical role |
|------------|----------------|
| `jobs.discover` | Student |
| `jobs.apply` | Student |
| `jobs.placements` | Head / staff |
| `jobs.hire`, `jobs.pipeline`, `jobs.interviews`, `jobs.company.manage` | Employer |
| `jobs.screening` | Recruiter |
| `jobs.moderate`, `jobs.activity` | Super admin (also `careers.manage` scope) |

JCMS still stores internal enum roles for APIs; LMS **super_admin** and **admin** with `careers.manage` map to moderation APIs via `jcms-service/app/core/lms_auth.py`.