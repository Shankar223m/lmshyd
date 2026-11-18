import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { authApi } from "@/modules/jobs/apiClient";

const DEMO_ACCOUNTS = [
  { role: 'STUDENT', email: 'student@svi.local', password: 'Student123!', label: 'Student' },
  { role: 'EMPLOYER', email: 'employer@brightpath.local', password: 'Employer123!', label: 'Employer' },
  { role: 'RECRUITER', email: 'recruiter@brightpath.local', password: 'Recruiter123!', label: 'Recruiter' },
  { role: 'INSTITUTION', email: 'institution@svi.local', password: 'Institution123!', label: 'Institution' },
  { role: 'PLATFORM_ADMINISTRATOR', email: 'admin@jcms.local', password: 'Admin123!', label: 'Platform Admin' },
];

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('student@svi.local');
  const [password, setPassword] = useState('Student123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roleHome: Record<string, string> = {
    STUDENT: '/jobs/student/dashboard',
    EMPLOYER: '/jobs/employer/jobs',
    RECRUITER: '/jobs/recruiter/screening',
    INSTITUTION: '/jobs/institution/placements',
    PLATFORM_ADMINISTRATOR: '/jobs/admin/dashboard',
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const cleanEmail = email.trim();
    try {
      await login(cleanEmail, password);
      const me = await authApi.me();
      nav(roleHome[me.data.role] || '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const selectDemoAccount = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs space-y-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                GZ
              </div>
              <h1 className="text-xl font-bold text-slate-900">Sign in to Jobs & placements</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">Jobs &amp; Career Management System</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold uppercase text-slate-600">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@example.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold uppercase text-slate-600">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-xs focus:border-indigo-500 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-xs"
          >
            {loading ? 'Authenticating…' : 'Sign in'}
          </button>

          <p className="text-center text-xs text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:underline">
              Create one
            </Link>
          </p>
        </form>

        {/* Demo Fast Login Switcher */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Quick Demo Login Switcher
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => selectDemoAccount(acc)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  email === acc.email
                    ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-medium">{acc.label}</div>
                <div className="text-[10px] text-slate-400 truncate">{acc.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
