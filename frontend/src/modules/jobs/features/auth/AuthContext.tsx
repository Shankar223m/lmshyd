/** Maps the LMS session into Jobs module role labels (no separate login). */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { RootState } from "@/app/store";
import { loggedOut } from "@/modules/user-management/auth/store/authSlice";
import type { UserMe } from "@/modules/jobs/apiClient";

type AuthContextValue = {
  user: UserMe | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** LMS admin + super_admin both operate Jobs platform APIs. */
const ROLE_MAP: Record<string, string> = {
  student: "STUDENT",
  employer_admin: "EMPLOYER",
  recruiter: "RECRUITER",
  institution_head: "INSTITUTION",
  staff: "INSTITUTION",
  admin: "PLATFORM_ADMINISTRATOR",
  super_admin: "PLATFORM_ADMINISTRATOR",
};

function toJobsUser(user: RootState["auth"]["user"]): UserMe | null {
  if (!user) return null;
  return {
    id: String(user.user_id),
    email: user.email,
    full_name: user.full_name,
    role: ROLE_MAP[user.role] || user.role.toUpperCase(),
    organization_id: user.institution?.organization_id
      ? String(user.institution.organization_id)
      : undefined,
    organization_name: user.institution?.name,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const auth = useSelector((s: RootState) => s.auth);
  const user = useMemo(() => toJobsUser(auth.user), [auth.user]);
  const loading = auth.sessionStatus === "checking";

  const value: AuthContextValue = {
    user,
    loading,
    login: async () => {
      throw new Error("Sign in through the LMS login page.");
    },
    logout: () => {
      dispatch(loggedOut());
      window.location.href = "/login";
    },
    refreshUser: async () => undefined,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
