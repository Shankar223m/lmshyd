import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { ApiErrorBody, ErrorDetail } from "@/core/api/types";

export interface ApiError {
  httpStatus: number | null;
  code: string;
  message: string;
  details: ErrorDetail[];
  requestId: string | null;
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && (value as ApiErrorBody).status === "error";
}

/** Framework-level responses FastAPI itself generates (404/405/422…) use `detail`, not our envelope. */
function isDetailBody(value: unknown): value is { detail: unknown } {
  return typeof value === "object" && value !== null && "detail" in value;
}

const STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  422: "VALIDATION_FAILED",
  429: "TOO_MANY_REQUESTS",
  500: "SERVER_ERROR",
};

const STATUS_MESSAGES: Record<number, string> = {
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested item was not found.",
  429: "Too many requests. Please wait a moment and try again.",
};

/** Map a FastAPI `detail` (string or pydantic's validation array) onto our error shape. */
function toFastApiError(data: unknown, httpStatus: number | null): ApiError | null {
  if (!isDetailBody(data)) return null;
  const { detail } = data;
  const code = (httpStatus !== null && STATUS_CODES[httpStatus]) || "UNKNOWN_ERROR";
  if (typeof detail === "string") {
    return { httpStatus, code, message: detail, details: [], requestId: null };
  }
  if (Array.isArray(detail)) {
    const details: ErrorDetail[] = detail.map((item: Record<string, unknown>) => {
      const loc = Array.isArray(item?.loc) ? item.loc : [];
      const last = loc[loc.length - 1];
      return {
        field: typeof last === "string" ? last : null,
        code: typeof item?.type === "string" ? item.type : "INVALID",
        message: typeof item?.msg === "string" ? item.msg : "Invalid value",
      };
    });
    return {
      httpStatus,
      code: httpStatus === 422 ? "VALIDATION_FAILED" : code,
      message: details[0]?.message ?? "Please correct the highlighted fields.",
      details,
      requestId: null,
    };
  }
  return null;
}

/** Normalise any RTK Query / fetch failure into the backend's error shape. */
export function toApiError(error: unknown): ApiError {
  const fetchError = error as FetchBaseQueryError | undefined;
  if (fetchError && typeof fetchError === "object" && "status" in fetchError) {
    const httpStatus = typeof fetchError.status === "number" ? fetchError.status : null;
    if ("data" in fetchError && isErrorBody(fetchError.data)) {
      const body = fetchError.data;
      return { httpStatus, code: body.code, message: body.message, details: body.details ?? [], requestId: body.request_id };
    }
    if (fetchError.status === "FETCH_ERROR") {
      return { httpStatus: null, code: "NETWORK_ERROR", message: "Cannot reach the server. Check your connection and try again.", details: [], requestId: null };
    }
    if ("data" in fetchError) {
      const fastApi = toFastApiError(fetchError.data, httpStatus);
      if (fastApi) return fastApi;
    }
    const fallback = httpStatus !== null ? STATUS_MESSAGES[httpStatus] : undefined;
    if (httpStatus !== null && (httpStatus === 429 || fallback)) {
      return {
        httpStatus,
        code: STATUS_CODES[httpStatus] ?? "UNKNOWN_ERROR",
        message: fallback ?? "Too many requests. Please wait a moment and try again.",
        details: [],
        requestId: null,
      };
    }
  }
  return { httpStatus: null, code: "UNKNOWN_ERROR", message: "Something went wrong. Please try again.", details: [], requestId: null };
}

/**
 * Put field errors from the API onto the matching form fields. Form values use the same nested shape as
 * the request body, so `personal_info.phone` maps directly. Returns details that matched no field.
 */
export function applyServerErrors<T extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<T>,
  knownFields: (field: string) => boolean,
): ErrorDetail[] {
  const unmatched: ErrorDetail[] = [];
  let focused = false;
  for (const detail of error.details) {
    const field = detail.field;
    if (field && knownFields(field)) {
      // focus (and so scroll to) the first field with a problem, not the last one
      setError(field as Path<T>, { type: "server", message: detail.message }, { shouldFocus: !focused });
      focused = true;
    } else {
      unmatched.push(detail);
    }
  }
  return unmatched;
}
