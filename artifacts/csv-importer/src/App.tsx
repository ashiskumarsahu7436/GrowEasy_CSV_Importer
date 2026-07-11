import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Toaster } from '@/components/ui/sonner';

import { ImportProvider } from '@/context/ImportContext';
import { useDarkMode } from '@/hooks/useDarkMode';

import UploadPage from '@/pages/UploadPage';
import PreviewPage from '@/pages/PreviewPage';
import MappingPage from '@/pages/MappingPage';
import ResultsPage from '@/pages/ResultsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 0 },
  },
});

function AppShell() {
  // Initialise dark mode (reads from localStorage / system preference)
  useDarkMode();

  return (
    <div className="min-h-screen w-full bg-background flex flex-col relative text-foreground font-sans">
      <Switch>
        <Route path="/" component={UploadPage} />
        <Route path="/preview" component={PreviewPage} />
        <Route path="/mapping" component={MappingPage} />
        <Route path="/results" component={ResultsPage} />
        {/* Fallback → Upload */}
        <Route>{() => <UploadPage />}</Route>
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ImportProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AppShell />
        </WouterRouter>
        <Toaster richColors position="top-right" />
      </ImportProvider>
    </QueryClientProvider>
  );
}

export default App;
