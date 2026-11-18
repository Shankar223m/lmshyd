import { useEffect, type ReactNode } from "react";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { store } from "@/app/store";
import { refreshSession } from "@/core/api/baseApi";
import { useAuth } from "@/modules/user-management/auth/hooks/useAuth";
import { sessionRestoreFinished } from "@/modules/user-management/auth/store/authSlice";
import { PageLoader } from "@/shared/ui";

/** On start-up, exchange the refresh cookie for an access token once. */
export function SessionRestorer({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.sessionStatus);

  useEffect(() => {
    if (status !== "checking") return;
    void refreshSession({
      getState: store.getState,
      dispatch: store.dispatch,
      signal: new AbortController().signal,
      abort: () => undefined,
      extra: undefined,
      endpoint: "restoreSession",
      type: "mutation",
    }).finally(() => dispatch(sessionRestoreFinished()));
  }, [dispatch, status]);

  // If we already know who signed in, render immediately while the refresh cookie is exchanged in the background.
  const { user } = useAuth();
  if (status === "checking" && !user) {
    return <PageLoader label="Restoring your session…" />;
  }
  return <>{children}</>;
}
