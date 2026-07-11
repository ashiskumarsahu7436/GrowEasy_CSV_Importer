import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Loader, Sparkles,
  CircleAlert, RefreshCw, Moon, Sun,
} from 'lucide-react';
import { StepIndicator } from '@/components/StepIndicator';
import { useImport } from '@/context/ImportContext';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useMapColumns } from '@workspace/api-client-react';
import { CRM_FIELD_LABELS, type CrmRecord, type ColumnMapping } from '@/types';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const CRM_FIELD_KEYS = Object.keys(CRM_FIELD_LABELS) as (keyof CrmRecord)[];

// ── Confidence badge ──────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 80) {
    return <Badge className="bg-primary text-primary-foreground border-transparent">{confidence}%</Badge>;
  }
  if (confidence >= 50) {
    return (
      <Badge className="bg-amber-500 text-white border-transparent dark:bg-amber-600">
        {confidence}%
      </Badge>
    );
  }
  return <Badge variant="destructive">{confidence}%</Badge>;
}

export default function MappingPage() {
  const { currentStep, parsedData, mappings, setMappings, goToStep } = useImport();
  const { isDark, toggle } = useDarkMode();
  const [, navigate] = useLocation();

  const [rows, setRows] = useState<ColumnMapping[]>([]);
  const hasRequested = useRef(false);

  const { mutate, isPending, isError, error } = useMapColumns({
    mutation: {
      onSuccess: (data) => {
        const next: ColumnMapping[] = data.mappings.map((m) => ({
          csvColumn: m.csvColumn,
          crmField: (m.crmField ?? null) as ColumnMapping['crmField'],
          confidence: m.confidence,
        }));
        setRows(next);
        setMappings(next);
        const mapped = next.filter((r) => r.crmField !== null).length;
        toast.success('AI mapping complete', {
          description: `${mapped} of ${next.length} columns matched to a CRM field.`,
        });
      },
      onError: (err) => {
        toast.error('AI mapping failed', {
          description: err instanceof Error ? err.message : 'Something went wrong while contacting the AI service.',
        });
      },
    },
  });

  // ── Redirect guard — no parsed data means the user skipped steps ────────
  if (!parsedData) {
    navigate('/');
    return null;
  }

  const { headers, rows: allRows } = parsedData;

  const runMapping = () => {
    mutate({
      data: {
        headers,
        sampleRows: allRows.slice(0, 5),
      },
    });
  };

  // Kick off the AI mapping request once, on mount (or reuse cached mappings
  // from context if the user navigated back here).
  useEffect(() => {
    if (hasRequested.current) return;
    hasRequested.current = true;

    if (mappings.length > 0) {
      setRows(mappings);
    } else {
      runMapping();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sampleValuesByColumn = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const header of headers) {
      const values = allRows
        .slice(0, 3)
        .map((row) => row[header])
        .filter((v): v is string => Boolean(v && v.trim() !== ''));
      map.set(header, values);
    }
    return map;
  }, [headers, allRows]);

  const handleOverride = (csvColumn: string, crmField: string) => {
    setRows((prev) => {
      const next = prev.map((r) =>
        r.csvColumn === csvColumn
          ? { ...r, crmField: crmField === '__none__' ? null : (crmField as ColumnMapping['crmField']), confidence: 100 }
          : r,
      );
      setMappings(next);
      return next;
    });
  };

  const handleBack = () => {
    goToStep(2);
    navigate('/preview');
  };

  const handleStartImport = () => {
    setMappings(rows);
    goToStep(4);
    navigate('/results');
  };

  const mappedCount = rows.filter((r) => r.crmField !== null).length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:px-6 lg:px-8">

      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-primary mb-2">GrowEasy CSV Importer</p>
          <h1 className="text-2xl font-bold">AI mapping review</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your AI assistant analyses the CSV first, then proposes CRM mappings you can review and adjust with confidence.
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

      {/* ── AI loading state ── */}
      {isPending && (
        <div className="rounded-2xl border border-border bg-card shadow-sm p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-accent text-primary flex items-center justify-center shadow-sm mb-4">
            <Loader className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Analysing your columns…</h2>
          <p className="text-sm text-muted-foreground">
            AI is comparing your {headers.length} column{headers.length === 1 ? '' : 's'} against 15 CRM fields.
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
            <p className="text-sm font-semibold text-destructive">AI mapping failed</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Something went wrong while contacting the AI service.'}
            </p>
          </div>
          <button
            onClick={runMapping}
            className="min-h-11 px-4 py-3 rounded-xl border border-border bg-background text-sm font-medium shadow-sm hover:bg-muted hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring flex items-center gap-2 shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* ── Mapping table ── */}
      {!isPending && rows.length > 0 && (
        <>
          <div className="rounded-xl border border-border bg-muted p-4 flex items-start gap-3 shadow-sm mb-6">
            <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {mappedCount} of {rows.length} columns mapped
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Review the AI's suggestions below. Override any mapping using the dropdown — manual overrides are marked 100% confident.
              </p>
            </div>
            <button
              onClick={runMapping}
              className="min-h-11 px-4 py-3 rounded-xl border border-border bg-card text-sm font-medium shadow-sm hover:bg-muted hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring flex items-center gap-2 shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              Re-run AI
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden mb-6">
            <div className="overflow-auto max-h-[560px]">
              <table className="min-w-full w-full text-left border-collapse">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">CSV column</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Sample values</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">AI suggested CRM field</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Confidence</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, idx) => {
                    const samples = sampleValuesByColumn.get(row.csvColumn) ?? [];
                    return (
                      <tr
                        key={row.csvColumn}
                        className={idx % 2 === 0 ? 'bg-background' : 'bg-muted'}
                      >
                        <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{row.csvColumn}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground max-w-[240px] truncate" title={samples.join(', ')}>
                          {samples.length > 0 ? samples.join(', ') : <span className="italic">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {row.crmField ? CRM_FIELD_LABELS[row.crmField] : (
                            <span className="text-muted-foreground italic">No match</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ConfidenceBadge confidence={row.confidence} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap min-w-[200px]">
                          <Select
                            value={row.crmField ?? '__none__'}
                            onValueChange={(value) => handleOverride(row.csvColumn, value)}
                          >
                            <SelectTrigger className="h-9 min-h-9">
                              <SelectValue placeholder="Select CRM field" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">No match / ignore</SelectItem>
                              {CRM_FIELD_KEYS.map((field) => (
                                <SelectItem key={field} value={field}>
                                  {CRM_FIELD_LABELS[field]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
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
          onClick={handleStartImport}
          disabled={isPending || rows.length === 0}
          className="min-h-11 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          Start Import
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
