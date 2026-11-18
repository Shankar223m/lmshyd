import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../../services/api';

export function InstitutionProfilePage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['institution-org'],
    queryFn: () => authApi.getInstitutionOrg(),
  });
  const org = data?.data;

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.updateInstitutionOrg(body),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['institution-org'] });
    },
  });

  if (isLoading) return <p className="text-sm text-slate-500">Loading institution profile…</p>;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Institution profile</h1>
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
          ✓ Institution profile saved successfully.
        </div>
      )}

      {save.isError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          ⚠️ {save.error instanceof Error ? save.error.message : 'Failed to update institution profile'}
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
          <label htmlFor="inst-org-name" className="block text-xs font-semibold uppercase text-slate-600">
            Institution / College Name
          </label>
          <input
            id="inst-org-name"
            name="name"
            required
            defaultValue={org?.name || ''}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="e.g. National Institute of Technology"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="inst-org-website" className="block text-xs font-semibold uppercase text-slate-600">
              Official Website
            </label>
            <input
              id="inst-org-website"
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
              placeholder="https://nit.ac.in"
            />
          </div>
          <div>
            <label htmlFor="inst-contact-name" className="block text-xs font-semibold uppercase text-slate-600">
              Primary Administrative Contact
            </label>
            <input
              id="inst-contact-name"
              name="contact_name"
              defaultValue={org?.contact_name || ''}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Administrative Contact Name"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="inst-contact-email" className="block text-xs font-semibold uppercase text-slate-600">
              Administrative Email
            </label>
            <input
              id="inst-contact-email"
              name="contact_email"
              type="email"
              defaultValue={org?.contact_email || ''}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="admin@college.ac.in"
            />
          </div>
          <div>
            <label htmlFor="inst-placement-name" className="block text-xs font-semibold uppercase text-slate-600">
              Placement Cell Officer (TPO)
            </label>
            <input
              id="inst-placement-name"
              name="placement_contact_name"
              defaultValue={org?.placement_contact_name || ''}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Head of Placements Name"
            />
          </div>
        </div>

        <div>
          <label htmlFor="inst-placement-email" className="block text-xs font-semibold uppercase text-slate-600">
            Placement Cell Email
          </label>
          <input
            id="inst-placement-email"
            name="placement_contact_email"
            type="email"
            defaultValue={org?.placement_contact_email || ''}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="placements@college.ac.in"
          />
        </div>

        <div>
          <label htmlFor="inst-address" className="block text-xs font-semibold uppercase text-slate-600">
            Campus Address
          </label>
          <textarea
            id="inst-address"
            name="address"
            defaultValue={org?.address || ''}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Campus address, city, state, and pin code"
          />
        </div>

        <div>
          <label htmlFor="inst-description" className="block text-xs font-semibold uppercase text-slate-600">
            About Institution
          </label>
          <textarea
            id="inst-description"
            name="description"
            defaultValue={org?.description || ''}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Brief overview of the college, departments, and accreditations..."
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
    </div>
  );
}
