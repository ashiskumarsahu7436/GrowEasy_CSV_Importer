import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import {
  ArrowLeft, RotateCcw, Loader, CircleAlert, RefreshCw,
  Moon, Sun, Download, Search, CircleCheck, XCircle, MinusCircle,
} from 'lucide-react';
import { StepIndicator } from '@/components/StepIndicator';
import { useImport } from '@/context/ImportContext';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useProcessCsv } from '@workspace/api-client-react';
import { CRM_FIELD_LABELS, type CrmRecord, type ProcessedRecord, type RecordStatus } from '@/types';
import { downloadResultsCsv } from '@/utils/csvUtils';
import { Badge } from '@/components/ui/badge';

const CRM_FIELD_KEYS = Object.keys(CRM_FIELD_LABELS) as (keyof CrmRecord)[];

type StatusFilter = 'all' | RecordStatus;

const STATUS_META: Record<RecordStatus, { label: string; icon: typeof CircleCheck; badgeClass: string }> = {
  imported: { label: 'Imported', icon: CircleCheck, badgeClass: 'bg-primary text-primary-foreground border-transparent' },
  skipped: { label: 'Skipped', icon: MinusCircle, badgeClass: 'bg-amber-500 text-white border-transparent dark:bg-amber-600' },
  failed: { label: 'Failed', icon: XCircle, badgeClass: '' },
};

function StatusBadge({ status }: { status: RecordStatus }) {
  const meta = STATUS_META[status];
  if (status === 'failed') {
    return <Badge variant="destructive">{meta.label}</Badge>;
  }
  return <Badge className={meta.badgeClass}>{meta.label}</Badge>;
}

