import type { BaseQueryApi } from "@reduxjs/toolkit/query";

import { store } from "@/app/store";
import { refreshSession } from "@/core/api/baseApi";

const RENEW_BEFORE_EXPIRY_MS = 90_000;

const storeApi = (endpoint: string): Pick<BaseQueryApi, "getState" | "dispatch" | "signal" | "abort" | "extra" | "endpoint" | "type"> => ({
  getState: store.getState,
  dispatch: store.dispatch,
  signal: new AbortController().signal,
  abort: () => undefined,
  extra: undefined,
  endpoint,
  type: "mutation",
});

/** When the access token stops working, in epoch ms (read from its own "exp" claim); null if it cannot be read. */
export function tokenExpiry(token: string | null): number | null {
  try {
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const exp = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** A token that will still be valid for the next minute or so, renewing it first if it is about to lapse. */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const token = store.getState().auth.accessToken;
  const expiry = tokenExpiry(token);
  if (token && expiry !== null && expiry - Date.now() > 60_000) return token;
  if (!token && !store.getState().auth.user) return null;
  await refreshSession(storeApi("ensureFreshAccessToken"));
  return store.getState().auth.accessToken;
}

/**
 * Keeps a signed-in person signed in: renews the access token a minute and a half before it expires, and again
 * when a sleeping laptop or a background tab wakes up (timers do not run reliably there).
 */
export function startSessionKeeper(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const renewIfDue = () => {
    const state = store.getState().auth;
    if (!state.user) return;
    const expiry = tokenExpiry(state.accessToken);
    if (expiry === null || expiry - Date.now() < RENEW_BEFORE_EXPIRY_MS) void refreshSession(storeApi("sessionKeeper")).then(schedule);
  };

  const schedule = () => {
    clearTimeout(timer);
    const expiry = tokenExpiry(store.getState().auth.accessToken);
    if (expiry === null) return;
    timer = setTimeout(renewIfDue, Math.max(expiry - Date.now() - RENEW_BEFORE_EXPIRY_MS, 5_000));
  };

  let lastToken = store.getState().auth.accessToken;
  const unsubscribeToken = store.subscribe(() => {
    const token = store.getState().auth.accessToken;
    if (token !== lastToken) {
      lastToken = token;
      schedule();
    }
  });
  const onWake = () => {
    if (document.visibilityState === "visible") renewIfDue();
  };
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("online", renewIfDue);
  schedule();
  return () => {
    clearTimeout(timer);
    unsubscribeToken();
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("online", renewIfDue);
  };
}
