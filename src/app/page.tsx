
import { Suspense } from 'react';
import HomePageClient from './HomePageClient';

function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
      <div className="p-8 rounded-lg shadow-xl text-center">
        <div className="h-[50px] w-[50px] animate-spin rounded-full border-4 border-solid border-muted border-t-primary" />
        <p className="mt-4 text-lg">Loading Recipes...</p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <HomePageClient />
    </Suspense>
  );
}

    