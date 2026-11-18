import { baseApi } from "@/core/api/baseApi";

export interface MyCourse {
  course_id: string;
  title: string;
  batch_id?: string;
  enrollment_id?: string;
}

/**
 * Active courses for the signed-in student (one API call; replaces per-batch fan-out).
 */
export const myCoursesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listMyCourses: build.query<MyCourse[], void>({
      query: () => "/enrollments/my-courses",
      transformResponse: (response: {
        courses?: Array<{
          course_id: string;
          title: string;
          batch_id: string;
          enrollment_id: string;
        }>;
      }) =>
        (response.courses ?? []).map((row) => ({
          course_id: row.course_id,
          title: row.title,
          batch_id: row.batch_id,
          enrollment_id: row.enrollment_id,
        })),
      providesTags: ["EnrollmentList"],
      keepUnusedDataFor: 120,
    }),
  }),
});

export const { useListMyCoursesQuery } = myCoursesApi;
