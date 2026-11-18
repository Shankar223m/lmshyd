import { baseApi } from "@/core/api/baseApi";

export interface Industry { key: string; name: string; icon: string; departments: number }
export interface Department { key: string; name: string }
export interface RoleHit { key: string; name: string; department: string; department_key: string; industry: string; industry_key: string; specializations: string[] }
export interface CareerLevelOption { key: string; name: string; experience_level: string; note: string }
export interface PurposeOption { key: string; name: string; note: string; emphasis: string[] }

/** What the catalogue says a resume for one role should contain. Works for a custom role too. */
export interface RoleProfile {
  role_key: string | null;
  role_name: string | null;
  department: string | null;
  department_key: string | null;
  industry: string | null;
  industry_key: string | null;
  custom: boolean;
  skills: { name: string; why: string }[];
  keywords: string[];
  sections: {
    labels: { experience: string; projects: string; skills: string; education: string; achievements: string };
    skill_groups: string[];
    extra_sections: { label: string; hint: string }[];
    projects_step: boolean;
  };
  template_keys: string[];
  ai_hint: string | null;
  why: string;
}

export const taxonomyApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listIndustries: build.query<Industry[], void>({ query: () => "/taxonomy/industries", transformResponse: (r: { items: Industry[] }) => r.items }),
    listDepartments: build.query<Department[], string>({ query: (industry) => `/taxonomy/industries/${industry}/departments`, transformResponse: (r: { items: Department[] }) => r.items }),
    searchRoles: build.query<RoleHit[], { q?: string; industry?: string; department?: string }>({
      query: (params) => ({ url: "/taxonomy/roles", params }),
      transformResponse: (r: { items: RoleHit[] }) => r.items,
    }),
    getRoleProfile: build.query<RoleProfile, { role?: string | null; department?: string | null; customRole?: string | null }>({
      query: ({ role, department, customRole }) => ({ url: "/taxonomy/role-profile", params: { role: role || undefined, department: department || undefined, custom_role: customRole || undefined } }),
      transformResponse: (r: { profile: RoleProfile }) => r.profile,
    }),
    listCareerLevels: build.query<CareerLevelOption[], void>({ query: () => "/taxonomy/career-levels", transformResponse: (r: { items: CareerLevelOption[] }) => r.items }),
    listPurposes: build.query<PurposeOption[], void>({ query: () => "/taxonomy/purposes", transformResponse: (r: { items: PurposeOption[] }) => r.items }),
  }),
});

export const {
  useListIndustriesQuery, useListDepartmentsQuery, useSearchRolesQuery, useGetRoleProfileQuery, useListCareerLevelsQuery, useListPurposesQuery,
} = taxonomyApi;
