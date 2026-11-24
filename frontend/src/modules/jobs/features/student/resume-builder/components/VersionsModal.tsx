import React, { useState, useEffect } from 'react';
import { ResumeDocument, ResumeVersion } from '../types';
import { resumeApi } from '../services/resumeApi';
import { trackingApi } from '../services/trackingApi';
import {
  X,
  Download,
  Share2,
  History,
  FileText,
  FileCode,
  Copy,
  Check,
  RotateCcw,
  Trash2,
} from 'lucide-react';

interface VersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  resume: ResumeDocument;
  onRestoreVersion?: (restoredResume: ResumeDocument) => void;
}

export const VersionsModal: React.FC<VersionsModalProps> = ({
  isOpen,
  onClose,
  resume,
  onRestoreVersion,
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'share' | 'versions'>('download');
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [versionNameInput, setVersionNameInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isShareActive, setIsShareActive] = useState(true);
  const [hideContactInfo, setHideContactInfo] = useState(false);
  const [shareExpiry, setShareExpiry] = useState('In 30 days');
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  const shareUrl = `${window.location.origin}/p/${resume._id.slice(0, 8)}`;

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, resume._id]);

  const loadVersions = async () => {
    try {
      setLoadingVersions(true);
      const data = await resumeApi.getVersions(resume._id);
      setVersions(data);
    } catch (err) {
      console.error('Failed to load resume versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleSaveCurrentVersion = async () => {
    try {
      setIsSavingVersion(true);
      const name = versionNameInput.trim() || `Version ${versions.length + 1} (${new Date().toLocaleDateString()})`;
      await resumeApi.createVersion(resume._id, name);
      setVersionNameInput('');
      await loadVersions();
    } catch (err) {
      console.error('Failed to save version:', err);
    } finally {
      setIsSavingVersion(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    try {
      const restored = await resumeApi.restoreVersion(resume._id, versionId);
      if (onRestoreVersion) {
        onRestoreVersion(restored);
      }
      onClose();
    } catch (err) {
      console.error('Failed to restore version:', err);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    try {
      await resumeApi.deleteVersion(resume._id, versionId);
      setVersions((prev) => prev.filter((v) => v._id !== versionId));
    } catch (err) {
      console.error('Failed to delete version:', err);
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingFormat('pdf');
      const filename = `${resume.resume_name.replace(/\s+/g, '_')}_Resume.pdf`;
      await resumeApi.downloadBackendPdf(resume._id, filename);
      await trackingApi.track('download_pdf', resume._id);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(resume, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${resume.resume_name.replace(/\s+/g, '_')}_data.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDownloadDocx = () => {
    // Generate formatted text document representation
    const textBlob = new Blob(
      [
        `${resume.personal_info.full_name}\n${resume.personal_info.professional_title}\n${resume.personal_info.email} | ${resume.personal_info.phone}\n\nSUMMARY\n${resume.professional_summary}\n\nEXPERIENCE\n` +
          resume.experience
            .map((e) => `${e.job_title} at ${e.company} (${e.start_date} - ${e.end_date})\n${e.responsibilities}`)
            .join('\n\n') +
          `\n\nEDUCATION\n` +
          resume.education
            .map((ed) => `${ed.degree} - ${ed.institution} (${ed.end_year})`)
            .join('\n') +
          `\n\nSKILLS\n` +
          resume.skills.map((s) => s.name).join(', '),
      ],
      { type: 'text/plain;charset=utf-8' }
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', URL.createObjectURL(textBlob));
    downloadAnchor.setAttribute('download', `${resume.resume_name.replace(/\s+/g, '_')}_Resume.txt`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0F3D]/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-[#0A0F3D]">{resume.resume_name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Download, share or go back to an earlier version</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Pills */}
        <div className="px-6 pt-4 border-b border-slate-100 flex gap-2">
          <button
            onClick={() => setActiveTab('download')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'download'
                ? 'bg-[#00552F] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
          <button
            onClick={() => setActiveTab('share')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'share'
                ? 'bg-[#00552F] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share link</span>
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'versions'
                ? 'bg-[#00552F] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Versions ({versions.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* TAB 1: DOWNLOAD */}
          {activeTab === 'download' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* PDF */}
              <div className="border-2 border-[#00663C] rounded-xl p-4 bg-white flex flex-col justify-between shadow-sm">
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF6EF] text-[#00552F] inline-block mb-2">
                    Recommended
                  </span>
                  <h4 className="text-sm font-bold text-[#0A0F3D]">PDF Document</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Best for applying. Typography and layout stay pixel-perfect on any device.
                  </p>
                </div>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingFormat === 'pdf'}
                  className="mt-4 w-full h-9 rounded-lg bg-[#00552F] hover:bg-[#00663C] text-white text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloadingFormat === 'pdf' ? 'Preparing PDF...' : 'Download PDF'}</span>
                </button>
              </div>

              {/* DOCX / TEXT */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col justify-between hover:border-slate-300 transition-all">
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 inline-block mb-2">
                    Editable Text
                  </span>
                  <h4 className="text-sm font-bold text-[#0A0F3D]">DOCX / Plain Text</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Formatted text file for employers or ATS systems requesting editable text.
                  </p>
                </div>
                <button
                  onClick={handleDownloadDocx}
                  className="mt-4 w-full h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download Text</span>
                </button>
              </div>

              {/* JSON */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col justify-between hover:border-slate-300 transition-all">
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 inline-block mb-2">
                    Data Standard
                  </span>
                  <h4 className="text-sm font-bold text-[#0A0F3D]">JSON Resume</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Full structured schema for developers, backups, and external platforms.
                  </p>
                </div>
                <button
                  onClick={handleDownloadJson}
                  className="mt-4 w-full h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Download JSON</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SHARE LINK */}
          {activeTab === 'share' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-[#0A0F3D]">Public share link</h4>
                  <p className="text-xs text-slate-500">
                    Anyone with this link can view your formatted resume online.
                  </p>
                </div>
                <button
                  onClick={() => setIsShareActive(!isShareActive)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center ${
                    isShareActive ? 'bg-[#00663C]' : 'bg-slate-300'
                  }`}
                  aria-label="Toggle share link"
                >
                  <span
                    className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      isShareActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {isShareActive && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 h-10 px-3 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-700 font-mono select-all focus:outline-none"
                    />
                    <button
                      onClick={handleCopyShareLink}
                      className="h-10 px-4 rounded-lg bg-[#00552F] hover:bg-[#00663C] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied!' : 'Copy link'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hideContactInfo}
                        onChange={(e) => setHideContactInfo(e.target.checked)}
                        className="rounded border-slate-300 text-[#00663C] focus:ring-0"
                      />
                      <span>Hide email and phone number for privacy</span>
                    </label>

                    <div className="flex items-center gap-2 justify-end text-slate-600">
                      <span>Expires:</span>
                      <select
                        value={shareExpiry}
                        onChange={(e) => setShareExpiry(e.target.value)}
                        className="h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-700"
                      >
                        <option>In 30 days</option>
                        <option>In 7 days</option>
                        <option>Never</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VERSIONS */}
          {activeTab === 'versions' && (
            <div className="space-y-4">
              {/* Snapshot Creator */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Snapshot name (e.g. Tailored for Nimbus Software)"
                  value={versionNameInput}
                  onChange={(e) => setVersionNameInput(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00663C]"
                />
                <button
                  onClick={handleSaveCurrentVersion}
                  disabled={isSavingVersion}
                  className="h-9 px-3.5 rounded-lg bg-[#00552F] hover:bg-[#00663C] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>{isSavingVersion ? 'Saving...' : 'Save snapshot'}</span>
                </button>
              </div>

              {/* Version History List */}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white overflow-hidden">
                {/* Current Live State Row */}
                <div className="p-3.5 flex items-center justify-between bg-slate-50/60">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF6EF] text-[#00552F]">
                      Current
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-[#0A0F3D]">Active Workspace Draft</h4>
                      <p className="text-[11px] text-slate-400">Currently being edited · autosaved</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#00552F]">Score {resume.ats_score}</span>
                  </div>
                </div>

                {/* Stored Snapshots */}
                {loadingVersions ? (
                  <div className="p-6 text-center text-xs text-slate-400">Loading saved versions...</div>
                ) : versions.length > 0 ? (
                  versions.map((ver) => (
                    <div key={ver._id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                          v
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">{ver.version_name}</h4>
                          <p className="text-[11px] text-slate-400">
                            {new Date(ver.created_at).toLocaleDateString()} at{' '}
                            {new Date(ver.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600 mr-2">Score {ver.score}</span>
                        <button
                          onClick={() => handleRestoreVersion(ver._id)}
                          className="px-2.5 py-1 rounded border border-slate-300 hover:border-[#00663C] hover:text-[#00552F] text-slate-700 text-[11px] font-semibold transition-colors flex items-center gap-1"
                          title="Restore this version"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => handleDeleteVersion(ver._id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete version"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No snapshots saved yet. Click "Save snapshot" above to freeze a version before making changes.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
