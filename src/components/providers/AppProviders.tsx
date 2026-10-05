'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePersistedRecipes } from '@/hooks/use-persisted-recipes';

const HasInAppHistoryContext = createContext(false);

export function useHasInAppHistory() {
  return useContext(HasInAppHistoryContext);
}

// Lets "Back" buttons use real history (restoring list state and scroll) only when the
// user actually navigated within the app, instead of leaving it on a direct/shared link.
function useTrackInAppNavigation() {
  const pathname = usePathname();
  const firstPathname = useRef(pathname);
  const [hasInAppHistory, setHasInAppHistory] = useState(false);

  useEffect(() => {
    if (pathname !== firstPathname.current) setHasInAppHistory(true);
  }, [pathname]);

  return hasInAppHistory;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  );
  const hasInAppHistory = useTrackInAppNavigation();
  usePersistedRecipes(queryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <HasInAppHistoryContext.Provider value={hasInAppHistory}>{children}</HasInAppHistoryContext.Provider>
    </QueryClientProvider>
  );
}
