import React, { useState } from 'react';
import { ResumeDocument, ResumeStyling } from '../types';
import { ResumeTemplateRenderer, TEMPLATES } from '../templates';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Check,
  Printer,
  FileText,
  Sliders,
  History,
  Palette,
  Type,
} from 'lucide-react';
import { exportResumeToPdf } from '../utils/pdfExport';
import { resumeApi } from '../services/resumeApi';
import { VersionsModal } from './VersionsModal';

interface ResumePreviewProps {
  resume: ResumeDocument;
  onTemplateChange?: (templateId: string) => void;
  onStylingChange?: (styling: ResumeStyling) => void;
  onRestoreVersion?: (restored: ResumeDocument) => void;
}

const ACCENT_COLORS = [
  { name: 'Brand Purple', hex: '#635BFF' },
  { name: 'Forest Green', hex: '#16A37B' },
  { name: 'Deep Navy', hex: '#000670' },
  { name: 'Midnight', hex: '#1E1B4B' },
  { name: 'Crimson', hex: '#B91C1C' },
  { name: 'Slate', hex: '#334155' },
];

const FONTS = [
  'Plus Jakarta Sans',
  'Inter',
  'Roboto',
  'Merriweather',
];

export const ResumePreview: React.FC<ResumePreviewProps> = ({
  resume,
  onTemplateChange,
  onStylingChange,
  onRestoreVersion,
}) => {
  const [zoom, setZoom] = useState(100);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showVersionsModal, setShowVersionsModal] = useState(false);

  const styling: ResumeStyling = resume.styling || {
    font_family: 'Plus Jakarta Sans',
    font_size: 'md',
    line_spacing: 1.3,
    margins: 'normal',
    accent_color: '#635BFF',
    section_spacing: 'normal',
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 140));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 60));

  const updateStyling = (patch: Partial<ResumeStyling>) => {
    const updated = { ...styling, ...patch };
    onStylingChange?.(updated);
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    const fullName = resume.personal_info?.full_name || 'Resume';
    const targetRole = resume.target_role || 'Professional';
    const cleanFileName = `${fullName.replace(/\s+/g, '_')}_${targetRole.replace(/\s+/g, '_')}_Resume.pdf`;

    try {
      await resumeApi.downloadBackendPdf(resume._id, cleanFileName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.warn('Backend PDF endpoint error, using client-side export fallback:', err);
      await exportResumeToPdf('resume-document-sheet', cleanFileName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDirectPrint = () => {
    window.print();
  };

  return (
    <div className="resume-preview-container flex-1 flex flex-col h-full min-h-0 w-full bg-[#F6F9F8] border-l border-[#E5E7EB] overflow-hidden relative">
      {/* Top Toolbar */}
      <div className="no-print h-14 px-4 bg-white border-b border-[#E5E7EB] flex items-center justify-between gap-2 shrink-0 z-10">
        {/* Template Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs font-semibold text-[#64748B] mr-1 hidden lg:inline">Template:</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onTemplateChange?.(t.id)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                resume.template_id === t.id
                  ? 'bg-[#635BFF] text-white shadow-sm'
                  : 'bg-[#F6F9F8] hover:bg-[#F5F3FF] text-[#111827] border border-[#E5E7EB]'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Style Controls Toggle */}
          <button
            onClick={() => setShowStylePanel(!showStylePanel)}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors ${
              showStylePanel
                ? 'bg-[#635BFF] text-white border-[#635BFF]'
                : 'border-[#E5E7EB] text-[#111827] hover:bg-[#F5F3FF]'
            }`}
            title="Customize fonts, colors and spacing"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Style</span>
          </button>

          {/* Version History Modal Trigger */}
          <button
            onClick={() => setShowVersionsModal(true)}
            className="p-2 rounded-lg border border-[#E5E7EB] text-xs font-medium text-[#111827] hover:bg-[#F5F3FF] flex items-center gap-1 transition-colors"
            title="Download, share or manage versions"
          >
            <History className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="hidden xl:inline">Export & Versions</span>
          </button>

          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-[#F6F9F8] rounded-lg p-0.5 border border-[#E5E7EB] text-xs">
            <button
              onClick={handleZoomOut}
              className="p-1 text-[#64748B] hover:text-[#111827] rounded hover:bg-white"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-medium text-[#111827] min-w-[42px] text-center">{zoom}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-[#64748B] hover:text-[#111827] rounded hover:bg-white"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen button */}
          <button
            onClick={() => setIsFullScreen(true)}
            className="p-2 text-[#64748B] hover:text-[#111827] rounded-lg hover:bg-[#F5F3FF] border border-[#E5E7EB]"
            title="Full screen preview"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Browser print */}
          <button
            onClick={handleDirectPrint}
            className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F5F3FF] text-[#111827] text-xs font-medium"
            title="Browser print"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          {/* Download PDF button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#635BFF] hover:bg-[#5046E5] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Downloaded!</span>
              </>
            ) : isDownloading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Style & Layout Customizer Bar */}
      {showStylePanel && (
        <div className="no-print bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-4 text-xs animate-in slide-in-from-top-2 duration-150 z-10 shadow-sm">
          {/* Font Family */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <Type className="w-3.5 h-3.5" /> Font:
            </span>
            <select
              value={styling.font_family}
              onChange={(e) => updateStyling({ font_family: e.target.value })}
              className="h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
            >
              {FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Size:</span>
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
              {(['sm', 'md', 'lg'] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => updateStyling({ font_size: sz })}
                  className={`px-2.5 py-1 text-xs font-medium uppercase ${
                    styling.font_size === sz
                      ? 'bg-[#635BFF] text-white font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Margins */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Margins:</span>
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
              {(['compact', 'normal', 'spacious'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => updateStyling({ margins: m })}
                  className={`px-2 py-1 text-xs font-medium capitalize ${
                    styling.margins === m
                      ? 'bg-[#635BFF] text-white font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color Palette */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5" /> Accent:
            </span>
            <div className="flex items-center gap-1.5">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.hex}
                  onClick={() => updateStyling({ accent_color: color.hex })}
                  style={{ backgroundColor: color.hex }}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    styling.accent_color === color.hex ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : 'hover:scale-105'
                  }`}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview Canvas Area */}
      <div className="resume-canvas-area flex-1 min-h-0 overflow-auto p-4 sm:p-6 flex justify-center items-start bg-[#F6F8F7]">
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          className="resume-scale-wrapper transition-transform duration-150"
        >
          {/* A4 Sheet Container */}
          <div
            id="resume-document-sheet"
            className="resume-a4-sheet resume-print-page w-[210mm] min-h-[297mm] bg-white shadow-2xl rounded-sm overflow-hidden border border-[#E5E7EB]"
          >
            <ResumeTemplateRenderer resume={resume} />
          </div>
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {isFullScreen && (
        <div className="no-print fixed inset-0 z-50 bg-[#111827]/95 backdrop-blur-md flex flex-col">
          <div className="h-14 px-6 bg-[#111827] border-b border-slate-800 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#635BFF]" />
              <span className="font-semibold text-sm">{resume.resume_name} – Live Preview</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#635BFF] hover:bg-[#5046E5] text-white text-xs font-semibold"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => setIsFullScreen(false)}
                className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 text-xs font-medium"
              >
                Close Fullscreen
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-8 flex justify-center">
            <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl">
              <ResumeTemplateRenderer resume={resume} />
            </div>
          </div>
        </div>
      )}

      {/* Versions & Export Modal */}
      <VersionsModal
        isOpen={showVersionsModal}
        onClose={() => setShowVersionsModal(false)}
        resume={resume}
        onRestoreVersion={onRestoreVersion}
      />
    </div>
  );
};
