import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from "@/modules/jobs/features/auth/AuthContext";

export function ProtectedRoute({ roles }: { roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return <Outlet />;
}
