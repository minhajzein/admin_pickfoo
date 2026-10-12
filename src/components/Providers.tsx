'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { MapboxTokenProvider } from '@/lib/mapbox-token-context';

/**
 * Retry once only for a dropped connection or a gateway hiccup. Timeouts and
 * 4xx/500 are not retried: the server is still busy with the first attempt.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (!axios.isAxiosError(error)) return false;
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return false;
  const status = error.response?.status;
  if (status == null) return true;
  return status === 502 || status === 503 || status === 504;
}

export default function Providers({
  children,
  mapboxToken = '',
}: {
  children: React.ReactNode;
  mapboxToken?: string;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: shouldRetry,
            retryDelay: 3000,
            refetchOnWindowFocus: false,
            refetchIntervalInBackground: false,
          },
        },
      })
  );

  return (
    <MapboxTokenProvider token={mapboxToken}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MapboxTokenProvider>
  );
}
