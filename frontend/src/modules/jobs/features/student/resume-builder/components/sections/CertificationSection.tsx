import React, { useState } from 'react';
import { Certification } from '../../types';
import { Plus, Trash2, ShieldCheck, DownloadCloud, Check } from 'lucide-react';
import { aiApi } from '../../services/aiApi';

interface Props {
  certifications: Certification[];
  onChange: (updated: Certification[]) => void;
}

export const CertificationSection: React.FC<Props> = ({ certifications = [], onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lmsModalOpen, setLmsModalOpen] = useState(false);
  const [lmsCerts, setLmsCerts] = useState<any[]>([]);
  const [loadingLms, setLoadingLms] = useState(false);

  const handleAdd = () => {
    const newCert: Certification = {
      id: 'cert_' + Date.now(),
      name: '',
      issuing_organization: '',
      issue_date: '',
      expiration_date: '',
      credential_id: '',
      credential_url: '',
      skills_learned: [],
    };
    onChange([newCert, ...certifications]);
    setEditingId(newCert.id);
  };

  const handleUpdate = (id: string, field: keyof Certification, val: any) => {
    onChange(certifications.map((c) => (c.id === id ? { ...c, [field]: val } : c)));
  };

  const handleDelete = (id: string) => {
    onChange(certifications.filter((c) => c.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleOpenLms = async () => {
    setLoadingLms(true);
    setLmsModalOpen(true);
    try {
      const certs = await aiApi.getLmsCertificates();
      setLmsCerts(certs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLms(false);
    }
  };

  const handleImportLmsCert = (lmsCert: any) => {
    const imported: Certification = {
      id: 'cert_lms_' + Date.now(),
      name: lmsCert.name,
      issuing_organization: lmsCert.issuing_organization,
      issue_date: lmsCert.issue_date,
      expiration_date: lmsCert.expiration_date || '',
      credential_id: lmsCert.credential_id,
      credential_url: lmsCert.credential_url,
      skills_learned: lmsCert.skills_learned || [],
      lms_imported: true,
    };
    onChange([...certifications, imported]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Certifications</h3>
          <p className="text-xs text-slate-500">Industry credentials, cloud certifications, and platform badges.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenLms}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#5046E5] border border-[#635BFF]/30 rounded-xl transition-colors"
          >
            <DownloadCloud className="w-3.5 h-3.5 text-[#635BFF]" />
            <span>Import From LMS</span>
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Certification</span>
          </button>
        </div>
      </div>

      {certifications.length === 0 ? (
        <div className="p-6 text-center border-2 border-dashed border-[#E5E7EB] rounded-2xl bg-white">
          <p className="text-xs text-[#64748B]">No certifications added yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {certifications.map((cert) => {
            const isEditing = editingId === cert.id;
            return (
              <div key={cert.id} className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
                <div
                  onClick={() => setEditingId(isEditing ? null : cert.id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer bg-slate-50/50 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#16A37B]" />
                    <div>
                      <h4 className="font-semibold text-xs text-slate-900">
                        {cert.name || 'Certificate Name'} {cert.issuing_organization && `– ${cert.issuing_organization}`}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {cert.issue_date || 'Date'} {cert.credential_id && `• ID: ${cert.credential_id}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(cert.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {isEditing && (
                  <div className="p-4 border-t border-slate-200 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Certification Title <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={cert.name}
                          onChange={(e) => handleUpdate(cert.id, 'name', e.target.value)}
                          placeholder="e.g. AWS Certified Solutions Architect"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Issuing Organization</label>
                        <input
                          type="text"
                          value={cert.issuing_organization}
                          onChange={(e) => handleUpdate(cert.id, 'issuing_organization', e.target.value)}
                          placeholder="e.g. Amazon Web Services / Coursera"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Issue Date</label>
                        <input
                          type="text"
                          value={cert.issue_date}
                          onChange={(e) => handleUpdate(cert.id, 'issue_date', e.target.value)}
                          placeholder="Nov 2024"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Credential ID</label>
                        <input
                          type="text"
                          value={cert.credential_id}
                          onChange={(e) => handleUpdate(cert.id, 'credential_id', e.target.value)}
                          placeholder="AWS-SAA-109282"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#111827] mb-1">Verification URL</label>
                      <input
                        type="url"
                        value={cert.credential_url}
                        onChange={(e) => handleUpdate(cert.id, 'credential_url', e.target.value)}
                        placeholder="https://credly.com/verify/..."
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E5E7EB] focus:border-[#635BFF] outline-none text-[#111827]"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 px-3 py-1 bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* LMS Integration Dialog */}
      {lmsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#E5E7EB] p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#E5E7EB] pb-3">
              <div className="flex items-center gap-2">
                <DownloadCloud className="w-5 h-5 text-[#635BFF]" />
                <h3 className="font-bold text-sm text-[#111827]">Learning Platform Verified Certificates</h3>
              </div>
              <button onClick={() => setLmsModalOpen(false)} className="text-[#64748B] hover:text-[#111827]">✕</button>
            </div>

            <p className="text-[#64748B]">
              Future integration point: Verified certificates achieved in course exams can be imported here with one click.
            </p>

            {loadingLms ? (
              <div className="text-center py-6 text-[#64748B]">Loading platform certificates...</div>
            ) : (
              <div className="space-y-2.5">
                {lmsCerts.map((lc) => (
                  <div key={lc.id} className="p-3 border border-[#E5E7EB] rounded-xl flex items-center justify-between hover:border-[#635BFF]/40 transition-colors bg-white">
                    <div>
                      <div className="font-bold text-[#111827]">{lc.name}</div>
                      <div className="text-[11px] text-[#64748B]">{lc.issuing_organization} • {lc.issue_date}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleImportLmsCert(lc);
                        setLmsModalOpen(false);
                      }}
                      className="px-3 py-1 bg-[#635BFF] hover:bg-[#5046E5] text-white rounded-lg font-semibold text-[11px] shadow-sm transition-colors"
                    >
                      Import
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setLmsModalOpen(false)}
                className="px-4 py-1.5 bg-[#F6F9F8] hover:bg-[#F5F3FF] text-[#111827] border border-[#E5E7EB] rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
