# GitHub source sync

This workspace tracks the public GenZ LMS repositories:

| Part | Repository | Local path |
|------|------------|------------|
| Backend | [Lms_backend_Gz](https://github.com/Nagarjunagen55/Lms_backend_Gz) | `backend/` (`origin` remote) |
| Frontend | [Lms_frontend_Gz](https://github.com/Nagarjunagen55/Lms_frontend_Gz) | `frontend/` (`origin` remote) |

The **UI/UX redesign** (Jobs & placements, sidebar policy, dashboards, etc.) is applied on top of the frontend repo; backend picks up repo updates plus local JCMS scripts and config (`.env`, campus job seeds).

## Pull latest upstream

```powershell
git -C backend pull origin main
git -C frontend pull origin main
```

Then re-apply or merge any local UI overlays if conflicts appear (see `frontend/src/modules/jobs` and `frontend/src/app` navigation files).

## Removed / archived

- Duplicate `jcms-portal` module (replaced by integrated `modules/jobs`).
- Previous tree before sync: `_deprecated/backend_old` (delete when no longer needed).