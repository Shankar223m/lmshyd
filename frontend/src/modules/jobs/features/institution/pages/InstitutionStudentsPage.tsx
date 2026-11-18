import { PageHeader } from '../../../components/ui/PageHeader';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, apiDownload, type ApiResponse } from '../../../services/api';

type StudentRow = {
  id: string;
  full_name: string;
  email: string;
  program?: string;
  department?: string;
  batch?: string;
  placement_status: string;
};

type PreviewRow = {
  line: number;
  email: string;
  full_name?: string;
  program?: string;
  department?: string;
  batch?: string;
  errors: string[];
  valid: boolean;
};

type PreviewResult = {
  rows: PreviewRow[];
  valid_count: number;
  error_count: number;
  total_rows: number;
  valid_rows: Record<string, string>[];
};

export function InstitutionStudentsPage() {
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['inst-students', q],
    queryFn: () =>
      apiFetch<ApiResponse<StudentRow[]>>(`/institutions/me/students?q=${encodeURIComponent(q)}`),
  });

  const previewMutation = useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      apiFetch<ApiResponse<PreviewResult>>('/institutions/me/students/import/preview', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      }),
    onSuccess: (res) => {
      setPreview(res.data);
      setImportSummary(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      apiFetch<ApiResponse<{ created: number; skipped: { email: string; reason: string }[] }>>(
        '/institutions/me/students/import',
        {
          method: 'POST',
          body: JSON.stringify({ rows }),
        },
      ),
    onSuccess: (res) => {
      const skipped = res.data.skipped?.length || 0;
      setImportSummary(`Import complete: ${res.data.created} created, ${skipped} skipped.`);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ['inst-students'] });
    },
  });

  const students = data?.data || [];

  const parseCsv = (text: string): Record<string, string>[] => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2 || !lines[0]) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cols = line.split(',');
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = (cols[i] || '').trim();
      });
      return row;
    });
  };

  const handleCsvSelect = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setImportSummary('CSV is empty or missing data rows.');
      return;
    }
    previewMutation.mutate(rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student directory"
        description="Search roster members, review placement status, and import students via CSV."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => apiDownload('/institutions/me/students/csv-template', 'students_import_template.csv')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Download template
            </button>
            <label className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
              Upload CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleCsvSelect(e.target.files[0])}
              />
            </label>
          </div>
        }
      />

      {importSummary && <p className="text-sm text-emerald-700">{importSummary}</p>}
      {previewMutation.isError && (
        <p className="text-sm text-red-600">Could not preview CSV. Check columns and format.</p>
      )}

      {preview && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Import preview</h2>
            <p className="text-xs text-slate-600">
              {preview.valid_count} valid · {preview.error_count} with errors · {preview.total_rows} total rows
            </p>
          </div>
          <div className="max-h-64 overflow-auto border rounded-lg">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2">Line</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Program</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className="border-t">
                    <td className="px-2 py-1.5">{r.line}</td>
                    <td className="px-2 py-1.5">{r.email}</td>
                    <td className="px-2 py-1.5">{r.full_name}</td>
                    <td className="px-2 py-1.5">{r.program}</td>
                    <td className="px-2 py-1.5">
                      {r.valid ? (
                        <span className="text-emerald-700 font-semibold">Ready</span>
                      ) : (
                        <span className="text-red-700">{r.errors.join('; ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setPreview(null)} className="rounded border px-3 py-1.5 text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={preview.valid_count === 0 || importMutation.isPending}
              onClick={() => importMutation.mutate(preview.valid_rows)}
              className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {importMutation.isPending ? 'Importing…' : `Confirm import (${preview.valid_count} students)`}
            </button>
          </div>
        </div>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search students"
        className="w-full max-w-md rounded border px-3 py-2 text-sm"
      />
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Placement</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-slate-500">{s.email}</div>
                </td>
                <td className="px-4 py-3">{s.program}</td>
                <td className="px-4 py-3">{s.batch}</td>
                <td className="px-4 py-3">{s.placement_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
