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

// ── Sample CSV downloads ────────────────────────────────────────────────────
//
// Three samples, deliberately different in size and shape, so a reviewer (or
// anyone testing the importer) can exercise the pipeline's actual edge cases
// rather than just the happy path:
//   1. quick-start   — tiny, clean, comma-delimited, CRM-shaped headers.
//   2. messy-export  — medium, semicolon-delimited, mismatched header names
//                       (simulating a different CRM's export), multiple
//                       emails/phones per cell, quoted multi-line notes,
//                       free-text statuses, and name-only rows that should
//                       be skipped.
//   3. large-batch   — 300 rows, comma-delimited, to exercise batching
//                       (12 batches of 25) and table performance at scale.

export type SampleCsvId = 'quick-start' | 'messy-export' | 'large-batch';

export interface SampleCsvInfo {
  id: SampleCsvId;
  label: string;
  description: string;
  meta: string;
  filename: string;
}

export const SAMPLE_CSVS: SampleCsvInfo[] = [
  {
    id: 'quick-start',
    label: 'Quick Start',
    description: 'Clean, ready-to-import data with CRM-matching headers.',
    meta: '6 rows · ~0.4 KB · comma-delimited',
    filename: 'groweasy_sample_quick_start.csv',
  },
  {
    id: 'messy-export',
    label: 'Messy Real-World Export',
    description: 'Different header names, multiple emails/phones per row, quoted multi-line notes, and rows that should be skipped.',
    meta: '18 rows · ~2 KB · semicolon-delimited',
    filename: 'groweasy_sample_messy_export.csv',
  },
  {
    id: 'large-batch',
    label: 'Large Batch',
    description: 'Stress-tests AI batching (25 rows/batch) and the results table at scale.',
    meta: '300 rows · ~25 KB · comma-delimited',
    filename: 'groweasy_sample_large_batch.csv',
  },
];

