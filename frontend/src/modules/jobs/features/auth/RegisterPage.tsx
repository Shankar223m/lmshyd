import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from "@/modules/jobs/apiClient";

export function RegisterPage() {
  const nav = useNavigate();
  const [role, setRole] = useState<'STUDENT' | 'EMPLOYER' | 'INSTITUTION'>('STUDENT');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    const cleanFullName = fullName.trim();
    const cleanOrgName = orgName.trim();

    if (!cleanFullName) {
      setError('Full name is required.');
      return;
    }

    if (!cleanEmail) {
      setError('Email address is required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    if (role !== 'STUDENT' && !cleanOrgName) {
      setError('Organization name is required.');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        email: cleanEmail,
        password,
        full_name: cleanFullName,
        role,
        organization_name: role !== 'STUDENT' ? cleanOrgName : undefined,
      });
      nav('/login', { state: { registeredEmail: cleanEmail } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-slate-900">Create your LMS account</h1>
        <p className="mt-1 text-sm text-slate-500">Jobs &amp; Career Management System</p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
          I am registering as:
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(['STUDENT', 'EMPLOYER', 'INSTITUTION'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-lg py-2 text-xs font-medium border ${
                role === r
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {r === 'STUDENT' ? 'Student' : r === 'EMPLOYER' ? 'Employer' : 'Institution'}
            </button>
          ))}
        </div>

        <label htmlFor="register-fullName" className="mt-4 block text-sm font-medium text-slate-700">
          Full Name
        </label>
        <input
          id="register-fullName"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="e.g. Aditi Sharma"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        {role !== 'STUDENT' && (
          <>
            <label htmlFor="register-orgName" className="mt-4 block text-sm font-medium text-slate-700">
              {role === 'EMPLOYER' ? 'Company / Organization Name' : 'Institution / College Name'}
            </label>
            <input
              id="register-orgName"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder={role === 'EMPLOYER' ? 'e.g. Acme Tech Solutions' : 'e.g. National Institute of Tech'}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </>
        )}

        <label htmlFor="register-email" className="mt-4 block text-sm font-medium text-slate-700">
          Email Address
        </label>
        <input
          id="register-email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="register-password" className="mt-4 block text-sm font-medium text-slate-700">
          Password
        </label>
        <div className="relative mt-1">
          <input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>

        <label htmlFor="register-confirmPassword" className="mt-4 block text-sm font-medium text-slate-700">
          Confirm Password
        </label>
        <input
          id="register-confirmPassword"
          type={showPassword ? 'text' : 'password'}
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Creating account…' : 'Register'}
        </button>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-800">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
