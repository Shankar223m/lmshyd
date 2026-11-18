/**
 * Jobs & placements API (LMS session). Backend paths use the placements service prefix `/jcms`.
 */
import { store } from "@/app/store";
import { env } from "@/core/config/env";

const API = `${env.apiBaseUrl}`;

export type ApiResponse<T> = {
  data: T;
  meta?: { request_id?: string };
  pagination?: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
  // LMS envelope fields (optional)
  status?: string;
  message?: string;
};

export type UserMe = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_id?: string;
  organization_name?: string;
};

export type StudentProfile = {
  program?: string;
  department?: string;
  batch?: string;
  graduation_year?: number | string;
  cgpa?: number | null;
  institution_name?: string;
  branch?: string;
  backlog_count?: number;
  skills?: string[];
  resume_file_id?: string | null;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  bio?: string;
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_id?: string;
  student_profile?: StudentProfile;
  organization?: OrganizationProfile;
  resume_file_id?: string | null;
};

export type OrganizationProfile = {
  id: string;
  name: string;
  org_type?: string;
  verification_status?: string;
  registration_number?: string;
  website?: string;
  contact_name?: string;
  contact_email?: string;
  size_band?: string;
  description?: string;
  industry?: string;
  address?: string;
  placement_contact_name?: string;
  placement_contact_email?: string;
};

function getAccessToken(): string | null {
  return store.getState().auth.accessToken;
}

function unwrap<T>(json: unknown): ApiResponse<T> {
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if ("data" in obj) return json as ApiResponse<T>;
    // LMS-style: pick first resource-like key
    for (const key of [
      "jobs", "job", "applications", "application", "interviews", "interview",
      "offers", "offer", "placements", "placement", "organizations", "stats",
      "notifications", "user", "profile", "assignments", "recruiters", "students",
      "analytics", "batch", "scorecard", "request",
    ]) {
      if (key in obj) {
        return { data: obj[key] as T, status: obj.status as string | undefined, message: obj.message as string | undefined };
      }
    }
    // Fallback: treat whole body as data
    return { data: json as T };
  }
  return { data: json as T };
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API}/jcms${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, { ...options, headers });
  if (res.status === 204) return {} as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (json as { message?: string; error?: { message?: string }; detail?: Array<{ msg?: string }> })?.message ||
      (json as { error?: { message?: string } })?.error?.message ||
      (json as { detail?: Array<{ msg?: string }> })?.detail?.[0]?.msg ||
      res.statusText ||
      "Request failed";
    throw new Error(String(msg));
  }
  return unwrap<unknown>(json) as T;
}

export function getAccessTokenExport() {
  return getAccessToken();
}
export function setAccessToken(_token: string | null) {
  /* LMS owns tokens — no-op */
}
export function setRefreshToken(_token: string | null) {
  /* LMS owns tokens — no-op */
}
export function getRefreshToken() {
  return null;
}

export const authApi = {
  login: async () => {
    throw new Error("Use the LMS login page.");
  },
  register: async (_body?: Record<string, unknown>) => {
    throw new Error("Use LMS registration / user-management.");
  },
  logout: async () => undefined,
  me: () => apiFetch<ApiResponse<UserMe>>("/auth/me"),
  getProfile: () => apiFetch<ApiResponse<UserProfile>>("/auth/profile"),
  updateProfile: (body: Record<string, unknown>) =>
    apiFetch("/auth/profile", { method: "PATCH", body: JSON.stringify(body) }),
  getEmployerOrg: () => apiFetch<ApiResponse<OrganizationProfile>>("/employers/me"),
  updateEmployerOrg: (body: Record<string, unknown>) =>
    apiFetch("/employers/me", { method: "PATCH", body: JSON.stringify(body) }),
  getInstitutionOrg: () => apiFetch<ApiResponse<OrganizationProfile>>("/institutions/me"),
  updateInstitutionOrg: (body: Record<string, unknown>) =>
    apiFetch("/institutions/me", { method: "PATCH", body: JSON.stringify(body) }),
  listRecruiters: () =>
    apiFetch<ApiResponse<Array<{ id: string; email: string; full_name: string }>>>("/employers/me/recruiters"),
  addRecruiter: (body: { email: string; full_name: string; password?: string }) =>
    apiFetch("/employers/me/recruiters", { method: "POST", body: JSON.stringify(body) }),
};

export async function apiDownload(path: string, filename: string) {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${API}/jcms${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export const filesApi = {
  upload: async (file: File, category = "general") => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetch<ApiResponse<{ id: string; original_name: string }>>(
      `/files/upload?category=${encodeURIComponent(category)}`,
      { method: "POST", body: fd },
    );
  },
  downloadUrl: (fileId: string) => `${env.apiBaseUrl}/jcms/files/${fileId}/download`,
  openDownload: async (fileId: string, defaultFilename = "download.pdf") => {
    await apiDownload(`/files/${fileId}/download`, defaultFilename);
  },
};
