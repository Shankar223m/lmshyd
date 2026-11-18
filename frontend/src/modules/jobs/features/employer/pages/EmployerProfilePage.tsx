import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../../services/api';

const SIZE_BANDS = [
  { value: '1-10', label: '1 - 10 employees (Startup)' },
  { value: '11-50', label: '11 - 50 employees (Small)' },
  { value: '51-200', label: '51 - 200 employees (Mid-sized)' },
  { value: '201-500', label: '201 - 500 employees (Growing)' },
  { value: '501-1000', label: '501 - 1,000 employees (Large)' },
  { value: '1000+', label: '1,000+ employees (Enterprise)' },
];

export function EmployerProfilePage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [recruiterName, setRecruiterName] = useState('');
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [recruiterPassword, setRecruiterPassword] = useState('');
  const [recruiterError, setRecruiterError] = useState('');
  const [recruiterSuccess, setRecruiterSuccess] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['employer-org'], queryFn: () => authApi.getEmployerOrg() });
  const org = data?.data;

  const { data: recruitersData } = useQuery({
    queryKey: ['my-recruiters'],
    queryFn: () => authApi.listRecruiters(),
  });
  const recruiters = recruitersData?.data || [];

  const addRecruiterMutation = useMutation({
    mutationFn: (body: { email: string; full_name: string; password?: string }) => authApi.addRecruiter(body),
    onSuccess: () => {
      setRecruiterSuccess('Recruiter added successfully.');
      setRecruiterError('');
      setRecruiterName('');
      setRecruiterEmail('');
      setRecruiterPassword('');
      qc.invalidateQueries({ queryKey: ['my-recruiters'] });
    },
    onError: (err: Error) => {
      setRecruiterError(err.message || 'Failed to add recruiter');
      setRecruiterSuccess('');
    },
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.updateEmployerOrg(body),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['employer-org'] });
    },
  });

  if (isLoading) return <p className="text-sm text-slate-500">Loading company profile…</p>;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Company profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Verification Status:{' '}
          <span
            className={`font-semibold uppercase text-xs px-2 py-0.5 rounded-full ${
              org?.verification_status === 'VERIFIED'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {org?.verification_status || 'PENDING'}
          </span>
        </p>
      </div>

      {(saved || save.isSuccess) && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-200">
          ✓ Organization profile saved successfully.
        </div>
      )}

      {save.isError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          ⚠️ {save.error instanceof Error ? save.error.message : 'Failed to update organization profile'}
        </div>
      )}

      <form
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          const fd = new FormData(e.currentTarget);
          save.mutate(Object.fromEntries(fd.entries()));
        }}
      >
        <div>
          <label htmlFor="emp-org-name" className="block text-xs font-semibold uppercase text-slate-600">
            Company / Organization Name
          </label>
          <input
            id="emp-org-name"
            name="name"
            required
            defaultValue={org?.name || ''}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="e.g. Acme Tech Solutions"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="emp-org-website" className="block text-xs font-semibold uppercase text-slate-600">
              Official Website
            </label>
            <input
              id="emp-org-website"
              name="website"
              type="url"
              defaultValue={
                org?.website
                  ? org.website.startsWith('http://') || org.website.startsWith('https://')
                    ? org.website
                    : `https://${org.website}`
                  : ''
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label htmlFor="emp-org-industry" className="block text-xs font-semibold uppercase text-slate-600">
              Industry Domain
            </label>
            <input
              id="emp-org-industry"
              name="industry"
              defaultValue={org?.industry || ''}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="e.g. Information Technology"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="emp-contact-name" className="block text-xs font-semibold uppercase text-slate-600">
              Primary Contact Person
            </label>
            <input
              id="emp-contact-name"
              name="contact_name"
              defaultValue={org?.contact_name || ''}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Contact Person Name"
            />
          </div>
          <div>
            <label htmlFor="emp-contact-email" className="block text-xs font-semibold uppercase text-slate-600">
              Contact Email
            </label>
            <input
              id="emp-contact-email"
              name="contact_email"
              type="email"
              defaultValue={org?.contact_email || ''}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="hiring@example.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="emp-size-band" className="block text-xs font-semibold uppercase text-slate-600">
              Company Size Band
            </label>
            <select
              id="emp-size-band"
              name="size_band"
              defaultValue={org?.size_band || '51-200'}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {SIZE_BANDS.map((sb) => (
                <option key={sb.value} value={sb.value}>
                  {sb.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="emp-reg-number" className="block text-xs font-semibold uppercase text-slate-600">
              Registration / CIN Number
            </label>
            <input
              id="emp-reg-number"
              name="registration_number"
              defaultValue={org?.registration_number || ''}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="e.g. U72200KA2020PTC123456"
            />
          </div>
        </div>

        <div>
          <label htmlFor="emp-description" className="block text-xs font-semibold uppercase text-slate-600">
            About Company
          </label>
          <textarea
            id="emp-description"
            name="description"
            defaultValue={org?.description || ''}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Brief description of the organization and workplace culture..."
          />
        </div>

        <div>
          <label htmlFor="emp-address" className="block text-xs font-semibold uppercase text-slate-600">
            Registered Office Address
          </label>
          <textarea
            id="emp-address"
            name="address"
            defaultValue={org?.address || ''}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Full physical address, city, and state"
          />
        </div>

        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-xs"
        >
          {save.isPending ? 'Saving profile…' : 'Save profile'}
        </button>
      </form>

      {/* Hiring Team & Recruiter Roster */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Hiring Team &amp; Recruiters</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage recruiter accounts authorized to screen candidates and conduct interviews for your organization.
          </p>
        </div>

        {recruiterSuccess && (
          <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
            ✓ {recruiterSuccess}
          </div>
        )}

        {recruiterError && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            ⚠️ {recruiterError}
          </div>
        )}

        {/* Existing Recruiters List */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-slate-500">Active Recruiters ({recruiters.length})</div>
          {recruiters.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              No recruiters registered yet. Add your first recruiter below.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/50">
              {recruiters.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 text-[10px]">
                      {r.full_name
                        .split(' ')
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{r.full_name}</div>
                      <div className="text-slate-500">{r.email}</div>
                    </div>
                  </div>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Recruiter Form */}
        <form
          className="border-t border-slate-100 pt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!recruiterEmail || !recruiterName || !recruiterPassword) {
              setRecruiterError('Please fill all required recruiter fields.');
              return;
            }
            addRecruiterMutation.mutate({
              email: recruiterEmail.trim(),
              full_name: recruiterName.trim(),
              password: recruiterPassword,
            });
          }}
        >
          <div className="text-xs font-bold text-slate-800">Add New Recruiter</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="rec-fullname" className="block text-[11px] font-semibold text-slate-600">
                Full Name *
              </label>
              <input
                id="rec-fullname"
                type="text"
                required
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
                placeholder="Recruiter Name"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="rec-email" className="block text-[11px] font-semibold text-slate-600">
                Email Address *
              </label>
              <input
                id="rec-email"
                type="email"
                required
                value={recruiterEmail}
                onChange={(e) => setRecruiterEmail(e.target.value)}
                placeholder="recruiter@example.com"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="rec-password" className="block text-[11px] font-semibold text-slate-600">
                Temporary Password *
              </label>
              <input
                id="rec-password"
                type="password"
                required
                value={recruiterPassword}
                onChange={(e) => setRecruiterPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addRecruiterMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {addRecruiterMutation.isPending ? 'Adding Recruiter…' : '+ Add Recruiter'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
