# Course module from `course_management_total_files`

## What was replaced

| Target | Source |
|--------|--------|
| `frontend/src/modules/catalog/` | `course_management_total_files/frontend/catalog/` (mirror) |
| `backend/catalog-service/` | `course_management_total_files/backend/catalog-service/` (`.env` preserved if present) |
| `frontend/src/modules/store/pages/BrowseCoursesPage.tsx` | `learning_and_store/BrowseCoursesPage.tsx` |
| `frontend/src/modules/learning/common/StudentDashboardView.tsx` | `learning_and_store/StudentDashboardView.tsx` |

## LMS adapters added (not in the CMS bundle)

- `frontend/src/modules/billing/institutional/api/institutionalApi.ts` — maps course pricing UI to billing `admin/prices` (`course_seat`).
- `frontend/src/modules/store/api/studentSubscriptionsApi.ts` — `GET /courses/browse` (instructor, duration, chapters, `access_status`, plan pricing).
- `frontend/src/modules/store/types/courseBrowse.ts` + `utils/courseBrowseAccess.ts` — institution vs external learner pricing/CTAs.
- `frontend/src/modules/store/pages/BrowseCourseDetailPage.tsx` — learner course detail at `/browse-courses/:courseId`.
- `frontend/src/modules/user-management/auth/hooks/useStudentType.ts` — `isInstitutionStudent` / `isExternalStudent`.
- `useSelfEnrollCourseMutation` in `enrollmentsApi.ts` — placeholder until a real self-enroll endpoint exists (institution enrollments still via batches/subscriptions).

## Routes

- `/browse-courses` — learner course discovery (`store/routes.tsx`, requires `catalog` section).

## Verify

```bash
cd frontend && npm run typecheck
# Rebuild catalog-service after backend sync:
cd ../backend && docker compose build catalog-service && docker compose up -d catalog-service
```