'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import AssistantChatbox from '@/components/assistant/AssistantChatbox';
import { GoogleOAuthProvider } from '@react-oauth/google';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Prevent browser from restoring scroll position
      window.history.scrollRestoration = 'manual';
      // Force scroll to top
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
        <AssistantChatbox />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
