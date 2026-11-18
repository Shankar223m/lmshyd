// RBAC audit API slice – integrates with the backend RBAC audit endpoints
import { baseApi } from "@/core/api/baseApi";
import type { ListResult, PageParams } from "@/core/api/types";

export interface RbacAuditLog {
  audit_log_id: string;
  time: string;
  action: string;
  category: string;
  actor: { id: number; full_name: string; role: string } | null;
  target: { type: string; id: string | null; name: string | null } | null;
  institution: { id: number; name: string } | null;
  ip_address: string | null;
  details: Record<string, unknown> | null;
  permission_key?: string;
  outcome?: string;
  delegation_capability?: string;
}

export interface RbacAuditLogFilters {
  [key: string]: string | number | boolean | undefined;
  actor_user_id?: number;
  target_user_id?: number;
  institution_id?: number;
  actor_role?: string;
  permission_key?: string;
  delegation_capability?: string;
  outcome?: string;
  created_from?: string;
  created_to?: string;
  sort_order?: "asc" | "desc";
}

export const rbacAuditApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listRbacAuditLogs: build.query<ListResult<RbacAuditLog>, RbacAuditLogFilters & PageParams>({
      query: (params) => ({ url: "/audit/rbac", params }),
      transformResponse: (response: { audit_logs: RbacAuditLog[]; page_context: any }) => ({
        items: response.audit_logs,
        pageContext: response.page_context,
      }),
    }),
    getRbacAuditById: build.query<RbacAuditLog | null, string>({
      query: (eventId) => ({ url: `/audit/rbac/${eventId}` }),
      transformResponse: (response: { audit_logs: RbacAuditLog[]; page_context: any }) =>
        response.audit_logs[0] ?? null,
    }),
  }),
  overrideExisting: false,
});

export const { useListRbacAuditLogsQuery, useGetRbacAuditByIdQuery } = rbacAuditApi;
