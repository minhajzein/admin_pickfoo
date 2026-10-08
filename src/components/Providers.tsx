'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { MapboxTokenProvider } from '@/lib/mapbox-token-context';

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
            retry: 1,
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
