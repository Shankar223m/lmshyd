import { baseApi } from "@/core/api/baseApi";
import type { PageContext } from "@/core/api/types";
import type {
  BrowseCourse,
  CourseCurriculumPreview,
} from "@/modules/store/types/courseBrowse";

export type {
  BrowseCourse,
  CourseAccessStatus,
  ChapterPreview,
  ModulePreview,
  CourseCurriculumPreview,
} from "@/modules/store/types/courseBrowse";

type BrowseParams = {
  page?: number;
  per_page?: number;
  search_text?: string;
};

export const studentSubscriptionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    browsePublishedCourses: build.query<
      { courses: BrowseCourse[]; page_context?: PageContext },
      BrowseParams
    >({
      query: (params) => ({ url: "/courses/browse", params }),
      transformResponse: (response: { courses?: BrowseCourse[]; page_context?: PageContext }) => ({
        courses: response.courses ?? [],
        page_context: response.page_context,
      }),
      providesTags: ["CourseList"],
    }),
    getCourseCurriculumPreview: build.query<CourseCurriculumPreview, string>({
      query: (courseId) => ({ url: `/courses/${courseId}/curriculum-preview` }),
      transformResponse: (response: { curriculum: CourseCurriculumPreview }) => response.curriculum,
      providesTags: (_res, _err, courseId) => [{ type: "CourseVersion", id: courseId }],
    }),
  }),
});

export const { useBrowsePublishedCoursesQuery, useGetCourseCurriculumPreviewQuery } = studentSubscriptionsApi;