function csvEscape(value: string, delimiter: string): string {
  const needsQuoting = value.includes(delimiter) || value.includes('"') || value.includes('\n');
  return needsQuoting ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(headers: string[], rows: string[][], delimiter: string): string {
  return [headers, ...rows]
    .map((row) => row.map((cell) => csvEscape(cell, delimiter)).join(delimiter))
    .join('\n');
}

function buildQuickStart(): string {
  const headers = ['name', 'email', 'mobile', 'company', 'city', 'state', 'country', 'crm_status', 'data_source'];
  const rows = [
    ['Rahul Sharma',  'rahul@example.com',  '9876543210', 'GrowEasy Realty',  'Bengaluru', 'Karnataka',   'India', 'GOOD_LEAD_FOLLOW_UP', 'leads_on_demand'],
    ['Priya Patel',   'priya@example.com',  '9123456789', 'Tech Solutions',   'Mumbai',    'Maharashtra', 'India', 'DID_NOT_CONNECT',     'meridian_tower'],
    ['Amit Kumar',    'amit@example.com',   '9988776655', 'Infosys Ltd',      'Pune',      'Maharashtra', 'India', 'BAD_LEAD',            'eden_park'],
    ['Sneha Reddy',   'sneha@example.com',  '9871234560', 'Wipro',            'Hyderabad', 'Telangana',   'India', 'SALE_DONE',           'varah_swamy'],
    ['Vikram Singh',  'vikram@example.com', '9765432100', 'Tata Consultancy', 'Chennai',   'Tamil Nadu',  'India', 'GOOD_LEAD_FOLLOW_UP', 'sarjapur_plots'],
    ['Anjali Nair',   'anjali@example.com', '9012345678', 'HCL Tech',         'Kochi',     'Kerala',      'India', 'DID_NOT_CONNECT',     'leads_on_demand'],
  ];
  return toCsv(headers, rows, ',');
}

function buildMessyExport(): string {
  // Different, non-CRM-matching header names — exercises the AI mapping step
  // rather than a 1:1 field match.
  const headers = ['Full Name', 'Contact Email', 'Phone Number', 'Project Interest', 'Lead Status', 'Source', 'Enquiry Date', 'Remarks'];
  const rows = [
    ['Karan Mehta', 'karan@example.com, karan.alt@gmail.com', '9876500001', 'Meridian Tower', 'Interested, will connect next week', 'Leads on Demand', '2024-01-15', 'Called twice, asked to call back after 6pm'],
    ['Divya Rao', 'divya@example.com', '9876500002 / 9123400002', 'Eden Park', 'Not reachable', 'Meridian Tower campaign', '15/01/2024', 'Number switched off both times'],
    ['Suresh Iyer', '', '9876500003', 'Sarjapur Plots', 'Deal closed', 'Varah Swamy referral', 'Jan 16, 2024', 'Paid full booking amount, documents pending'],
    ['', 'noone@example.com', '', 'Eden Park', 'Junk lead', 'Unknown', '2024-01-16', 'No response to any channel'],
    ['Only A Name', '', '', 'Meridian Tower', 'New', 'Website', '2024-01-17', 'Should be skipped — no email or phone'],
    ['Fatima Sheikh', 'fatima@example.com', '9876500005', 'Sarjapur Plots', 'Good lead, follow up Monday', 'Leads on Demand', '17-01-2024', "Client said:\nBudget is 80L,\nprefers 2BHK"],
    ['Rohit Malhotra', 'rohit@example.com', '9876500006', 'Varah Swamy', 'DNP', 'Broker network', '2024/01/18', 'Tried 3 times, voicemail only'],
    ['Meena Kumari', 'meena@example.com, meena.work@example.com, meena.old@example.com', '9876500007', 'Meridian Tower', 'Booked', 'Leads on Demand', '2024-01-19', 'VIP client, handle personally'],
    ['Arjun Desai', 'arjun@example.com', '9876500008, 9123400008', 'Eden Park', 'Considering', 'Instagram ad', '19 Jan 2024', 'Wants a site visit this weekend'],
    ['Neha Joshi', 'neha@example.com', '9876500009', 'Random Unknown Project', 'Follow up next quarter', 'Newspaper ad', '2024-01-20', 'Not urgent, revisit in 3 months'],
    ['Tarun Bhalla', 'tarun@example.com', '9876500010', 'Sarjapur Plots', 'Sale done', 'Varah Swamy', '2024-01-21', 'Full payment received'],
    ['Just A Lead', '', '', '', 'No contact info', 'Unknown', '', 'Should be skipped — no email or phone'],
    ['Pooja Nanda', 'pooja@example.com', '9876500012', 'Meridian Tower', 'Bad lead', 'Cold call list', '2024-01-22', 'Rude on call, do not contact again'],
    ['Sameer Qureshi', 'sameer@example.com', '9876500013', 'Eden Park', 'Interested', 'Leads on Demand', '2024-01-23', 'Asked for brochure via WhatsApp'],
    ['Ritu Chawla', 'ritu@example.com', '9876500014', 'Varah Swamy', 'Did not connect', 'Meridian Tower campaign', '2024-01-24', 'Line busy on all attempts'],
    ['Deepak Verma', 'deepak@example.com', '9876500015', 'Sarjapur Plots', 'Hot lead', 'Leads on Demand', '2024-01-25', 'Ready to book, needs loan approval first'],
    ['Ishaan Kapoor', 'ishaan@example.com', '9876500016', 'Meridian Tower', 'Sale done', 'Varah Swamy referral', '2024-01-26', 'Second home purchase'],
    ['Lakshmi Menon', 'lakshmi@example.com', '9876500017', 'Eden Park', 'New enquiry', 'Website form', '2024-01-27', 'Requested pricing for 3BHK units'],
  ];
  return toCsv(headers, rows, ';');
}

const LARGE_BATCH_STATUSES = ['GOOD_LEAD_FOLLOW_UP', 'DID_NOT_CONNECT', 'BAD_LEAD', 'SALE_DONE'];
const LARGE_BATCH_SOURCES = ['leads_on_demand', 'meridian_tower', 'eden_park', 'varah_swamy', 'sarjapur_plots'];
const LARGE_BATCH_CITIES = [
  ['Bengaluru', 'Karnataka'], ['Mumbai', 'Maharashtra'], ['Pune', 'Maharashtra'],
  ['Hyderabad', 'Telangana'], ['Chennai', 'Tamil Nadu'], ['Kochi', 'Kerala'],
];

function buildLargeBatch(rowCount = 300): string {
  const headers = ['name', 'email', 'mobile', 'company', 'city', 'state', 'country', 'crm_status', 'data_source', 'created_at'];
  const rows: string[][] = [];
  for (let i = 1; i <= rowCount; i++) {
    const [city, state] = LARGE_BATCH_CITIES[i % LARGE_BATCH_CITIES.length]!;
    rows.push([
      `Lead ${i}`,
      `lead${i}@example.com`,
      `90000${String(i).padStart(5, '0')}`,
      `Company ${i % 40}`,
      city!,
      state!,
      'India',
      LARGE_BATCH_STATUSES[i % LARGE_BATCH_STATUSES.length]!,
      LARGE_BATCH_SOURCES[i % LARGE_BATCH_SOURCES.length]!,
      `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    ]);
  }
  return toCsv(headers, rows, ',');
}

function triggerCsvDownload(csv: string, filename: string): void {
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

export function downloadSampleCsv(id: SampleCsvId): void {
  const info = SAMPLE_CSVS.find((s) => s.id === id);
  if (!info) return;
  const csv =
    id === 'quick-start' ? buildQuickStart() :
    id === 'messy-export' ? buildMessyExport() :
    buildLargeBatch();
  triggerCsvDownload(csv, info.filename);
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
