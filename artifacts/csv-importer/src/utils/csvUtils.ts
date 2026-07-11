import Papa from 'papaparse';
import type { ParsedCsvData, ProcessedRecord } from '@/types';
import { CRM_FIELD_LABELS, type CrmRecord } from '@/types';

// ── CSV Parser ─────────────────────────────────────────────────────────────

export function parseCsv(file: File): Promise<ParsedCsvData> {
  return new Promise((resolve, reject) => {
    // First pass: read only the raw header row (before PapaParse auto-renames
    // duplicates like "a","a" → "a","a_1") so we can detect true duplicates.
    Papa.parse<string[]>(file, {
      preview: 1,
      complete: (headerResult) => {
        const rawHeaders = headerResult.data[0] ?? [];
        const lower = rawHeaders.map((h) => h.trim().toLowerCase());
        const duplicateHeaders = [
          ...new Set(lower.filter((h, i) => h !== '' && lower.indexOf(h) !== i)),
        ];

        // Second pass: full parse with header:true for row data.
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const headers = results.meta.fields ?? [];
            const rows = results.data;
            const rowErrors = results.errors.map(
              (e) => `Row ${e.row != null ? e.row + 2 : '?'}: ${e.message}`,
            );
            resolve({
              headers,
              rows,
              previewRows: rows.slice(0, 10),
              totalRows: rows.length,
              filename: file.name,
              fileSize: file.size,
              delimiter: results.meta.delimiter,
              duplicateHeaders,
              rowErrors,
            });
          },
          error: (err) => reject(err),
        });
      },
      error: (err) => reject(err),
    });
  });
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ── Sample CSV download ────────────────────────────────────────────────────

const SAMPLE_HEADERS = [
  'name', 'email', 'mobile', 'company',
  'city', 'state', 'country', 'crm_status', 'data_source',
];

const SAMPLE_ROWS = [
  ['Rahul Sharma',  'rahul@example.com',  '9876543210', 'GrowEasy Realty',  'Bengaluru', 'Karnataka',   'India', 'GOOD_LEAD_FOLLOW_UP', 'leads_on_demand'],
  ['Priya Patel',   'priya@example.com',  '9123456789', 'Tech Solutions',   'Mumbai',    'Maharashtra', 'India', 'DID_NOT_CONNECT',     'meridian_tower'],
  ['Amit Kumar',    'amit@example.com',   '9988776655', 'Infosys Ltd',      'Pune',      'Maharashtra', 'India', 'BAD_LEAD',            'eden_park'],
  ['Sneha Reddy',   'sneha@example.com',  '9871234560', 'Wipro',            'Hyderabad', 'Telangana',   'India', 'SALE_DONE',           'varah_swamy'],
  ['Vikram Singh',  'vikram@example.com', '9765432100', 'Tata Consultancy', 'Chennai',   'Tamil Nadu',  'India', 'GOOD_LEAD_FOLLOW_UP', 'sarjapur_plots'],
];

export function downloadSampleCsv(): void {
  const csv = [SAMPLE_HEADERS, ...SAMPLE_ROWS].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'groweasy_sample.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Results export ─────────────────────────────────────────────────────────

const CRM_FIELD_KEYS = Object.keys(CRM_FIELD_LABELS) as (keyof CrmRecord)[];

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Exports processed results (status, reason, all 15 CRM fields) as a downloadable CSV. */
export function downloadResultsCsv(records: ProcessedRecord[], filename = 'groweasy_import_results.csv'): void {
  const headerRow = ['row', 'status', 'reason', ...CRM_FIELD_KEYS.map((f) => CRM_FIELD_LABELS[f])];
  const dataRows = records.map((r) => [
    String(r.rowIndex + 1),
    r.status,
    r.reason ?? '',
    ...CRM_FIELD_KEYS.map((f) => r.crm[f] ?? ''),
  ]);
  const csv = [headerRow, ...dataRows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
