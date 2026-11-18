import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, filesApi, type ApiResponse } from '../../../services/api';

type CandidateOption = {
  id: string;
  student_name?: string;
  job_title?: string;
  status: string;
};

export function CreateOfferPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialAppId = params.get('applicationId') || '';

  const [selectedAppId, setSelectedAppId] = useState(initialAppId);
  const [roleTitle, setRoleTitle] = useState('Frontend Engineer');
  const [location, setLocation] = useState('Bengaluru, Karnataka');
  const [annualPackage, setAnnualPackage] = useState(1100000);
  const [joiningDate, setJoiningDate] = useState('2026-12-01');
  const [respondBy, setRespondBy] = useState('2026-11-20');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [offerFileId, setOfferFileId] = useState<string | null>(null);
  const [offerFileName, setOfferFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Fetch available applicants to populate selector if not passed via param
  const { data: candidatesData } = useQuery({
    queryKey: ['recruiter-queue'],
    queryFn: () => apiFetch<ApiResponse<CandidateOption[]>>('/jobs/recruiter/applications'),
  });
  const candidates = candidatesData?.data || [];
  const activeAppId = selectedAppId || candidates[0]?.id || '';

  const createOfferMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/applications/${activeAppId}/offers`, {
        method: 'POST',
        body: JSON.stringify({
          role_title: roleTitle.trim(),
          location: location.trim(),
          annual_package: Number(annualPackage),
          joining_date: joiningDate || undefined,
          respond_by: respondBy || undefined,
          requires_approval: requiresApproval,
          offer_letter_file_id: offerFileId || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employer-jobs'] });
      qc.invalidateQueries({ queryKey: ['pipeline'] });
      nav('/jobs/employer/jobs');
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await filesApi.upload(file, 'offers');
      setOfferFileId(res.data.id);
      setOfferFileName(res.data.original_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!activeAppId) {
      setError('Please select an active candidate application.');
      return;
    }

    if (annualPackage < 0) {
      setError('Annual gross compensation cannot be negative.');
      return;
    }

    if (respondBy && joiningDate && new Date(respondBy) > new Date(joiningDate)) {
      setError('Decision respond-by date cannot be after the tentative joining date.');
      return;
    }

    createOfferMutation.mutate();
  };

  const selectedCandidate = candidates.find((c) => c.id === activeAppId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Prepare Job Offer</h1>
        <p className="text-sm text-slate-500">Draft compensation, terms, and route for leadership approval before delivery.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          ⚠️ {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Form (7 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Offer Package Details</h2>
          </div>

          <div>
            <label htmlFor="offer-candidate" className="block text-xs font-semibold uppercase text-slate-600">Candidate *</label>
            <select
              id="offer-candidate"
              value={activeAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none"
            >
              {candidates.length === 0 ? (
                <option value="">No candidate queue available</option>
              ) : (
                candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.student_name} — {c.job_title} ({c.status})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="offer-role-title" className="block text-xs font-semibold uppercase text-slate-600">Designation / Role Title *</label>
              <input
                id="offer-role-title"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="offer-location" className="block text-xs font-semibold uppercase text-slate-600">Work Location</label>
              <input
                id="offer-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="offer-package" className="block text-xs font-semibold uppercase text-slate-600">Annual Gross Compensation (₹ INR) *</label>
            <input
              id="offer-package"
              type="number"
              step={50000}
              min={0}
              required
              value={annualPackage}
              onChange={(e) => setAnnualPackage(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-400">Equivalent to ₹{(annualPackage / 100000).toFixed(2)} LPA</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="offer-joining-date" className="block text-xs font-semibold uppercase text-slate-600">Tentative Joining Date</label>
              <input
                id="offer-joining-date"
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="offer-respond-by" className="block text-xs font-semibold uppercase text-slate-600">Decision Respond-By Date</label>
              <input
                id="offer-respond-by"
                type="date"
                value={respondBy}
                onChange={(e) => setRespondBy(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="reqApp"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="reqApp" className="text-xs font-medium text-slate-700">
                Require secondary leadership approval before issuing to candidate
              </label>
            </div>

            <div>
              <label htmlFor="offer-file-upload" className="block text-xs font-semibold uppercase text-slate-600">Official Offer Letter Document (PDF)</label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  id="offer-file-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                />
                {uploading && <span className="text-xs text-indigo-600">Uploading…</span>}
                {offerFileName && <span className="text-xs text-emerald-700 font-semibold">✓ {offerFileName}</span>}
              </div>
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={createOfferMutation.isPending || !activeAppId}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-xs"
            >
              {createOfferMutation.isPending
                ? 'Processing…'
                : requiresApproval
                ? 'Submit Offer for Internal Approval'
                : 'Directly Issue Offer to Student'}
            </button>
          </div>
        </form>

        {/* Offer Preview Card (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Offer Letter Preview</div>
              <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Version 1.0</span>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3 text-xs">
              <div className="font-bold text-slate-900 text-sm">{selectedCandidate?.student_name || 'Candidate Name'}</div>
              <p className="text-slate-600">
                We are pleased to offer you the position of <span className="font-semibold text-slate-900">{roleTitle}</span> at our {location} facility.
              </p>

              <div className="rounded-lg bg-white p-3 border border-slate-200 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Cost to Company (CTC)</div>
                <div className="text-xl font-extrabold text-emerald-700 mt-0.5">₹{(annualPackage / 100000).toFixed(2)} LPA</div>
                <div className="text-[10px] text-slate-500 mt-0.5">₹{(annualPackage / 12).toFixed(0)} / month gross</div>
              </div>

              <div className="divide-y divide-slate-100 pt-1 text-[11px]">
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-500">Date of Joining:</span>
                  <span className="font-semibold text-slate-800">{joiningDate || 'TBD'}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-500">Acceptance Deadline:</span>
                  <span className="font-semibold text-slate-800">{respondBy || 'TBD'}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-500">Approval Workflow:</span>
                  <span className="font-semibold text-indigo-600">{requiresApproval ? 'Department Head → HR' : 'Pre-approved'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