export default function ResultsPage() {
  const {
    currentStep, parsedData, mappings, results, stats,
    setResults, goToStep, reset,
  } = useImport();
  const { isDark, toggle } = useDarkMode();
  const [, navigate] = useLocation();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const hasRequested = useRef(false);

  const { mutate, isPending, isError, error } = useProcessCsv({
    mutation: {
      onSuccess: (data) => {
        setResults(data.records as ProcessedRecord[], data.stats);
        toast.success('Import processed', {
          description: `${data.stats.imported} imported, ${data.stats.skipped} skipped, ${data.stats.failed} failed.`,
        });
      },
      onError: (err) => {
        toast.error('Processing failed', {
          description: err instanceof Error ? err.message : 'Something went wrong while contacting the AI service.',
        });
      },
    },
  });

  // ── Redirect guards — no data / no mappings means the user skipped steps ──
  if (!parsedData) {
    navigate('/');
    return null;
  }
  if (mappings.length === 0) {
    navigate('/mapping');
    return null;
  }

  const runProcessing = () => {
    mutate({
      data: {
        headers: parsedData.headers,
        rows: parsedData.rows,
        userMappings: mappings,
      },
    });
  };

  // Kick off processing once on mount, unless results are already cached
  // in context (e.g. the user navigated back and forth).
  useEffect(() => {
    if (hasRequested.current) return;
    hasRequested.current = true;

    if (results.length === 0) {
      runProcessing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    return results.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q === '') return true;
      const name = (r.crm.name ?? '').toLowerCase();
      const email = (r.crm.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [results, statusFilter, search]);

  const handleBack = () => {
    goToStep(3);
    navigate('/mapping');
  };

  const handleStartOver = () => {
    reset();
    navigate('/');
  };

  const handleExport = () => {
    downloadResultsCsv(results);
    toast.success('Results exported', { description: `${results.length} record${results.length === 1 ? '' : 's'} saved to CSV.` });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:px-6 lg:px-8">

      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-primary mb-2">GrowEasy CSV Importer</p>
          <h1 className="text-2xl font-bold">Import results</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Review processed records, check failures, and export a clean file before sending data to your CRM.
          </p>
        </div>
        <button
          onClick={toggle}
          className="min-h-11 px-4 py-3 rounded-xl border border-border bg-card text-sm font-medium text-foreground shadow-sm hover:bg-muted hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring flex items-center gap-2 self-start"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      <StepIndicator currentStep={currentStep} />

      {/* ── AI processing state ── */}
      {isPending && (
        <div className="rounded-2xl border border-border bg-card shadow-sm p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-accent text-primary flex items-center justify-center shadow-sm mb-4">
            <Loader className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Processing your rows…</h2>
          <p className="text-sm text-muted-foreground">
            AI is normalizing {parsedData.totalRows.toLocaleString()} row{parsedData.totalRows === 1 ? '' : 's'} in batches of 25 and validating each record.
          </p>
        </div>
      )}

      {/* ── Error state ── */}
      {isError && !isPending && (
        <div className="rounded-2xl border border-destructive/40 bg-card shadow-sm p-6 flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0 shadow-sm">
            <CircleAlert className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Processing failed</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Something went wrong while contacting the AI service.'}
            </p>
          </div>
          <button
            onClick={runProcessing}
            className="min-h-11 px-4 py-3 rounded-xl border border-border bg-background text-sm font-medium shadow-sm hover:bg-muted hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring flex items-center gap-2 shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* ── Results ── */}
      {!isPending && stats && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs text-muted-foreground mb-2">Total rows</p>
              <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
            </div>
            <button
              onClick={() => setStatusFilter(statusFilter === 'imported' ? 'all' : 'imported')}
              className={[
                'rounded-2xl border p-5 shadow-sm text-left transition-all duration-200 hover:-translate-y-0.5',
                statusFilter === 'imported' ? 'border-primary ring-1 ring-primary bg-card' : 'border-border bg-card',
              ].join(' ')}
            >
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <CircleCheck className="w-3.5 h-3.5 text-primary" /> Imported
              </p>
              <p className="text-2xl font-bold text-primary">{stats.imported.toLocaleString()}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'skipped' ? 'all' : 'skipped')}
              className={[
                'rounded-2xl border p-5 shadow-sm text-left transition-all duration-200 hover:-translate-y-0.5',
                statusFilter === 'skipped' ? 'border-amber-500 ring-1 ring-amber-500 bg-card' : 'border-border bg-card',
              ].join(' ')}
            >
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <MinusCircle className="w-3.5 h-3.5 text-amber-500" /> Skipped
              </p>
              <p className="text-2xl font-bold text-amber-500">{stats.skipped.toLocaleString()}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')}
              className={[
                'rounded-2xl border p-5 shadow-sm text-left transition-all duration-200 hover:-translate-y-0.5',
                statusFilter === 'failed' ? 'border-destructive ring-1 ring-destructive bg-card' : 'border-border bg-card',
              ].join(' ')}
            >
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-destructive" /> Failed
              </p>
              <p className="text-2xl font-bold text-destructive">{stats.failed.toLocaleString()}</p>
            </button>
          </div>

          {/* Toolbar: search + filter chips + export */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'imported', 'skipped', 'failed'] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={[
                    'min-h-11 px-4 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring',
                    statusFilter === f
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border border-border bg-background hover:bg-muted',
                  ].join(' ')}
                >
                  {f === 'all' ? 'All' : STATUS_META[f].label}
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              disabled={results.length === 0}
              className="min-h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Results table */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden mb-6">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">Processed records</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Showing {filteredResults.length} of {results.length} records
                </p>
              </div>
            </div>
            <div className="overflow-auto max-h-[560px]">
              <table className="min-w-full w-full text-left border-collapse">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">#</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Reason</th>
                    {CRM_FIELD_KEYS.map((field) => (
                      <th key={field} className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        {CRM_FIELD_LABELS[field]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={3 + CRM_FIELD_KEYS.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No records match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((record, idx) => (
                      <tr
                        key={record.rowIndex}
                        className={idx % 2 === 0 ? 'bg-background' : 'bg-muted'}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">
                          {record.rowIndex + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={record.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground max-w-[220px] truncate" title={record.reason ?? ''}>
                          {record.reason ?? <span className="italic">—</span>}
                        </td>
                        {CRM_FIELD_KEYS.map((field) => (
                          <td
                            key={field}
                            className="px-4 py-3 text-sm whitespace-nowrap max-w-[200px] truncate"
                            title={record.crm[field] ?? ''}
                          >
                            {record.crm[field] ?? <span className="text-muted-foreground italic">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Footer nav ── */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <button
          onClick={handleBack}
          className="min-h-11 px-5 py-3 rounded-xl border border-border bg-card text-sm font-semibold shadow-sm hover:bg-muted hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleStartOver}
          className="min-h-11 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Start over
        </button>
      </div>

    </div>
  );
}
