"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { PhoneVerificationModal } from "@/components/auth/phone-verification-modal";
import { Toaster } from "@/components/ui/toaster";
import AssistantChatbox from "@/components/assistant/AssistantChatbox";
import SmoothScrollHandler from "@/components/shared/smooth-scroll-handler";
import { GoogleOAuthProvider } from "@react-oauth/google";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 3,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Prevent browser from restoring scroll position
      window.history.scrollRestoration = "manual";
      // Force scroll to top
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <QueryClientProvider client={client}>
        <AuthProvider>
          {children}
          <PhoneVerificationModal />
          <AssistantChatbox />
        </AuthProvider>
        <SmoothScrollHandler />
        <Toaster />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
