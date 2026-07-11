import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import {
  File, Info, CircleCheck, CircleAlert,
  ChevronDown, ChevronUp, ArrowLeft, ArrowRight,
  Moon, Sun, Shield, Loader,
} from 'lucide-react';
import { StepIndicator } from '@/components/StepIndicator';
import { useImport } from '@/context/ImportContext';
import { useDarkMode } from '@/hooks/useDarkMode';

type Delimiter = ',' | ';' | '\t';
type Encoding  = 'UTF-8' | 'UTF-16';

export default function PreviewPage() {
  const { currentStep, parsedData, goToStep } = useImport();
  const { isDark, toggle } = useDarkMode();
  const [, navigate] = useLocation();

  const [showAdvanced, setShowAdvanced]   = useState(false);
  const [delimiter, setDelimiter]         = useState<Delimiter>(',');
  const [encoding, setEncoding]           = useState<Encoding>('UTF-8');

  // ── Redirect guard ───────────────────────────────────────────────────────
  // If user lands here directly with no data, send back to upload
  if (!parsedData) {
    navigate('/');
    return null;
  }

  const { headers, previewRows, totalRows, filename, fileSize, duplicateHeaders, rowErrors } = parsedData;

  // ── Validation checks ─────────────────────────────────────────────────────
  // Blocking issues prevent continuing to the AI mapping step.
  const issues = useMemo(() => {
    const found: string[] = [];
    if (duplicateHeaders.length > 0) found.push(`Duplicate headers: ${duplicateHeaders.join(', ')}`);
    if (headers.some((h) => h.trim() === '')) found.push('One or more column headers are empty');
    if (totalRows === 0) found.push('No data rows found');
    return found;
  }, [headers, totalRows, duplicateHeaders]);

  const hasIssues = issues.length > 0;

  // Non-blocking warnings: rows whose field count didn't match the header row.
  const hasRowWarnings = rowErrors.length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleBack = () => {
    goToStep(1);
    navigate('/');
  };

  const handleContinue = () => {
    if (hasIssues) {
      toast.error('Fix the issues below before continuing', {
        description: issues[0],
      });
      return;
    }
    goToStep(3);
    toast.success('Preview confirmed', { description: 'Handing off to AI mapping…' });
    navigate('/mapping');
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const delimiterLabel: Record<Delimiter, string> = {
    ',': 'Comma',
    ';': 'Semicolon',
    '\t': 'Tab',
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:px-6 lg:px-8">

      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-primary mb-2">GrowEasy CSV Importer</p>
          <h1 className="text-2xl font-bold">Preview your data before AI mapping</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Review the uploaded CSV structure, validate headers, and continue only when everything looks correct.
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

      {/* ── Step indicator ── */}
      <StepIndicator currentStep={currentStep} />

      {/* ── 3 stat cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Filename */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs text-muted-foreground mb-2">Uploaded filename</p>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent text-primary flex items-center justify-center shadow-sm shrink-0">
              <File className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{filename}</p>
              <p className="text-xs text-muted-foreground">{formatSize(fileSize)}</p>
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs text-muted-foreground mb-2">Rows detected</p>
          <p className="text-2xl font-bold">{totalRows.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Previewing the first {previewRows.length} rows below
          </p>
        </div>

        {/* Columns */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs text-muted-foreground mb-2">Columns detected</p>
          <p className="text-2xl font-bold">{headers.length}</p>
          <p className="text-xs text-muted-foreground mt-2">Original CSV headers preserved</p>
        </div>
      </div>

      {/* ── Info + Advanced Options + Validation ── */}
      <div className="space-y-4 mb-6">

        {/* Info banner */}
        <div className="rounded-xl border border-border bg-muted p-4 flex items-start gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center shrink-0 shadow-sm">
            <Info className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">No AI processing happens on this screen.</p>
            <p className="text-sm text-muted-foreground mt-1">
              You are only reviewing the raw CSV and parser settings before continuing.
            </p>
          </div>
        </div>

        {/* Advanced options (collapsible) */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Advanced Options</p>
              <p className="text-xs text-muted-foreground mt-1">Hidden by default for normal users.</p>
            </div>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="min-h-11 px-4 py-3 rounded-xl border border-border bg-background text-sm font-medium flex items-center gap-2 shadow-sm hover:bg-muted hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showAdvanced ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Delimiter */}
              <div className="rounded-xl border border-border bg-background p-4">
                <label className="block text-xs text-muted-foreground mb-2">Delimiter</label>
                <div className="grid grid-cols-3 gap-2">
                  {([',', ';', '\t'] as Delimiter[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDelimiter(d)}
                      className={[
                        'min-h-11 rounded-xl text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring',
                        delimiter === d
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border border-border bg-card hover:bg-muted',
                      ].join(' ')}
                    >
                      {delimiterLabel[d]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Encoding */}
              <div className="rounded-xl border border-border bg-background p-4">
                <label className="block text-xs text-muted-foreground mb-2">Encoding</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['UTF-8', 'UTF-16'] as Encoding[]).map((enc) => (
                    <button
                      key={enc}
                      onClick={() => setEncoding(enc)}
                      className={[
                        'min-h-11 rounded-xl text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring',
                        encoding === enc
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'border border-border bg-card hover:bg-muted',
                      ].join(' ')}
                    >
                      {enc}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Row-level parse warnings (non-blocking) */}
        {hasRowWarnings && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-start gap-3 transition-all duration-200">
            <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0 shadow-sm">
              <CircleAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {rowErrors.length} row{rowErrors.length === 1 ? '' : 's'} had mismatched column counts
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                These rows parsed with extra or missing values compared to the header row. They're still
                included below — double-check them before continuing.
              </p>
              <ul className="mt-2 space-y-0.5 max-h-24 overflow-auto">
                {rowErrors.slice(0, 5).map((err) => (
                  <li key={err} className="text-xs text-muted-foreground">• {err}</li>
                ))}
                {rowErrors.length > 5 && (
                  <li className="text-xs text-muted-foreground">…and {rowErrors.length - 5} more</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Validation status cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Issues / No issues */}
          {hasIssues ? (
            <div className="rounded-xl border border-destructive/40 bg-card p-4 shadow-sm flex items-start gap-3 transition-all duration-200">
              <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0 shadow-sm">
                <CircleAlert className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-destructive">Issues detected</p>
                <ul className="mt-1 space-y-0.5">
                  {issues.map((issue) => (
                    <li key={issue} className="text-sm text-muted-foreground">• {issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-start gap-3 transition-all duration-200">
              <div className="w-10 h-10 rounded-full bg-accent text-primary flex items-center justify-center shrink-0 shadow-sm">
                <CircleCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">No issues detected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Headers are unique, the file contains rows, and the parser can read all visible columns.
                </p>
              </div>
            </div>
          )}

          {/* Validation patterns info */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-start gap-3 transition-all duration-200">
            <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0 shadow-sm">
              <CircleAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Validation patterns supported</p>
              <p className="text-sm text-muted-foreground mt-1">
                Warnings appear here for duplicate headers, empty rows, or missing column labels when detected.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── CSV preview table ── */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden mb-6">
        {/* Table header bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">CSV preview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Showing the first {previewRows.length} rows with original headers, sticky header, and horizontal scrolling support.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm shrink-0">
            {previewRows.length} of {totalRows.toLocaleString()} rows shown
          </div>
        </div>

        {/* Scrollable table */}
        <div className="overflow-auto max-h-[560px]">
          <table className="min-w-full w-full text-left border-collapse">
            <thead className="bg-muted sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">#</th>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {previewRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={[
                    'transition-colors duration-200',
                    rowIdx % 2 === 0
                      ? 'bg-background hover:bg-muted'
                      : 'bg-muted hover:bg-accent',
                  ].join(' ')}
                >
                  <td className="px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">
                    {rowIdx + 1}
                  </td>
                  {headers.map((header) => (
                    <td
                      key={header}
                      className="px-4 py-3 text-sm whitespace-nowrap max-w-[200px] truncate"
                      title={row[header] ?? ''}
                    >
                      {row[header] ?? (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom info cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-accent text-primary flex items-center justify-center shadow-sm">
              <CircleCheck className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold">Preview ready</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Parser success and detected issues will surface as notifications when found.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-accent text-primary flex items-center justify-center shadow-sm">
              <Loader className="w-4 h-4 animate-spin" />
            </div>
            <p className="text-sm font-semibold">Instant parsing</p>
          </div>
          <div className="space-y-2">
            <div className="h-3 rounded-lg bg-muted animate-pulse" />
            <div className="h-3 rounded-lg bg-muted animate-pulse w-5/6" />
            <div className="h-3 rounded-lg bg-muted animate-pulse w-3/4" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold">Accessible states</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Keyboard focus rings, contrast-safe surfaces, and responsive overflow handling stay consistent.
          </p>
        </div>
      </div>

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
          onClick={handleContinue}
          disabled={hasIssues}
          className="min-h-11 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          Confirm &amp; Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
