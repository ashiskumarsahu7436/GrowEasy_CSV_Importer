// ── CRM field enums ────────────────────────────────────────────────────────

export const CRM_STATUS_VALUES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
] as const;

export type CrmStatus = (typeof CRM_STATUS_VALUES)[number];

export const DATA_SOURCE_VALUES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
] as const;

export type DataSource = (typeof DATA_SOURCE_VALUES)[number];

// ── CRM record shape ───────────────────────────────────────────────────────

export interface CrmRecord {
  created_at?: string | null;
  name?: string | null;
  email?: string | null;
  country_code?: string | null;
  mobile_without_country_code?: string | null;
  company?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  lead_owner?: string | null;
  crm_status?: CrmStatus | null;
  crm_note?: string | null;
  data_source?: DataSource | null;
  possession_time?: string | null;
  description?: string | null;
}

// Human-readable labels for CRM fields shown in the mapping UI
export const CRM_FIELD_LABELS: Record<keyof CrmRecord, string> = {
  created_at: 'Created At',
  name: 'Lead Name',
  email: 'Email',
  country_code: 'Country Code',
  mobile_without_country_code: 'Mobile Number',
  company: 'Company',
  city: 'City',
  state: 'State',
  country: 'Country',
  lead_owner: 'Lead Owner',
  crm_status: 'CRM Status',
  crm_note: 'Notes',
  data_source: 'Data Source',
  possession_time: 'Possession Time',
  description: 'Description',
};

// ── Parsed CSV data ────────────────────────────────────────────────────────

export interface ParsedCsvData {
  headers: string[];
  rows: Record<string, string>[];       // all rows
  previewRows: Record<string, string>[]; // first 10 rows
  totalRows: number;
  filename: string;
  fileSize: number;                     // bytes
  delimiter: string;
  duplicateHeaders: string[];           // raw header names that appeared more than once (before auto-rename)
  rowErrors: string[];                  // human-readable row-level parse warnings (mismatched field counts, etc.)
}

// ── Column mapping (AI suggestion or user override) ────────────────────────

export interface ColumnMapping {
  csvColumn: string;
  crmField: keyof CrmRecord | null;
  confidence: number; // 0–100
}

// ── Processed record ───────────────────────────────────────────────────────

export type RecordStatus = 'imported' | 'skipped' | 'failed';

export interface ProcessedRecord {
  rowIndex: number;
  status: RecordStatus;
  reason?: string | null;
  crm: CrmRecord;
  originalRow: Record<string, string>;
}

// ── Import stats ───────────────────────────────────────────────────────────

export interface ProcessStats {
  imported: number;
  skipped: number;
  failed: number;
  total: number;
}

// ── Wizard steps ───────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4;

export const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Upload',
  2: 'Preview',
  3: 'AI Mapping',
  4: 'Results',
};
