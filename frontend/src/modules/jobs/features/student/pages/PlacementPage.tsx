import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch, filesApi, type ApiResponse } from '../../../services/api';

type PlacementRecord = {
  id: string;
  status: string;
  company_name?: string;
  designation?: string;
  joining_date?: string;
  annual_package?: number;
  work_location?: string;
  evidence_file_id?: string;
  evidence_documents?: Array<{ id: string; file_id: string; category: string; status: string }>;
  verifier_comment?: string;
  placement_officer?: {
    name: string;
    email: string;
    institution_name?: string;
  };
};

export function PlacementPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-placement'],
    queryFn: () => apiFetch<ApiResponse<PlacementRecord | null>>('/placements/me'),
  });

  const placement = data?.data;

  const [designation, setDesignation] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [annualPackage, setAnnualPackage] = useState<number | ''>('');
  const [workLocation, setWorkLocation] = useState('');
  const [evidenceFileId, setEvidenceFileId] = useState<string | null>(null);
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (placement) {
      if (placement.designation) setDesignation(placement.designation);
      if (placement.joining_date) setJoiningDate(placement.joining_date);
      if (placement.annual_package) setAnnualPackage(placement.annual_package);
      if (placement.work_location) setWorkLocation(placement.work_location);
      if (placement.evidence_file_id) setEvidenceFileId(placement.evidence_file_id);
    }
  }, [placement]);

  const submitMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/placements/${placement?.id}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          designation,
          joining_date: joiningDate || undefined,
          annual_package: annualPackage ? Number(annualPackage) : undefined,
          work_location: workLocation,
          evidence_file_id: evidenceFileId || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-placement'] });
      setSuccessMsg('Placement details and evidence submitted for institution verification.');
      setErrorMsg('');
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setSuccessMsg('');
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = e.target.files?.[0];
    if (!file || !placement) return;
    setUploading(true);
    try {
      const res = await filesApi.upload(file, 'placement_evidence');
      setEvidenceFileId(res.data.id);
      setEvidenceFileName(res.data.original_name);
      await apiFetch(`/placements/${placement.id}/evidence/documents`, {
        method: 'POST',
        body: JSON.stringify({ file_id: res.data.id, category }),
      });
      qc.invalidateQueries({ queryKey: ['my-placement'] });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500 flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mr-2" />
        Loading placement records…
      </div>
    );
  }

  if (!placement) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-4">
        <div className="text-3xl">📋</div>
        <h2 className="text-lg font-bold text-slate-900">No Placement In Progress</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          You need an accepted job offer to initialize your formal campus placement evidence and verification record.
        </p>
        <Link
          to="/jobs/student/offers"
          className="inline-block rounded-xl bg-[#7DC8F7] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#5CB8EC]"
        >
          View Offers →
        </Link>
      </div>
    );
  }

  const steps = [
    { label: 'Offer Accepted', done: true },
    { label: 'Your Details', done: placement.status !== 'PENDING_DETAILS' },
    { label: 'Institution Check', done: placement.status === 'VERIFIED' },
    { label: 'Verified', done: placement.status === 'VERIFIED' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Placement</h1>
        <p className="text-sm text-slate-500">Record accepted employment details and upload signed offer letter for verification.</p>
      </div>

      {/* Stepper matching PDF Screen 12 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {steps.map((st, idx) => (
            <div key={st.label} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                    st.done
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-50 text-indigo-700 border-2 border-indigo-600'
                  }`}
                >
                  {st.done ? '✓' : idx + 1}
                </div>
                <span className="mt-1 text-xs font-semibold text-slate-800">{st.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 w-12 sm:w-24 ${
                    steps[idx + 1]?.done ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
          ✓ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Form (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Employment Evidence Form</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                placement.status === 'VERIFIED'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : placement.status === 'PENDING_VERIFICATION'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {placement.status.replace('_', ' ')}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600">Company / Organization</label>
            <input
              disabled
              value={placement.company_name || 'Accepted Employer'}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600">Designation / Role Title *</label>
              <input
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600">Work Location</label>
              <input
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="placement-annual-package" className="block text-xs font-semibold uppercase text-slate-600">Annual Gross Compensation (₹)</label>
              <input
                id="placement-annual-package"
                type="number"
                min={0}
                value={annualPackage}
                onChange={(e) => setAnnualPackage(e.target.value ? Number(e.target.value) : '')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600">Actual Date of Joining</label>
              <input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <label className="block text-xs font-semibold uppercase text-slate-600">
              Offer letter (PDF)
            </label>
            <input type="file" accept=".pdf" disabled={uploading} onChange={(e) => handleFileUpload(e, 'OFFER_LETTER')} className="text-xs" />
            {evidenceFileName && (
              <p className="text-xs text-emerald-700">Last upload: {evidenceFileName}</p>
            )}
            {uploading && <p className="text-xs text-slate-500">Uploading…</p>}
            {placement.evidence_documents && placement.evidence_documents.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {placement.evidence_documents.map((d) => (
                  <li key={d.id}>
                    {d.category.replace(/_/g, ' ')} — {d.status}
                  </li>
                ))}
              </ul>
            )}
            <label className="block text-xs font-semibold uppercase text-slate-600 mt-3">
              Joining confirmation / other evidence
            </label>
            <input type="file" accept=".pdf,.png,.jpg" onChange={(e) => handleFileUpload(e, 'JOINING_PROOF')} className="text-xs" />
          </div>

          {placement.verifier_comment && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              <span className="font-bold">Institution Officer Remarks:</span>
              <p>{placement.verifier_comment}</p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              disabled={submitMutation.isPending || placement.status === 'VERIFIED'}
              onClick={() => submitMutation.mutate()}
              className="w-full rounded-xl bg-[#7DC8F7] py-2.5 text-xs font-semibold text-white hover:bg-[#5CB8EC] disabled:opacity-50 transition shadow-xs"
            >
              {submitMutation.isPending
                ? 'Submitting…'
                : placement.status === 'VERIFIED'
                ? 'Placement Officially Verified'
                : 'Submit Evidence for Verification'}
            </button>
          </div>
        </div>

        {/* Verifier Card & Info (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Authorized Verifier</div>
              <h3 className="text-base font-bold text-slate-900 mt-1">Institution Placement Cell</h3>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-xs">
              <div className="font-bold text-slate-800">
                {placement.placement_officer?.name || 'Dr. Priya Raman'}
              </div>
              <div className="text-slate-500">
                Head of Career &amp; Placements · {placement.placement_officer?.institution_name || 'Sri Venkateswara Institute'}
              </div>
              <div className="text-[11px] text-slate-400">
                Contact: {placement.placement_officer?.email || 'placement@institution.example'}
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-2">
              <div className="font-semibold text-slate-700">Verification Process:</div>
              <p>
                Once submitted, your college placement officer cross-verifies compensation, joining date, and corporate credentials against the uploaded signed letter before certifying your official placement record.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
