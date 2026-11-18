/** Student jobs routes — used for light main-area styling only (sidebar stays full). */
const JOBS_STUDENT_PREFIX = "/jobs/student/";

export function isJobsFocusPath(pathname: string): boolean {
  return pathname.startsWith(JOBS_STUDENT_PREFIX);
}