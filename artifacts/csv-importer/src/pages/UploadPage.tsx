import { useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import {
  Upload, File, X, CircleAlert, CircleCheck,
  Info, Download, Loader, Moon, Sun,
} from 'lucide-react';
import { StepIndicator } from '@/components/StepIndicator';
import { useImport } from '@/context/ImportContext';
import { useDarkMode } from '@/hooks/useDarkMode';
import { parseCsv, formatFileSize, downloadSampleCsv } from '@/utils/csvUtils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
type UploadError = 'invalid_type' | 'too_large' | 'duplicate' | null;

export default function UploadPage() {
  const { currentStep, file, setFile, setParsedData, goToStep } = useImport();
  const { isDark, toggle } = useDarkMode();
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [error, setError]                 = useState<UploadError>(null);
  const [isParsing, setIsParsing]         = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragActive, setIsDragActive]   = useState(false);

  // ── Validate + store file ────────────────────────────────────────────────
  const validateAndSetFile = useCallback((newFile: File) => {
    setError(null);
    setUploadSuccess(false);

    const isCsv =
      newFile.type === 'text/csv' ||
      newFile.name.toLowerCase().endsWith('.csv');
    if (!isCsv)                          { setError('invalid_type'); toast.error('Invalid file type', { description: 'Only .csv files are accepted.' }); return; }
    if (newFile.size > MAX_FILE_SIZE)    { setError('too_large');    toast.error('File too large', { description: 'Maximum file size is 10 MB.' }); return; }
    if (
      file &&
      newFile.name === file.name &&
      newFile.size === file.size
    )                                    { setError('duplicate');    toast.warning('Duplicate upload detected'); return; }

    setFile(newFile);
    setUploadSuccess(true);
    toast.success('File ready', { description: `${newFile.name} (${formatFileSize(newFile.size)})` });
  }, [file, setFile]);

  // ── Drag & drop handlers ─────────────────────────────────────────────────
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragActive(true);  };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragActive(false); };
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  };

  // ── File input handler ───────────────────────────────────────────────────
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) validateAndSetFile(picked);
    e.target.value = ''; // reset so same file can be re-selected
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setError(null);
    setUploadSuccess(false);
  };

  const handleUpload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!file || isParsing) return;
    setIsParsing(true);
    try {
      const data = await parseCsv(file);
      setParsedData(data);
      goToStep(2);
      toast.success('CSV parsed successfully', {
        description: `${data.totalRows.toLocaleString()} row${data.totalRows === 1 ? '' : 's'} across ${data.headers.length} column${data.headers.length === 1 ? '' : 's'}.`,
      });
      navigate('/preview');
    } catch {
      setError('invalid_type');
      toast.error('Could not parse this CSV', { description: 'Check the file and try again.' });
    } finally {
      setIsParsing(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 md:px-6 lg:px-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-primary mb-2">GrowEasy CSV Importer</p>
          <h1 className="text-2xl font-bold">Upload your CSV</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Start by securely uploading your file. You'll preview and confirm everything before AI mapping begins.
          </p>
        </div>
        <button
          onClick={toggle}
          className="min-h-11 px-4 py-3 rounded-xl border border-border bg-card text-sm font-medium text-foreground shadow-sm hover:bg-muted hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring flex items-center gap-2 shrink-0"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      {/* ── Step indicator ── */}
      <StepIndicator currentStep={currentStep} />

      {/* ── Main card ── */}
      <div className="rounded-2xl border border-border bg-card shadow-sm p-5 md:p-6 transition-all duration-200">

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFileInput}
        />

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload CSV file"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={[
            'rounded-2xl border-2 border-dashed p-6 md:p-10 text-center shadow-sm transition-all duration-200 cursor-pointer select-none outline-none',
            isDragActive
              ? 'border-primary bg-accent scale-[1.005] shadow-md'
              : 'border-primary bg-accent hover:-translate-y-0.5 hover:shadow-md',
          ].join(' ')}
        >
          {/* Upload icon */}
          <div className="w-16 h-16 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm mb-5">
            <Upload className="w-7 h-7" />
          </div>

          <h2 className="text-lg font-semibold mb-2">
            {isDragActive
              ? 'Drop your CSV file here'
              : 'Drag and drop your CSV file here or click to browse'}
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Your data stays private and is never shared.
          </p>

          {/* Selected file pill */}
          {file && (
            <div
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm mb-5 transition-all duration-200 hover:-translate-y-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <File className="text-primary w-4 h-4 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={handleRemoveFile}
                className="ml-3 text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Action row */}
          <div
            className="flex flex-wrap items-center justify-center gap-3 mb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleUpload}
              disabled={!file || isParsing}
              className="min-h-11 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2"
            >
              {isParsing && <Loader className="w-4 h-4 animate-spin" />}
              {isParsing ? 'Parsing…' : 'Upload CSV'}
            </button>

            {error === 'invalid_type' && (
              <div className="min-h-11 px-4 py-3 rounded-xl border border-border bg-card text-sm text-destructive flex items-center gap-2 shadow-sm">
                <CircleAlert className="w-4 h-4 shrink-0" />
                Invalid file type — CSV only
              </div>
            )}
            {error === 'too_large' && (
              <div className="min-h-11 px-4 py-3 rounded-xl border border-border bg-card text-sm text-destructive flex items-center gap-2 shadow-sm">
                <CircleAlert className="w-4 h-4 shrink-0" />
                File too large (max 10 MB)
              </div>
            )}
            {error === 'duplicate' && (
              <div className="min-h-11 px-4 py-3 rounded-xl border border-border bg-card text-sm text-muted-foreground flex items-center gap-2 shadow-sm">
                <CircleAlert className="w-4 h-4 shrink-0" />
                Duplicate upload detected
              </div>
            )}
            {uploadSuccess && !error && (
              <div className="min-h-11 px-4 py-3 rounded-xl border border-border bg-card text-sm text-primary flex items-center gap-2 shadow-sm">
                <CircleCheck className="w-4 h-4 shrink-0" />
                File ready
              </div>
            )}
          </div>

          {/* Quick constraint cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
            {[
              { label: 'Accepted format',   value: 'CSV' },
              { label: 'Maximum file size', value: '10 MB' },
              { label: 'Maximum rows',      value: 'Up to 50,000 rows' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Info banner */}
        <div className="mt-5 rounded-xl border border-border bg-muted p-4 flex items-start gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">No AI processing happens yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              You'll review your data before anything is imported.
            </p>
          </div>
        </div>

        {/* File requirements */}
        <div className="mt-5 rounded-2xl border border-border bg-background p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">File requirements</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Everything needed to prepare a clean import file.
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); downloadSampleCsv(); }}
              className="min-h-11 px-4 py-3 rounded-xl border border-border bg-card text-sm font-medium shadow-sm hover:bg-muted hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring flex items-center gap-2 self-start"
            >
              <Download className="w-4 h-4" />
              Download Sample CSV
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {[
              { label: 'Supported Columns', value: 'Name, Email, Phone, Status' },
              { label: 'Accepted Format',   value: 'CSV' },
              { label: 'Maximum File Size', value: '10 MB' },
              { label: 'Maximum Rows',      value: '50,000' },
              { label: 'Privacy',           value: 'Private by default' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="mt-5 flex items-center gap-4 flex-wrap">
        <div className="rounded-xl border border-border bg-card shadow-sm px-4 py-3 flex items-center gap-3">
          <div
            className={[
              'w-2.5 h-2.5 rounded-full',
              file ? 'bg-primary animate-pulse' : 'bg-muted-foreground opacity-40',
            ].join(' ')}
          />
          <p className="text-sm text-muted-foreground">
            {file ? 'Upload ready' : 'Waiting for file'}
          </p>
        </div>
      </div>

    </div>
  );
}
