import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  WizardStep,
  ParsedCsvData,
  ColumnMapping,
  ProcessedRecord,
  ProcessStats,
} from '@/types';

// ── State shape ────────────────────────────────────────────────────────────

interface ImportState {
  currentStep: WizardStep;

  // Step 1 – Upload
  file: File | null;

  // Step 2 – Preview
  parsedData: ParsedCsvData | null;

  // Step 3 – AI Mapping
  mappings: ColumnMapping[];
  isMappingLoading: boolean;

  // Step 4 – Results
  results: ProcessedRecord[];
  stats: ProcessStats | null;
  isProcessing: boolean;
}

// ── Context actions ────────────────────────────────────────────────────────

interface ImportContextValue extends ImportState {
  setFile: (file: File | null) => void;
  setParsedData: (data: ParsedCsvData | null) => void;
  setMappings: (mappings: ColumnMapping[]) => void;
  setIsMappingLoading: (v: boolean) => void;
  setResults: (records: ProcessedRecord[], stats: ProcessStats) => void;
  setIsProcessing: (v: boolean) => void;
  goToStep: (step: WizardStep) => void;
  reset: () => void;
}

// ── Initial state ──────────────────────────────────────────────────────────

const initialState: ImportState = {
  currentStep: 1,
  file: null,
  parsedData: null,
  mappings: [],
  isMappingLoading: false,
  results: [],
  stats: null,
  isProcessing: false,
};

// ── Context ────────────────────────────────────────────────────────────────

const ImportContext = createContext<ImportContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function ImportProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImportState>(initialState);

  const setFile = useCallback((file: File | null) => {
    setState((s) => ({ ...s, file }));
  }, []);

  const setParsedData = useCallback((parsedData: ParsedCsvData | null) => {
    setState((s) => ({ ...s, parsedData }));
  }, []);

  const setMappings = useCallback((mappings: ColumnMapping[]) => {
    setState((s) => ({ ...s, mappings }));
  }, []);

  const setIsMappingLoading = useCallback((isMappingLoading: boolean) => {
    setState((s) => ({ ...s, isMappingLoading }));
  }, []);

  const setResults = useCallback(
    (results: ProcessedRecord[], stats: ProcessStats) => {
      setState((s) => ({ ...s, results, stats }));
    },
    [],
  );

  const setIsProcessing = useCallback((isProcessing: boolean) => {
    setState((s) => ({ ...s, isProcessing }));
  }, []);

  const goToStep = useCallback((currentStep: WizardStep) => {
    setState((s) => ({ ...s, currentStep }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <ImportContext.Provider
      value={{
        ...state,
        setFile,
        setParsedData,
        setMappings,
        setIsMappingLoading,
        setResults,
        setIsProcessing,
        goToStep,
        reset,
      }}
    >
      {children}
    </ImportContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useImport(): ImportContextValue {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error('useImport must be used within ImportProvider');
  return ctx;
}
